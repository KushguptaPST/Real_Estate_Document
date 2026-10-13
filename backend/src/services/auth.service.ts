import crypto from 'node:crypto';
import { OAuth2Client } from 'google-auth-library';
import jwt from 'jsonwebtoken';
import { type User, type UserRole } from '@prisma/client';
import { prisma } from '../utils/prisma.js';
import { createError } from '../middleware/errorHandler.js';


const SESSION_TTL = '7d';
const JWT_ALGORITHM = 'HS256';
const JWT_ISSUER = 'contingency-copilot';
const JWT_AUDIENCE = 'contingency-copilot-api';
const MIN_JWT_SECRET_LENGTH = 32;
// Secrets that have shipped in this repo or its tests; never acceptable.
const KNOWN_WEAK_SECRETS = new Set(['development-fallback-secret-2026', 'changeme', 'secret']);

const DEMO_GOOGLE_ID = 'demo-google-agent-sub-1001';
const DEMO_ORG_ID = 'demo-sandbox-org';

export interface SessionUser {
  id: string;
  email: string;
  name: string | null;
  pictureUrl: string | null;
  organizationId: string;
  role: UserRole;
}

interface SessionClaims {
  sub: string;
  org: string;
  role: UserRole;
  sv: number;
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw createError(`${name} is not configured on the server`, 500);
  return value;
}

/** Returns the JWT signing secret, refusing missing, short or known-weak values. */
export function getJwtSecret(): string {
  const secret = process.env['JWT_SECRET'];
  if (!secret || secret.length < MIN_JWT_SECRET_LENGTH || KNOWN_WEAK_SECRETS.has(secret)) {
    const err = createError('Server authentication is misconfigured', 500);
    err.isOperational = false;
    throw err;
  }
  return secret;
}

export function isDemoLoginEnabled(): boolean {
  return process.env['ENABLE_DEMO_LOGIN'] === 'true' && process.env['NODE_ENV'] !== 'production';
}

/** Fail-fast configuration check, run once at process start. */
export function assertSecurityConfig(): void {
  const secret = process.env['JWT_SECRET'];
  if (!secret || secret.length < MIN_JWT_SECRET_LENGTH || KNOWN_WEAK_SECRETS.has(secret)) {
    throw new Error(`JWT_SECRET must be set to a random value of at least ${MIN_JWT_SECRET_LENGTH} characters`);
  }
  if (process.env['NODE_ENV'] === 'production' && process.env['ENABLE_DEMO_LOGIN'] === 'true') {
    throw new Error('ENABLE_DEMO_LOGIN must not be enabled in production');
  }
}

let googleClient: OAuth2Client | null = null;
function getGoogleClient(): OAuth2Client {
  googleClient ??= new OAuth2Client(requireEnv('GOOGLE_CLIENT_ID'), process.env['GOOGLE_CLIENT_SECRET']);
  return googleClient;
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function toSessionUser(user: User): SessionUser {
  if (!user.organizationId) {
    throw createError('Your account is not a member of any organization. Ask an organization owner for an invitation.', 403);
  }
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    pictureUrl: user.pictureUrl,
    organizationId: user.organizationId,
    role: user.role,
  };
}

/** Issues a session JWT for a user that belongs to an organization. */
export function signSessionToken(user: User): { token: string; user: SessionUser } {
  const sessionUser = toSessionUser(user);
  const claims: SessionClaims = {
    sub: user.id,
    org: sessionUser.organizationId,
    role: user.role,
    sv: user.sessionVersion,
  };
  const token = jwt.sign(claims, getJwtSecret(), {
    algorithm: JWT_ALGORITHM,
    issuer: JWT_ISSUER,
    audience: JWT_AUDIENCE,
    expiresIn: SESSION_TTL,
  });
  return { token, user: sessionUser };
}

/**
 * Accepts a pending invitation for `user`. Single-use: the claim is an atomic
 * conditional update, so concurrent or repeated use of one token fails.
 */
async function acceptInvitation(user: User, inviteToken: string): Promise<User> {
  const invitation = await prisma.invitation.findUnique({ where: { tokenHash: hashToken(inviteToken) } });
  const now = new Date();

  if (!invitation || invitation.revokedAt || invitation.acceptedAt || invitation.expiresAt <= now) {
    throw createError('This invitation is invalid or has expired', 403);
  }
  if (invitation.email.toLowerCase() !== user.email.toLowerCase()) {
    throw createError('This invitation was issued to a different email address', 403);
  }
  if (user.organizationId && user.organizationId !== invitation.organizationId) {
    throw createError('Your account already belongs to another organization', 409);
  }
  if (user.organizationId === invitation.organizationId) {
    return user;
  }

  return prisma.$transaction(async (tx) => {
    const claimed = await tx.invitation.updateMany({
      where: { id: invitation.id, acceptedAt: null, revokedAt: null, expiresAt: { gt: now } },
      data: { acceptedAt: now, acceptedById: user.id },
    });
    if (claimed.count !== 1) {
      throw createError('This invitation is invalid or has expired', 403);
    }
    const joined = await tx.user.updateMany({
      where: { id: user.id, organizationId: null },
      data: { organizationId: invitation.organizationId, role: invitation.role, sessionVersion: { increment: 1 } },
    });
    if (joined.count !== 1) {
      throw createError('Your account already belongs to another organization', 409);
    }
    return tx.user.findUniqueOrThrow({ where: { id: user.id } });
  });
}

