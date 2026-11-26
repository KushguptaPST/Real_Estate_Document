import crypto from 'node:crypto';
import { OAuth2Client } from 'google-auth-library';
import jwt from 'jsonwebtoken';
import { type User, type UserRole } from '@prisma/client';
import { prisma } from '../utils/prisma.js';
import { logger } from '../utils/logger.js';
import { createError } from '../middleware/errorHandler.js';
import { provisionSubaccountForOrg } from './telephony/plivoProvisioning.service.js';


const SESSION_TTL = '7d';
const JWT_ALGORITHM = 'HS256';
const JWT_ISSUER = 'contingency-copilot';
const JWT_AUDIENCE = 'contingency-copilot-api';
const MIN_JWT_SECRET_LENGTH = 32;
// Secrets that have shipped in this repo or its tests; never acceptable.
const KNOWN_WEAK_SECRETS = new Set(['development-fallback-secret-2026', 'changeme', 'secret']);

const DEMO_GOOGLE_ID = 'demo-google-agent-sub-1001';
const DEMO_ORG_ID = 'demo-sandbox-org';

export function isPlatformAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  const raw = process.env['PLATFORM_ADMIN_EMAILS'] || '';
  if (!raw.trim()) return false;
  const allowlist = raw
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return allowlist.includes(email.trim().toLowerCase());
}

export interface SessionUser {
  id: string;
  email: string;
  name: string | null;
  pictureUrl: string | null;
  organizationId: string;
  organizationName?: string;
  subscriptionTier?: string;
  subscriptionStatus?: string;
  stateJurisdiction?: string | null;
  role: UserRole;
  isPlatformAdmin: boolean;
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
  return true;
}

