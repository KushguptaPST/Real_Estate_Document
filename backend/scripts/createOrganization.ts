/**
 * Bootstrap an organization (invite-only onboarding).
 *
 *   npm run org:create -- --name "Acme Realty" --owner-email owner@acme.com
 *
 * Creates the organization and a one-time OWNER invitation, then prints the
 * invite link. The owner accepts it by signing in with Google using that email.
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { createOrganizationWithOwnerInvite } from '../src/services/organization.service.js';

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  const name = arg('name')?.trim();
  const ownerEmail = arg('owner-email')?.trim();
  if (!name || !ownerEmail || !/^[^@\s]+@[^@\s]+$/.test(ownerEmail)) {
    console.error('Usage: npm run org:create -- --name "<org name>" --owner-email <email>');
    process.exit(1);
  }

  const { organization, invitation, token } = await createOrganizationWithOwnerInvite(name, ownerEmail);
  const base = (process.env['APP_URL'] ?? process.env['CORS_ORIGIN'] ?? 'http://localhost:5173').split(',')[0]!.trim();
  console.log(`Organization: ${organization.name} (${organization.id})`);
  console.log(`Owner invite for ${invitation.email}, expires ${invitation.expiresAt.toISOString()}`);
  console.log(`Invite link (shown once): ${base.replace(/\/$/, '')}/login?invite=${encodeURIComponent(token)}`);
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  })
  .finally(() => new PrismaClient().$disconnect());
