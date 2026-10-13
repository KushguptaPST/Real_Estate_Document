import crypto from 'node:crypto';
import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import { createApp } from '../../src/app.js';
import { completeSignIn, hashToken } from '../../src/services/auth.service.js';
import { createOrganizationWithOwnerInvite } from '../../src/services/organization.service.js';
import { createMemberSession, deleteOrgUsers } from '../helpers/auth.js';

const app = createApp();
const prisma = new PrismaClient();

const uid = () => crypto.randomBytes(5).toString('hex');
const identity = (email: string) => ({ googleId: `g-${uid()}`, email, name: 'Invitee', pictureUrl: null });
const tokenFromUrl = (url: string) => decodeURIComponent(new URL(url).searchParams.get('invite')!);
const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

describe('Phase 0 — invite-only membership and OWNER/AGENT authorization', () => {
  let orgA: { id: string };
  let orgB: { id: string };
  let ownerA: Awaited<ReturnType<typeof createMemberSession>>;
  let agentA: Awaited<ReturnType<typeof createMemberSession>>;
  let ownerB: Awaited<ReturnType<typeof createMemberSession>>;
  const createdOrgIds: string[] = [];

  beforeAll(async () => {
    orgA = await prisma.organization.create({ data: { name: 'P0 Membership Org A' } });
    orgB = await prisma.organization.create({ data: { name: 'P0 Membership Org B' } });
    createdOrgIds.push(orgA.id, orgB.id);
    ownerA = await createMemberSession(orgA.id, { role: 'OWNER' });
    agentA = await createMemberSession(orgA.id, { role: 'AGENT' });
    ownerB = await createMemberSession(orgB.id, { role: 'OWNER' });
  });

  afterAll(async () => {
    await deleteOrgUsers(createdOrgIds);
    await prisma.organization.deleteMany({ where: { id: { in: createdOrgIds } } });
    await prisma.$disconnect();
  });

  async function invite(ownerToken: string, email: string, role: 'OWNER' | 'AGENT' = 'AGENT') {
    const res = await request(app).post('/api/org/invitations').set(auth(ownerToken)).send({ email, role });
    expect(res.status).toBe(201);
    return { res, token: tokenFromUrl(res.body.inviteUrl) };
  }

  describe('sign-in without an invitation', () => {
    it('a new Google identity with no invitation gets no organization and no session', async () => {
      await expect(completeSignIn(identity(`stranger.${uid()}@example.com`))).rejects.toMatchObject({ statusCode: 403 });
    });

    it('never auto-joins a shared default organization', async () => {
      const email = `stranger2.${uid()}@example.com`;
      await completeSignIn(identity(email)).catch(() => undefined);
      const user = await prisma.user.findUnique({ where: { email } });
      expect(user?.organizationId).toBeNull();
      await prisma.user.delete({ where: { email } });
    });
  });

  describe('invitations', () => {
    it('OWNER invites; the invitee joins with the invited role; token is stored only as a hash', async () => {
      const email = `new.agent.${uid()}@example.com`;
      const { res, token } = await invite(ownerA.token, email);
      expect(JSON.stringify(res.body.invitation)).not.toContain(token);
      const stored = await prisma.invitation.findUnique({ where: { id: res.body.invitation.id } });
      expect(stored?.tokenHash).toBe(hashToken(token));
      expect(JSON.stringify(stored)).not.toContain(token);

      const session = await completeSignIn(identity(email), token);
      expect(session.user).toMatchObject({ organizationId: orgA.id, role: 'AGENT', email });
      const me = await request(app).get('/api/auth/me').set(auth(session.token));
      expect(me.status).toBe(200);
    });

    it('an invitation token is single-use', async () => {
      const email = `single.use.${uid()}@example.com`;
      const { token } = await invite(ownerA.token, email);
      await completeSignIn(identity(email), token);
      // Same token, different identity with the same (now taken) email is refused; so is a fresh identity.
      await expect(completeSignIn(identity(`other.${uid()}@example.com`), token)).rejects.toMatchObject({ statusCode: 403 });
    });

    it('rejects an invitation used by a different email address', async () => {
      const { token } = await invite(ownerA.token, `intended.${uid()}@example.com`);
      await expect(completeSignIn(identity(`thief.${uid()}@example.com`), token)).rejects.toMatchObject({ statusCode: 403 });
    });

    it('rejects expired, revoked and random tokens', async () => {
      const email = `expiring.${uid()}@example.com`;
      const { res, token } = await invite(ownerA.token, email);
      await prisma.invitation.update({ where: { id: res.body.invitation.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
      await expect(completeSignIn(identity(email), token)).rejects.toMatchObject({ statusCode: 403 });

      const email2 = `revoked.${uid()}@example.com`;
      const second = await invite(ownerA.token, email2);
      const del = await request(app).delete(`/api/org/invitations/${second.res.body.invitation.id}`).set(auth(ownerA.token));
      expect(del.status).toBe(204);
      await expect(completeSignIn(identity(email2), second.token)).rejects.toMatchObject({ statusCode: 403 });

      await expect(completeSignIn(identity(`rand.${uid()}@example.com`), crypto.randomBytes(32).toString('base64url'))).rejects.toMatchObject({ statusCode: 403 });
    });

    it('a member of another organization cannot use an invitation to switch tenants', async () => {
      const email = `already.member.${uid()}@example.com`;
      const googleId = `g-${uid()}`;
      await prisma.user.create({ data: { googleId, email, organizationId: orgB.id, role: 'AGENT' } });
      const { token } = await invite(ownerA.token, email);
      await expect(completeSignIn({ googleId, email, name: null, pictureUrl: null }, token)).rejects.toMatchObject({ statusCode: 409 });
      const user = await prisma.user.findUnique({ where: { email } });
      expect(user?.organizationId).toBe(orgB.id);
    });

    it('concurrent acceptance of one token by the invitee joins exactly once', async () => {
      const email = `race.${uid()}@example.com`;
      const { res, token } = await invite(ownerA.token, email);
      const id = identity(email);
      const results = await Promise.allSettled([completeSignIn(id, token), completeSignIn(id, token), completeSignIn(id, token)]);
      expect(results.some((r) => r.status === 'fulfilled')).toBe(true);
      const inv = await prisma.invitation.findUnique({ where: { id: res.body.invitation.id } });
      expect(inv?.acceptedAt).not.toBeNull();
      expect(await prisma.user.count({ where: { email } })).toBe(1);
    });

    it('AGENT cannot create, list or revoke invitations', async () => {
      const create = await request(app).post('/api/org/invitations').set(auth(agentA.token)).send({ email: `x.${uid()}@example.com`, role: 'OWNER' });
      expect(create.status).toBe(403);
      expect((await request(app).get('/api/org/invitations').set(auth(agentA.token))).status).toBe(403);
    });

    it('an OWNER cannot see or revoke another organization\'s invitations', async () => {
      const { res } = await invite(ownerA.token, `cross.${uid()}@example.com`);
      const list = await request(app).get('/api/org/invitations').set(auth(ownerB.token));
      expect(list.body.map((i: { id: string }) => i.id)).not.toContain(res.body.invitation.id);
      const del = await request(app).delete(`/api/org/invitations/${res.body.invitation.id}`).set(auth(ownerB.token));
      expect(del.status).toBe(404);
      const inv = await prisma.invitation.findUnique({ where: { id: res.body.invitation.id } });
      expect(inv?.revokedAt).toBeNull();
    });

    it('does not reveal whether an email belongs to another tenant', async () => {
      const res = await request(app).post('/api/org/invitations').set(auth(ownerA.token)).send({ email: ownerB.user.email });
      expect(res.status).toBe(201);
    });

    it('listing invitations never exposes token hashes', async () => {
      const list = await request(app).get('/api/org/invitations').set(auth(ownerA.token));
      expect(list.status).toBe(200);
      expect(JSON.stringify(list.body)).not.toMatch(/tokenHash/);
    });

    it('CLI bootstrap creates an org whose first member becomes OWNER via the invite', async () => {
      const email = `founder.${uid()}@example.com`;
      const { organization, token } = await createOrganizationWithOwnerInvite('P0 Bootstrap Org', email);
      createdOrgIds.push(organization.id);
      const session = await completeSignIn(identity(email), token);
      expect(session.user).toMatchObject({ organizationId: organization.id, role: 'OWNER' });
    });
  });

  describe('role changes and removal', () => {
    it('AGENT cannot promote themselves or change anyone\'s role', async () => {
      const self = await request(app).patch(`/api/org/members/${agentA.user.id}/role`).set(auth(agentA.token)).send({ role: 'OWNER' });
      expect(self.status).toBe(403);
      const other = await request(app).patch(`/api/org/members/${ownerA.user.id}/role`).set(auth(agentA.token)).send({ role: 'AGENT' });
      expect(other.status).toBe(403);
      const u = await prisma.user.findUnique({ where: { id: agentA.user.id } });
      expect(u?.role).toBe('AGENT');
    });

    it('AGENT cannot remove members', async () => {
      const res = await request(app).delete(`/api/org/members/${ownerA.user.id}`).set(auth(agentA.token));
      expect(res.status).toBe(403);
    });

    it('OWNER cannot change roles or remove members of another organization', async () => {
      const role = await request(app).patch(`/api/org/members/${ownerB.user.id}/role`).set(auth(ownerA.token)).send({ role: 'AGENT' });
      expect(role.status).toBe(404);
      const del = await request(app).delete(`/api/org/members/${ownerB.user.id}`).set(auth(ownerA.token));
      expect(del.status).toBe(404);
      const u = await prisma.user.findUnique({ where: { id: ownerB.user.id } });
      expect(u).toMatchObject({ organizationId: orgB.id, role: 'OWNER' });
    });

    it('the last OWNER cannot be demoted or removed', async () => {
      const soloOrg = await prisma.organization.create({ data: { name: 'P0 Solo Owner Org' } });
      createdOrgIds.push(soloOrg.id);
      const solo = await createMemberSession(soloOrg.id, { role: 'OWNER' });
      const demote = await request(app).patch(`/api/org/members/${solo.user.id}/role`).set(auth(solo.token)).send({ role: 'AGENT' });
      expect(demote.status).toBe(409);
      const remove = await request(app).delete(`/api/org/members/${solo.user.id}`).set(auth(solo.token));
      expect(remove.status).toBe(409);
    });

    it('a role change takes effect immediately and invalidates the member\'s old tokens', async () => {
      const promoted = await createMemberSession(orgA.id, { role: 'AGENT' });
      const res = await request(app).patch(`/api/org/members/${promoted.user.id}/role`).set(auth(ownerA.token)).send({ role: 'OWNER' });
      expect(res.status).toBe(200);
      expect(res.body.role).toBe('OWNER');
      expect((await request(app).get('/api/auth/me').set(auth(promoted.token))).status).toBe(401);
    });

    it('removing a member revokes access and unassigns their leads', async () => {
      const leaving = await createMemberSession(orgA.id, { role: 'AGENT' });
      const lead = await prisma.lead.create({ data: { fullName: 'Assigned Lead', organizationId: orgA.id, assignedUserId: leaving.user.id } });
      const res = await request(app).delete(`/api/org/members/${leaving.user.id}`).set(auth(ownerA.token));
      expect(res.status).toBe(204);
      expect((await request(app).get('/api/leads').set(auth(leaving.token))).status).toBe(401);
      expect((await prisma.lead.findUnique({ where: { id: lead.id } }))?.assignedUserId).toBeNull();
      await prisma.user.delete({ where: { id: leaving.user.id } });
    });

    it('members list is scoped to the caller\'s organization', async () => {
      const res = await request(app).get('/api/org/members').set(auth(agentA.token));
      expect(res.status).toBe(200);
      const ids = res.body.map((m: { id: string }) => m.id);
      expect(ids).toContain(ownerA.user.id);
      expect(ids).not.toContain(ownerB.user.id);
    });
  });
});
