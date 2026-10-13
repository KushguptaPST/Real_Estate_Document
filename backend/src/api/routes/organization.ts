// ─────────────────────────────────────────────────────────────────────────────
// /api/org — Organization membership, invitations, roles and API keys
// ─────────────────────────────────────────────────────────────────────────────

import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler, createError } from '../../middleware/errorHandler.js';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import {
  listMembers,
  changeMemberRole,
  removeMember,
  createInvitation,
  listInvitations,
  revokeInvitation,
  createApiKey,
  listApiKeys,
  revokeApiKey,
} from '../../services/organization.service.js';

const router = Router();
router.use(requireAuth);

const InviteSchema = z.object({
  email: z.string().email().max(320),
  role: z.enum(['OWNER', 'AGENT']).default('AGENT'),
});

const RoleSchema = z.object({ role: z.enum(['OWNER', 'AGENT']) });
const ApiKeySchema = z.object({ name: z.string().trim().min(1).max(100) });

function inviteUrl(token: string): string {
  const base = (process.env['APP_URL'] ?? process.env['CORS_ORIGIN'] ?? 'http://localhost:5173').split(',')[0]!.trim();
  return `${base.replace(/\/$/, '')}/login?invite=${encodeURIComponent(token)}`;
}

// ── Members ───────────────────────────────────────────────────────────────────
router.get(
  '/members',
  asyncHandler(async (req, res) => {
    res.json(await listMembers(req.user!.organizationId));
  }),
);

router.patch(
  '/members/:userId/role',
  requireRole('OWNER'),
  asyncHandler(async (req, res) => {
    const parsed = RoleSchema.safeParse(req.body);
    if (!parsed.success) throw createError('Invalid role', 422);
    const updated = await changeMemberRole({
      organizationId: req.user!.organizationId,
      actorId: req.user!.id,
      userId: req.params['userId']!,
      role: parsed.data.role,
    });
    res.json(updated);
  }),
);

router.delete(
  '/members/:userId',
  requireRole('OWNER'),
  asyncHandler(async (req, res) => {
    await removeMember({ organizationId: req.user!.organizationId, userId: req.params['userId']! });
    res.status(204).end();
  }),
);

// ── Invitations (OWNER only) ──────────────────────────────────────────────────
router.get(
  '/invitations',
  requireRole('OWNER'),
  asyncHandler(async (req, res) => {
    res.json(await listInvitations(req.user!.organizationId));
  }),
);

router.post(
  '/invitations',
  requireRole('OWNER'),
  asyncHandler(async (req, res) => {
    const parsed = InviteSchema.safeParse(req.body);
    if (!parsed.success) throw createError('A valid email address is required', 422);
    const { invitation, token } = await createInvitation({
      organizationId: req.user!.organizationId,
      email: parsed.data.email,
      role: parsed.data.role,
      invitedById: req.user!.id,
    });
    // The token is shown exactly once; only its hash is stored. No email is sent in this phase.
    res.status(201).json({ invitation, inviteUrl: inviteUrl(token) });
  }),
);

router.delete(
  '/invitations/:invitationId',
  requireRole('OWNER'),
  asyncHandler(async (req, res) => {
    await revokeInvitation(req.user!.organizationId, req.params['invitationId']!);
    res.status(204).end();
  }),
);

// ── Lead-intake API keys (OWNER only) ─────────────────────────────────────────
router.get(
  '/api-keys',
  requireRole('OWNER'),
  asyncHandler(async (req, res) => {
    res.json(await listApiKeys(req.user!.organizationId));
  }),
);

router.post(
  '/api-keys',
  requireRole('OWNER'),
  asyncHandler(async (req, res) => {
    const parsed = ApiKeySchema.safeParse(req.body);
    if (!parsed.success) throw createError('A key name is required', 422);
    const { apiKey, key } = await createApiKey({
      organizationId: req.user!.organizationId,
      name: parsed.data.name,
      createdById: req.user!.id,
    });
    res.status(201).json({ apiKey, key });
  }),
);

router.delete(
  '/api-keys/:apiKeyId',
  requireRole('OWNER'),
  asyncHandler(async (req, res) => {
    await revokeApiKey(req.user!.organizationId, req.params['apiKeyId']!);
    res.status(204).end();
  }),
);

export default router;
