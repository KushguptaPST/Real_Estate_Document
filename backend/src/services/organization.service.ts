// ─────────────────────────────────────────────────────────────────────────────
// Organization Service — invite-only membership, roles, and lead-intake API keys
// ─────────────────────────────────────────────────────────────────────────────

import crypto from 'node:crypto';
import { type UserRole } from '@prisma/client';
import { prisma } from '../utils/prisma.js';
import { createError } from '../middleware/errorHandler.js';
import { requireOrgId } from '../utils/tenant.js';
import { hashToken } from './auth.service.js';


const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_PENDING_INVITES_PER_ORG = 50;
const API_KEY_PREFIX = 'rek_';

/** Creates an organization plus a one-time OWNER invitation (bootstrap path; CLI only). */
export async function createOrganizationWithOwnerInvite(name: string, ownerEmail: string) {
  const org = await prisma.organization.create({ data: { name } });
  const invite = await createInvitation({ organizationId: org.id, email: ownerEmail, role: 'OWNER', invitedById: null });
  return { organization: org, ...invite };
}

export async function createInvitation(params: {
  organizationId: string;
  email: string;
  role: UserRole;
  invitedById: string | null;
}) {
  const organizationId = requireOrgId(params.organizationId);
  const email = params.email.trim().toLowerCase();
  const now = new Date();

  // Only check membership of *this* org; whether the address belongs to another
  // tenant is not disclosed (acceptance enforces one-org-per-user instead).
  const existingMember = await prisma.user.findFirst({ where: { email, organizationId } });
  if (existingMember) {
    throw createError('This person is already a member of your organization', 409);
  }

  const pendingCount = await prisma.invitation.count({
    where: { organizationId, acceptedAt: null, revokedAt: null, expiresAt: { gt: now } },
  });
  if (pendingCount >= MAX_PENDING_INVITES_PER_ORG) {
    throw createError('Too many pending invitations. Revoke unused invitations first.', 429);
  }

  // A new invitation supersedes any pending one for the same address in this org.
  await prisma.invitation.updateMany({
    where: { organizationId, email, acceptedAt: null, revokedAt: null },
    data: { revokedAt: now },
  });

  const token = crypto.randomBytes(32).toString('base64url');
  const invitation = await prisma.invitation.create({
    data: {
      organizationId,
      email,
      role: params.role,
      tokenHash: hashToken(token),
      invitedById: params.invitedById,
      expiresAt: new Date(now.getTime() + INVITE_TTL_MS),
    },
  });

  return { invitation: toInvitationView(invitation), token };
}

function toInvitationView(inv: {
  id: string;
  email: string;
  role: UserRole;
  expiresAt: Date;
  acceptedAt: Date | null;
  revokedAt: Date | null;
  createdAt: Date;
}) {
  const now = Date.now();
  const status = inv.acceptedAt
    ? 'ACCEPTED'
    : inv.revokedAt
      ? 'REVOKED'
      : inv.expiresAt.getTime() <= now
        ? 'EXPIRED'
        : 'PENDING';
  return { id: inv.id, email: inv.email, role: inv.role, status, expiresAt: inv.expiresAt, createdAt: inv.createdAt };
}

export async function listInvitations(organizationId: string) {
  const invitations = await prisma.invitation.findMany({
    where: { organizationId: requireOrgId(organizationId) },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });
  return invitations.map(toInvitationView);
}

