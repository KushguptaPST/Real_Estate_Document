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
  organizationName?: string;
  subscriptionTier?: string;
  stateJurisdiction?: string | null;
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

function toSessionUser(user: User & { organization?: { name: string; subscriptionTier?: string; stateJurisdiction?: string | null } | null }): SessionUser {
  if (!user.organizationId) {
    throw createError('Your account is not a member of any organization. Ask an organization owner for an invitation.', 403);
  }
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    pictureUrl: user.pictureUrl,
    organizationId: user.organizationId,
    organizationName: user.organization?.name,
    subscriptionTier: user.organization?.subscriptionTier,
    stateJurisdiction: user.organization?.stateJurisdiction,
    role: user.role,
  };
}

/** Issues a session JWT for a user that belongs to an organization. */
export function signSessionToken(user: User & { organization?: { name: string; subscriptionTier?: string; stateJurisdiction?: string | null } | null }): { token: string; user: SessionUser } {
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

  // Check if an account already exists with this email address
  const byEmail = await prisma.user.findUnique({ where: { email } });
  if (byEmail && byEmail.googleId && byEmail.googleId !== identity.googleId) {
    throw createError('This email is linked to a different Google account', 409);
  }

  let user: User;
  if (byEmail) {
    // If user previously registered via email/password or invitation without a googleId, link it now
    user = await prisma.user.update({
      where: { id: byEmail.id },
      data: { googleId: identity.googleId, ...profile },
    });
  } else {
    user = await prisma.user.upsert({
      where: { googleId: identity.googleId },
      update: profile,
      create: { googleId: identity.googleId, ...profile },
    });
  }

  if (inviteToken) {
    user = await acceptInvitation(user, inviteToken);
  } else if (!user.organizationId) {
    const orgName = identity.name ? `${identity.name}'s Brokerage` : 'Agent Workspace';
    const org = await prisma.organization.create({
      data: { name: orgName },
    });
    user = await prisma.user.update({
      where: { id: user.id },
      data: { organizationId: org.id, role: 'OWNER' },
    });
  }

  return signSessionToken(user);
}

/** Demo login — only when ENABLE_DEMO_LOGIN=true outside production; isolated sandbox org. */
export async function signInAsDemoAgent(targetRole: 'AGENT' | 'OWNER' = 'AGENT'): Promise<{ token: string; user: SessionUser }> {
  if (!isDemoLoginEnabled()) {
    throw createError('Route not found', 404);
  }

  await prisma.organization.upsert({
    where: { id: DEMO_ORG_ID },
    update: { name: 'Eigen Estate Brokerage' },
    create: { id: DEMO_ORG_ID, name: 'Eigen Estate Brokerage' },
  });

  const isOwner = targetRole === 'OWNER';
  const profile = {
    email: isOwner ? 'owner.demo@eigenestate.com' : 'agent.demo@eigenestate.com',
    name: isOwner ? 'Marcus Vance (Demo Broker Owner)' : 'Sarah Jenkins (Demo Agent)',
    pictureUrl: isOwner
      ? 'https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&q=80&w=150'
      : 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=150',
    lastLoginAt: new Date(),
  };

  const existing = await prisma.user.findUnique({ where: { googleId: DEMO_GOOGLE_ID } });
  if (existing && existing.organizationId && existing.organizationId !== DEMO_ORG_ID) {
    throw createError('Demo account is misconfigured', 500);
  }

  const user = await prisma.user.upsert({
    where: { googleId: DEMO_GOOGLE_ID },
    update: { ...profile, organizationId: DEMO_ORG_ID, role: targetRole },
    create: { googleId: DEMO_GOOGLE_ID, ...profile, organizationId: DEMO_ORG_ID, role: targetRole },
    include: { organization: { select: { name: true, subscriptionTier: true, stateJurisdiction: true } } },
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

  const user = await prisma.user.findUnique({
    where: { id: claims.sub },
    include: { organization: { select: { name: true, subscriptionTier: true, stateJurisdiction: true } } },
  });
  if (!user || !user.organizationId || user.organizationId !== claims.org || user.sessionVersion !== claims.sv) {
    throw createError('Session expired or invalid — please sign in again', 401);
  }

  return toSessionUser(user);
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  try {
    const [salt, key] = storedHash.split(':');
    if (!salt || !key) return false;
    const keyBuffer = Buffer.from(key, 'hex');
    const derivedKey = crypto.scryptSync(password, salt, 64);
    return crypto.timingSafeEqual(keyBuffer, derivedKey);
  } catch {
    return false;
  }
}

export interface RegisterOrganizationInput {
  ownerName: string;
  email: string;
  password?: string;
  organizationName: string;
  stateJurisdiction?: string;
  planTier?: 'SOLO' | 'TEAM' | 'ENTERPRISE';
}

export async function registerOrganization(input: RegisterOrganizationInput): Promise<{
  token: string;
  user: SessionUser;
  organization: {
    id: string;
    name: string;
    subscriptionTier: string;
    subscriptionStatus: string;
    stateJurisdiction: string;
  };
}> {
  const email = input.email.trim().toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw createError('An account with this email address already exists. Please log in.', 409);
  }

  const jurisdiction = input.stateJurisdiction || 'KA';
  const tier = input.planTier || 'SOLO';

  return prisma.$transaction(async (tx) => {
    const org = await tx.organization.create({
      data: {
        name: input.organizationName.trim(),
        stateJurisdiction: jurisdiction,
        subscriptionTier: tier,
        subscriptionStatus: 'ACTIVE',
        planExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });

    const user = await tx.user.create({
      data: {
        email,
        name: input.ownerName.trim(),
        passwordHash: input.password ? hashPassword(input.password) : null,
        organizationId: org.id,
        role: 'OWNER',
        lastLoginAt: new Date(),
      },
    });

    const { token, user: sessionUser } = signSessionToken({
      ...user,
      organization: {
        name: org.name,
        subscriptionTier: org.subscriptionTier,
        stateJurisdiction: org.stateJurisdiction,
      },
    });
    return {
      token,
      user: sessionUser,
      organization: {
        id: org.id,
        name: org.name,
        subscriptionTier: org.subscriptionTier,
        subscriptionStatus: org.subscriptionStatus,
        stateJurisdiction: org.stateJurisdiction || 'KA',
      },
    };
  });
}

export async function signInWithPassword(email: string, password: string): Promise<{ token: string; user: SessionUser }> {
  const normalizedEmail = email.trim().toLowerCase();
  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    include: { organization: { select: { name: true, subscriptionTier: true, stateJurisdiction: true } } },
  });
  if (!user || !user.passwordHash || !verifyPassword(password, user.passwordHash)) {
    throw createError('Invalid email or password', 401);
  }
  if (!user.organizationId) {
    throw createError('Your account is not linked to any brokerage organization', 403);
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  return signSessionToken(user);
}