/** Verify a Google Identity Services ID token, upsert the user, and apply an invitation if given. */
export async function signInWithGoogle(
  credential: string,
  inviteToken?: string,
): Promise<{ token: string; user: SessionUser }> {
  const ticket = await getGoogleClient()
    .verifyIdToken({ idToken: credential, audience: requireEnv('GOOGLE_CLIENT_ID') })
    .catch(() => {
      throw createError('Invalid Google credential', 401);
    });

  const payload = ticket.getPayload();
  if (!payload?.sub || !payload.email || !payload.email_verified) {
    throw createError('Google account email is not verified', 401);
  }

  return completeSignIn(
    { googleId: payload.sub, email: payload.email, name: payload.name ?? null, pictureUrl: payload.picture ?? null },
    inviteToken,
  );
}

/** Shared post-verification step: upsert the identity, apply any invitation, issue a session. */
export async function completeSignIn(
  identity: { googleId: string; email: string; name: string | null; pictureUrl: string | null },
  inviteToken?: string,
): Promise<{ token: string; user: SessionUser }> {
  const email = identity.email.trim().toLowerCase();
  const profile = { email, name: identity.name, pictureUrl: identity.pictureUrl, lastLoginAt: new Date() };

  // Never let a sign-in rebind an email that already belongs to a different Google identity.
  const byEmail = await prisma.user.findUnique({ where: { email } });
  if (byEmail && byEmail.googleId !== identity.googleId) {
    throw createError('This email is linked to a different account', 409);
  }

  let user = await prisma.user.upsert({
    where: { googleId: identity.googleId },
    update: profile,
    create: { googleId: identity.googleId, ...profile },
  });

  if (inviteToken) {
    user = await acceptInvitation(user, inviteToken);
  }

  return signSessionToken(user);
}

/** Demo login — only when ENABLE_DEMO_LOGIN=true outside production; isolated sandbox org. */
export async function signInAsDemoAgent(): Promise<{ token: string; user: SessionUser }> {
  if (!isDemoLoginEnabled()) {
    throw createError('Route not found', 404);
  }

  await prisma.organization.upsert({
    where: { id: DEMO_ORG_ID },
    update: {},
    create: { id: DEMO_ORG_ID, name: 'Demo Sandbox Brokerage' },
  });

  const profile = {
    email: 'agent.demo@contingencycopilot.com',
    name: 'Sarah Jenkins (Demo Agent)',
    pictureUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=150',
    lastLoginAt: new Date(),
  };

  const existing = await prisma.user.findUnique({ where: { googleId: DEMO_GOOGLE_ID } });
  if (existing && existing.organizationId && existing.organizationId !== DEMO_ORG_ID) {
    throw createError('Demo account is misconfigured', 500);
  }

  const user = await prisma.user.upsert({
    where: { googleId: DEMO_GOOGLE_ID },
    update: { ...profile, organizationId: DEMO_ORG_ID, role: 'AGENT' },
    create: { googleId: DEMO_GOOGLE_ID, ...profile, organizationId: DEMO_ORG_ID, role: 'AGENT' },
  });

  return signSessionToken(user);
}

/**
 * Verifies a session JWT and re-loads the user, so role changes, removals and
 * revocations take effect immediately. The database — not the token — is the
 * source of truth for organization and role.
 */
export async function verifySessionToken(token: string): Promise<SessionUser> {
  let claims: jwt.JwtPayload & Partial<SessionClaims>;
  try {
    claims = jwt.verify(token, getJwtSecret(), {
      algorithms: [JWT_ALGORITHM],
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    }) as jwt.JwtPayload & Partial<SessionClaims>;
  } catch (err) {
    if ((err as { isOperational?: boolean }).isOperational === false) throw err;
    throw createError('Session expired or invalid — please sign in again', 401);
  }

  if (typeof claims.sub !== 'string' || typeof claims.org !== 'string' || typeof claims.sv !== 'number') {
    throw createError('Session expired or invalid — please sign in again', 401);
  }

  const user = await prisma.user.findUnique({ where: { id: claims.sub } });
  if (!user || !user.organizationId || user.organizationId !== claims.org || user.sessionVersion !== claims.sv) {
    throw createError('Session expired or invalid — please sign in again', 401);
  }

  return toSessionUser(user);
}
