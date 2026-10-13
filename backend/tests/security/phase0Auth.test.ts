import request from 'supertest';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { createApp } from '../../src/app.js';
import { assertSecurityConfig, getJwtSecret } from '../../src/services/auth.service.js';
import { createMemberSession, deleteOrgUsers } from '../helpers/auth.js';

const app = createApp();
const prisma = new PrismaClient();
const SECRET = process.env['JWT_SECRET']!;
const SIGN_OPTS = { algorithm: 'HS256' as const, issuer: 'contingency-copilot', audience: 'contingency-copilot-api' };

describe('Phase 0 — session tokens, JWT configuration and demo login', () => {
  let orgA: { id: string };
  let orgB: { id: string };
  let member: Awaited<ReturnType<typeof createMemberSession>>;
  let leadB: { id: string };

  beforeAll(async () => {
    orgA = await prisma.organization.create({ data: { name: 'P0 Auth Org A' } });
    orgB = await prisma.organization.create({ data: { name: 'P0 Auth Org B' } });
    member = await createMemberSession(orgA.id);
    leadB = await prisma.lead.create({ data: { fullName: 'Org B Secret Lead', organizationId: orgB.id } });
  });

  afterAll(async () => {
    await deleteOrgUsers([orgA.id, orgB.id, 'demo-sandbox-org']);
    await prisma.organization.deleteMany({ where: { id: { in: [orgA.id, orgB.id, 'demo-sandbox-org'] } } });
    await prisma.$disconnect();
  });

  const get = (token?: string) => {
    const r = request(app).get('/api/leads');
    return token ? r.set('Authorization', `Bearer ${token}`) : r;
  };

  describe('forged and invalid tokens', () => {
    it('accepts a token issued by the server for an existing member', async () => {
      const res = await get(member.token);
      expect(res.status).toBe(200);
    });

    it('rejects requests with no token', async () => {
      expect((await get()).status).toBe(401);
    });

    it('rejects a token signed with a different secret', async () => {
      const forged = jwt.sign({ sub: member.user.id, org: orgA.id, role: 'OWNER', sv: 0 }, 'x'.repeat(64), SIGN_OPTS);
      expect((await get(forged)).status).toBe(401);
    });

    it('rejects a token signed with the old hardcoded fallback secret', async () => {
      const forged = jwt.sign(
        { id: member.user.id, email: member.user.email, organizationId: orgB.id },
        'development-fallback-secret-2026',
      );
      expect((await get(forged)).status).toBe(401);
    });

    it('rejects an unsigned (alg=none) token', async () => {
      const forged = jwt.sign({ sub: member.user.id, org: orgA.id, role: 'OWNER', sv: 0 }, '', {
        algorithm: 'none',
        issuer: SIGN_OPTS.issuer,
        audience: SIGN_OPTS.audience,
      });
      expect((await get(forged)).status).toBe(401);
    });

    it('rejects a token using a non-pinned algorithm even with the right secret', async () => {
      const forged = jwt.sign({ sub: member.user.id, org: orgA.id, role: 'AGENT', sv: 0 }, SECRET, {
        ...SIGN_OPTS,
        algorithm: 'HS512',
      });
      expect((await get(forged)).status).toBe(401);
    });

    it('rejects a legacy-shaped token (no issuer/audience) signed with the real secret', async () => {
      const legacy = jwt.sign({ id: member.user.id, email: member.user.email, organizationId: orgA.id }, SECRET);
      expect((await get(legacy)).status).toBe(401);
    });

    it('rejects an expired token', async () => {
      const expired = jwt.sign({ sub: member.user.id, org: orgA.id, role: 'AGENT', sv: 0 }, SECRET, {
        ...SIGN_OPTS,
        expiresIn: -10,
      });
      expect((await get(expired)).status).toBe(401);
    });

    it('rejects a correctly signed token whose org claim points at another tenant', async () => {
      const crossTenant = jwt.sign({ sub: member.user.id, org: orgB.id, role: 'OWNER', sv: 0 }, SECRET, SIGN_OPTS);
      const res = await request(app).get(`/api/leads/${leadB.id}`).set('Authorization', `Bearer ${crossTenant}`);
      expect(res.status).toBe(401);
      expect(JSON.stringify(res.body)).not.toContain('Org B Secret Lead');
    });

    it('takes the role from the database, not from the token claim', async () => {
      const inflated = jwt.sign({ sub: member.user.id, org: orgA.id, role: 'OWNER', sv: 0 }, SECRET, SIGN_OPTS);
      const res = await request(app)
        .post('/api/org/invitations')
        .set('Authorization', `Bearer ${inflated}`)
        .send({ email: 'someone@example.com' });
      expect(res.status).toBe(403);
    });

    it('rejects a token for a user that no longer exists', async () => {
      const ghost = await createMemberSession(orgA.id);
      await prisma.user.delete({ where: { id: ghost.user.id } });
      expect((await get(ghost.token)).status).toBe(401);
    });

    it('rejects previously issued tokens after the session version is bumped', async () => {
      const victim = await createMemberSession(orgA.id);
      expect((await get(victim.token)).status).toBe(200);
      await prisma.user.update({ where: { id: victim.user.id }, data: { sessionVersion: { increment: 1 } } });
      expect((await get(victim.token)).status).toBe(401);
    });

    it('GET /api/auth/me returns the database role and organization', async () => {
      const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${member.token}`);
      expect(res.status).toBe(200);
      expect(res.body.user).toMatchObject({ id: member.user.id, organizationId: orgA.id, role: 'AGENT' });
    });
  });

  describe('JWT secret configuration', () => {
    const original = process.env['JWT_SECRET'];
    afterEach(() => {
      process.env['JWT_SECRET'] = original;
      process.env['NODE_ENV'] = 'test';
      process.env['ENABLE_DEMO_LOGIN'] = 'false';
    });

    it('refuses to start without JWT_SECRET', () => {
      delete process.env['JWT_SECRET'];
      expect(() => assertSecurityConfig()).toThrow(/JWT_SECRET/);
    });

    it('refuses a short secret and the old fallback secret', () => {
      process.env['JWT_SECRET'] = 'short';
      expect(() => assertSecurityConfig()).toThrow(/JWT_SECRET/);
      process.env['JWT_SECRET'] = 'development-fallback-secret-2026';
      expect(() => assertSecurityConfig()).toThrow(/JWT_SECRET/);
    });

    it('never signs or verifies with a fallback when the secret is missing', async () => {
      delete process.env['JWT_SECRET'];
      expect(() => getJwtSecret()).toThrow();
      const res = await get(member.token);
      expect(res.status).toBe(500);
      expect(res.body.error.message).toBe('Internal server error');
    });

    it('refuses to start in production with demo login enabled', () => {
      process.env['NODE_ENV'] = 'production';
      process.env['ENABLE_DEMO_LOGIN'] = 'true';
      expect(() => assertSecurityConfig()).toThrow(/ENABLE_DEMO_LOGIN/);
    });
  });

  describe('demo login gate', () => {
    afterEach(() => {
      process.env['NODE_ENV'] = 'test';
      process.env['ENABLE_DEMO_LOGIN'] = 'false';
    });

    it('is disabled by default (404)', async () => {
      const res = await request(app).post('/api/auth/demo');
      expect(res.status).toBe(404);
      expect(res.body.token).toBeUndefined();
    });

    it('stays disabled in production even when the flag is set', async () => {
      process.env['ENABLE_DEMO_LOGIN'] = 'true';
      process.env['NODE_ENV'] = 'production';
      const res = await request(app).post('/api/auth/demo');
      expect(res.status).toBe(404);
      expect(res.body.token).toBeUndefined();
    });

    it('when enabled outside production, lands in an isolated sandbox org with AGENT role', async () => {
      process.env['ENABLE_DEMO_LOGIN'] = 'true';
      const res = await request(app).post('/api/auth/demo');
      expect(res.status).toBe(200);
      expect(res.body.user.organizationId).toBe('demo-sandbox-org');
      expect(res.body.user.role).toBe('AGENT');

      const leads = await get(res.body.token);
      expect(leads.status).toBe(200);
      expect(leads.body.map((l: { id: string }) => l.id)).not.toContain(leadB.id);
    });

    it('reports the flag on /api/auth/config', async () => {
      const res = await request(app).get('/api/auth/config');
      expect(res.body).toEqual({ demoLoginEnabled: false });
    });
  });
});