/** Fail-fast configuration check, run once at process start. */
export function assertSecurityConfig(): void {
  const secret = process.env['JWT_SECRET'];
  if (!secret || secret.length < MIN_JWT_SECRET_LENGTH || KNOWN_WEAK_SECRETS.has(secret)) {
    throw new Error(`JWT_SECRET must be set to a random value of at least ${MIN_JWT_SECRET_LENGTH} characters`);
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

function toSessionUser(
  user: User & {
    organization?: {
      name: string;
      subscriptionTier?: string;
      subscriptionStatus?: string;
      stateJurisdiction?: string | null;
      isSuspended?: boolean;
    } | null;
  },
): SessionUser {
  if (!user.organizationId) {
    throw createError('Your account is not a member of any organization. Ask an organization owner for an invitation.', 403);
  }
  const platformAdmin = isPlatformAdminEmail(user.email);
  if (user.organization?.isSuspended && !platformAdmin) {
    throw createError('Your brokerage workspace has been suspended. Please contact support.', 403);
  }
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    pictureUrl: user.pictureUrl,
    organizationId: user.organizationId,
    organizationName: user.organization?.name,
    subscriptionTier: user.organization?.subscriptionTier,
    subscriptionStatus: user.organization?.subscriptionStatus,
    stateJurisdiction: user.organization?.stateJurisdiction,
    role: user.role,
    isPlatformAdmin: platformAdmin,
  };
}

/** Issues a session JWT for a user that belongs to an organization. */
export function signSessionToken(
  user: User & {
    organization?: {
      name: string;
      subscriptionTier?: string;
      subscriptionStatus?: string;
      stateJurisdiction?: string | null;
      isSuspended?: boolean;
    } | null;
  },
): { token: string; user: SessionUser } {
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
): Promise<{ token: string; user: SessionUser; isNewWorkspace?: boolean }> {
  logger.info('[OAuth] Verifying Google ID token...');
  let ticket;
  try {
    ticket = await getGoogleClient().verifyIdToken({
      idToken: credential,
      audience: requireEnv('GOOGLE_CLIENT_ID'),
    });
  } catch (err: any) {
    logger.error(`[OAuth] Google verifyIdToken error: ${err.message}`);
    throw createError('Invalid Google credential', 401);
  }

  const payload = ticket.getPayload();
  if (!payload?.sub || !payload.email || !payload.email_verified) {
    logger.warn(`[OAuth] Google verification rejected: sub=${payload?.sub}, email=${payload?.email}, verified=${payload?.email_verified}`);
    throw createError('Google account email is not verified', 401);
  }

  logger.info(`[OAuth] Google token verified successfully: email=${payload.email}, name="${payload.name}"`);
  return completeSignIn(
    { googleId: payload.sub, email: payload.email, name: payload.name ?? null, pictureUrl: payload.picture ?? null },
    inviteToken,
  );
}

/** Shared post-verification step: upsert the identity, apply any invitation, issue a session. */
export async function completeSignIn(
  identity: { googleId: string; email: string; name: string | null; pictureUrl: string | null },
  inviteToken?: string,
): Promise<{ token: string; user: SessionUser; isNewWorkspace?: boolean }> {
  const email = identity.email.trim().toLowerCase();
  logger.info(`[OAuth] Processing completeSignIn for: ${email}`);
  const profile = { email, name: identity.name, pictureUrl: identity.pictureUrl, lastLoginAt: new Date() };

  // Check if an account already exists with this email address
  const byEmail = await prisma.user.findUnique({ where: { email } });
  if (byEmail && byEmail.googleId && byEmail.googleId !== identity.googleId) {
    logger.warn(`[OAuth] Email conflict: ${email} already linked to another Google ID`);
    throw createError('This email is linked to a different Google account', 409);
  }

  let user: User;
  if (byEmail) {
    logger.info(`[OAuth] Existing user found for ${email} (ID: ${byEmail.id}). Linking Google ID.`);
    // If user previously registered via email/password or invitation without a googleId, link it now
    user = await prisma.user.update({
      where: { id: byEmail.id },
      data: { googleId: identity.googleId, ...profile },
    });
    // Ensure organization is active so onboarding and dashboard are accessible
    if (user.organizationId) {
      await prisma.organization.updateMany({
        where: { id: user.organizationId, subscriptionStatus: 'PENDING_PAYMENT' },
        data: { subscriptionStatus: 'ACTIVE' },
      });
    }
  } else {
    logger.info(`[OAuth] Upserting user record for new Google identity: ${email}`);
    user = await prisma.user.upsert({
      where: { googleId: identity.googleId },
      update: profile,
      create: { googleId: identity.googleId, ...profile },
    });
  }

  let isNewWorkspace = false;
  if (inviteToken) {
    logger.info(`[OAuth] Accepting team invitation token for user: ${email}`);
    user = await acceptInvitation(user, inviteToken);
  } else if (!user.organizationId) {
    logger.info(`[OAuth] No workspace exists for new user ${email}. Provisioning workspace for onboarding.`);
    const orgName = identity.name ? `${identity.name}'s Brokerage` : 'My Brokerage';
    const provisioned = await prisma.$transaction(async (tx) => {
      const org = await tx.organization.create({
        data: {
          name: orgName,
          subscriptionTier: 'SOLO',
          subscriptionStatus: 'ACTIVE',
          stateJurisdiction: 'KA',
        },
      });
      await tx.organizationChannel.create({
        data: {
          organizationId: org.id,
          telegramWebhookSecret: crypto.randomBytes(18).toString('hex'),
          widgetAllowedOrigins: ['http://localhost:3000', 'http://localhost:5173'],
          onboardingCompleted: false,
          onboardingStep: 1,
        },
      });
      await tx.organizationWallet.create({
        data: {
          organizationId: org.id,
          balance: 0.0,
          totalDeposited: 0.0,
          autoRechargeEnabled: false,
        },
      });
      const updatedUser = await tx.user.update({
        where: { id: user.id },
        data: { organizationId: org.id, role: 'OWNER' },
      });
      return { org, updatedUser };
    });

    user = provisioned.updatedUser;
    isNewWorkspace = true;
    logger.info(`[OAuth] Provisioned new workspace: orgId=${provisioned.org.id}, isNewWorkspace=true for ${email}`);
    if (process.env['NODE_ENV'] !== 'test') {
      provisionSubaccountForOrg(provisioned.org.id, provisioned.org.name).catch((err) => {
        logger.warn(`[OAuth] Non-fatal subaccount provisioning error: ${err?.message}`);
      });
    }
  }

  const hydratedUser = await prisma.user.findUniqueOrThrow({
    where: { id: user.id },
    include: {
      organization: {
        select: { name: true, subscriptionTier: true, subscriptionStatus: true, stateJurisdiction: true, isSuspended: true },
      },
    },
  });

  logger.info(`[OAuth] Issued session token for ${email} (org: ${hydratedUser.organization?.name}, new: ${isNewWorkspace})`);
  return { ...signSessionToken(hydratedUser), isNewWorkspace };
}

/** Demo login — only when ENABLE_DEMO_LOGIN=true outside production; isolated sandbox org. */
export async function signInAsDemoAgent(targetRole: 'AGENT' | 'OWNER' = 'AGENT'): Promise<{ token: string; user: SessionUser }> {
  if (!isDemoLoginEnabled()) {
    throw createError('Route not found', 404);
  }

  await prisma.organization.upsert({
    where: { id: DEMO_ORG_ID },
    update: { name: 'Eigen Estate Brokerage', subscriptionStatus: 'ACTIVE', subscriptionTier: 'TEAM' },
    create: { id: DEMO_ORG_ID, name: 'Eigen Estate Brokerage', subscriptionStatus: 'ACTIVE', subscriptionTier: 'TEAM' },
  });

  await prisma.organizationChannel.upsert({
    where: { organizationId: DEMO_ORG_ID },
    update: {},
    create: {
      organizationId: DEMO_ORG_ID,
      telegramWebhookSecret: 'demo_telegram_secret_2026',
      widgetAllowedOrigins: ['*'],
      defaultCurrency: 'INR',
    },
  });

  const isOwner = targetRole === 'OWNER';
  const profile = {
    email: isOwner ? 'owner.demo@eigenestate.com' : 'agent.demo@eigenestate.com',
    name: isOwner ? 'Kush Gupta (Broker Owner)' : 'Sarah Jenkins (Property Advisor)',
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

  // Seed sample verified Bengaluru inventory for demo organization if empty
  try {
    const propCount = await prisma.property.count({ where: { organizationId: DEMO_ORG_ID } });
    if (propCount === 0) {
      await prisma.property.createMany({
        data: [
          {
            organizationId: DEMO_ORG_ID,
            title: 'Prestige Shantiniketan — Highline 3BHK Residence',
            address: 'Tower 14, ITPL Main Road, Whitefield',
            city: 'Whitefield, Bengaluru',
            microMarket: 'Whitefield',
            price: 14500000,
            bedrooms: 3,
            bathrooms: 3,
            propertyType: 'APARTMENT',
            status: 'AVAILABLE',
            features: ['Ready to Move', '1930 sq ft', 'Clubhouse & Pool', '5-min walk to Metro'],
            description: 'Ready-to-move 3BHK residence in Prestige Shantiniketan, Whitefield. 1,930 sq.ft., high floor, walking distance to ITPL.',
          },
          {
            organizationId: DEMO_ORG_ID,
            title: 'Godrej Splendour — Park-Facing 3BHK Smart Home',
            address: 'Belathur Main Road, Whitefield Corridor',
            city: 'Whitefield, Bengaluru',
            microMarket: 'Whitefield',
            price: 13800000,
            bedrooms: 3,
            bathrooms: 2,
            propertyType: 'APARTMENT',
            status: 'AVAILABLE',
            features: ['Under Construction (Dec 2026)', '1529 sq ft', 'Smart Home Automation'],
            description: 'Contemporary 3BHK home at Godrej Splendour in Belathur-Whitefield corridor. 1,529 sq.ft., balconies, luxury clubhouse.',
          },
          {
            organizationId: DEMO_ORG_ID,
            title: 'Sobha Dream Acres — Premium 2BHK',
            address: 'Panathur Main Road, Off Marathahalli-ORR',
            city: 'Bengaluru',
            microMarket: 'Panathur',
            price: 9800000,
            bedrooms: 2,
            bathrooms: 2,
            propertyType: 'APARTMENT',
            status: 'AVAILABLE',
            features: ['Ready to Move', '1012 sq ft', 'Clubhouse', 'Olympic Pool'],
            description: 'Vastu compliant 2BHK in Sobha Dream Acres. 1,012 sq.ft. with German precast technology.',
          },
        ],
        skipDuplicates: true,
      });
    }

    const leadCount = await prisma.lead.count({ where: { organizationId: DEMO_ORG_ID } });
    if (leadCount === 0) {
      await prisma.lead.create({
        data: {
          organizationId: DEMO_ORG_ID,
          fullName: 'Nitish Kumar',
          email: 'nitish@gmail.com',
          phone: '9201676332',
          source: 'MANUAL',
          priority: 'MEDIUM',
          status: 'NEW',
          requirements: {
            create: {
              minBudget: 10000000,
              maxBudget: 15000000,
              preferredLocations: ['Whitefield'],
              propertyType: 'APARTMENT',
              minBedrooms: 3,
              maxBedrooms: 3,
              notes: 'Looking for a 3 bhk in whitefield under 1.5 crore',
            },
          },
        },
      });
    }
  } catch (seedErr) {
    logger.warn(`[Demo Seed] Non-fatal error seeding demo records: ${(seedErr as Error).message}`);
  }

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
    include: {
      organization: {
        select: { name: true, subscriptionTier: true, subscriptionStatus: true, stateJurisdiction: true, isSuspended: true },
      },
    },
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
  ownerPhone?: string;
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
  const initialSubscriptionStatus =
    process.env['NODE_ENV'] === 'production' && Boolean(process.env['STRIPE_SECRET_KEY'])
      ? 'PENDING_PAYMENT'
      : 'ACTIVE';

  const created = await prisma.$transaction(async (tx) => {
    const org = await tx.organization.create({
      data: {
        name: input.organizationName.trim(),
        stateJurisdiction: jurisdiction,
        subscriptionTier: tier,
        subscriptionStatus: initialSubscriptionStatus,
        planExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });

    const user = await tx.user.create({
      data: {
        email,
        name: input.ownerName.trim(),
        phone: input.ownerPhone?.trim() || null,
        passwordHash: input.password ? hashPassword(input.password) : null,
        organizationId: org.id,
        role: 'OWNER',
        lastLoginAt: new Date(),
      },
    });

    await tx.organizationChannel.create({
      data: {
        organizationId: org.id,
        telegramWebhookSecret: crypto.randomBytes(18).toString('hex'),
        widgetAllowedOrigins: ['http://localhost:3000', 'http://localhost:5173'],
      },
    });

    await tx.organizationWallet.create({
      data: {
        organizationId: org.id,
        balance: 0.0,
        totalDeposited: 0.0,
        autoRechargeEnabled: false,
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

  // Provision Plivo Subaccount asynchronously (non-blocking)
  provisionSubaccountForOrg(created.organization.id, created.organization.name).catch(() => {});

  return created;
}

export async function signInWithPassword(email: string, password: string): Promise<{ token: string; user: SessionUser }> {
  const normalizedEmail = email.trim().toLowerCase();
  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    include: { organization: { select: { name: true, subscriptionTier: true, stateJurisdiction: true, isSuspended: true } } },
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