export async function revokeInvitation(organizationId: string, invitationId: string) {
  const result = await prisma.invitation.updateMany({
    where: { id: invitationId, organizationId: requireOrgId(organizationId), acceptedAt: null, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  if (result.count !== 1) throw createError('Invitation not found', 404);
}

export async function listMembers(organizationId: string) {
  return prisma.user.findMany({
    where: { organizationId: requireOrgId(organizationId) },
    select: { id: true, email: true, name: true, pictureUrl: true, role: true, lastLoginAt: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  });
}

/**
 * Changes a member's role. Runs in a serializable transaction so two concurrent
 * demotions cannot leave the organization without an OWNER.
 */
export async function changeMemberRole(params: { organizationId: string; actorId: string; userId: string; role: UserRole }) {
  const organizationId = requireOrgId(params.organizationId);
  return prisma.$transaction(
    async (tx) => {
      const member = await tx.user.findFirst({ where: { id: params.userId, organizationId } });
      if (!member) throw createError('Member not found', 404);
      if (member.role === params.role) return member;

      if (member.role === 'OWNER' && params.role !== 'OWNER') {
        const owners = await tx.user.count({ where: { organizationId, role: 'OWNER' } });
        if (owners <= 1) throw createError('An organization must keep at least one owner', 409);
      }

      return tx.user.update({
        where: { id: member.id },
        data: { role: params.role, sessionVersion: { increment: 1 } },
      });
    },
    { isolationLevel: 'Serializable' },
  ).then((u) => ({ id: u.id, email: u.email, name: u.name, role: u.role }));
}

/** Removes a member from the organization and invalidates their sessions. */
export async function removeMember(params: { organizationId: string; userId: string }) {
  const organizationId = requireOrgId(params.organizationId);
  await prisma.$transaction(
    async (tx) => {
      const member = await tx.user.findFirst({ where: { id: params.userId, organizationId } });
      if (!member) throw createError('Member not found', 404);

      if (member.role === 'OWNER') {
        const owners = await tx.user.count({ where: { organizationId, role: 'OWNER' } });
        if (owners <= 1) throw createError('An organization must keep at least one owner', 409);
      }

      await tx.lead.updateMany({ where: { organizationId, assignedUserId: member.id }, data: { assignedUserId: null } });
      await tx.user.update({
        where: { id: member.id },
        data: { organizationId: null, role: 'AGENT', sessionVersion: { increment: 1 } },
      });
    },
    { isolationLevel: 'Serializable' },
  );
}

// ── Lead-intake API keys ─────────────────────────────────────────────────────

export async function createApiKey(params: { organizationId: string; name: string; createdById: string }) {
  const organizationId = requireOrgId(params.organizationId);
  const secret = crypto.randomBytes(32).toString('base64url');
  const key = `${API_KEY_PREFIX}${secret}`;
  const record = await prisma.organizationApiKey.create({
    data: {
      organizationId,
      name: params.name,
      keyPrefix: key.slice(0, API_KEY_PREFIX.length + 6),
      keyHash: hashToken(key),
      scope: 'lead_intake',
      createdById: params.createdById,
    },
  });
  return { apiKey: toApiKeyView(record), key };
}

function toApiKeyView(k: {
  id: string;
  name: string;
  keyPrefix: string;
  scope: string;
  lastUsedAt: Date | null;
  revokedAt: Date | null;
  createdAt: Date;
}) {
  return {
    id: k.id,
    name: k.name,
    keyPrefix: k.keyPrefix,
    scope: k.scope,
    lastUsedAt: k.lastUsedAt,
    revokedAt: k.revokedAt,
    createdAt: k.createdAt,
  };
}

export async function listApiKeys(organizationId: string) {
  const keys = await prisma.organizationApiKey.findMany({
    where: { organizationId: requireOrgId(organizationId) },
    orderBy: { createdAt: 'desc' },
  });
  return keys.map(toApiKeyView);
}

export async function revokeApiKey(organizationId: string, apiKeyId: string) {
  const result = await prisma.organizationApiKey.updateMany({
    where: { id: apiKeyId, organizationId: requireOrgId(organizationId), revokedAt: null },
    data: { revokedAt: new Date() },
  });
  if (result.count !== 1) throw createError('API key not found', 404);
}

/** Resolves an API key to its organization. Returns null for unknown, revoked or wrong-scope keys. */
export async function resolveApiKey(rawKey: string | undefined, scope: string): Promise<{ id: string; organizationId: string } | null> {
  if (!rawKey || !rawKey.startsWith(API_KEY_PREFIX) || rawKey.length > 200) return null;
  const record = await prisma.organizationApiKey.findUnique({ where: { keyHash: hashToken(rawKey) } });
  if (!record || record.revokedAt || record.scope !== scope) return null;
  await prisma.organizationApiKey.update({ where: { id: record.id }, data: { lastUsedAt: new Date() } });
  return { id: record.id, organizationId: record.organizationId };
}
