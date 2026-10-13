import crypto from 'node:crypto';
import { type UserRole } from '@prisma/client';
import { prisma } from '../../src/utils/prisma.js';
import { signSessionToken } from '../../src/services/auth.service.js';


/**
 * Creates a real user in `organizationId` and returns a session token issued by
 * the production signer. Tokens are only valid for users that exist in the DB.
 */
export async function createMemberSession(organizationId: string, opts: { role?: UserRole; email?: string } = {}) {
  const suffix = crypto.randomBytes(6).toString('hex');
  const email = opts.email ?? `member.${suffix}@test.local`;
  const user = await prisma.user.create({
    data: {
      googleId: `test-google-${suffix}`,
      email: email.replace('@', `+${suffix}@`),
      name: `Test ${opts.role ?? 'AGENT'} ${suffix}`,
      organizationId,
      role: opts.role ?? 'AGENT',
    },
  });
  const { token } = signSessionToken(user);
  return { user, token };
}

/**
 * Deletes rows whose organization FK is ON DELETE SET NULL (users, leads, properties)
 * so test runs do not leave orphaned rows behind once the organization is deleted.
 */
export async function deleteOrgUsers(organizationIds: string[]) {
  const scope = { organizationId: { in: organizationIds } };
  await prisma.conversationThread.deleteMany({ where: scope });
  await prisma.lead.deleteMany({ where: scope });
  await prisma.property.deleteMany({ where: scope });
  await prisma.user.deleteMany({ where: scope });
}

/** Issues a lead-intake API key for the organization through the production code path. */
export async function createIntakeKey(organizationId: string, createdById = 'test-suite') {
  const { createApiKey } = await import('../../src/services/organization.service.js');
  const { key } = await createApiKey({ organizationId, name: 'test key', createdById });
  return key;
}
