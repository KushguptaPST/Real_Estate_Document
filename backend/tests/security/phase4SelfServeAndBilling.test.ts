import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import { createApp } from '../../src/app.js';
import { verifyPassword } from '../../src/services/auth.service.js';

const app = createApp();
const prisma = new PrismaClient();

describe('Phase 2 — Self-Serve SaaS, Public Signup & Stripe Monetization', () => {
  const testEmail = `test.broker.${Date.now()}@pacificcoastluxury.com`;
  const testPassword = 'StrongPassword2026!';
  let createdOrgId: string;
  let sessionToken: string;

  afterAll(async () => {
    if (createdOrgId) {
      await prisma.user.deleteMany({ where: { organizationId: createdOrgId } });
      await prisma.organization.deleteMany({ where: { id: createdOrgId } });
    }
    await prisma.$disconnect();
  });

  describe('Self-Serve Organization Registration (POST /api/auth/register-org)', () => {
    it('rejects registration with invalid email or short password', async () => {
      const res = await request(app).post('/api/auth/register-org').send({
        ownerName: 'Marcus Vance',
        email: 'invalid-email',
        password: '123',
        organizationName: 'Pacific Coast Realty',
      });
      expect(res.status).toBe(400);
    });

    it('atomically provisions organization and owner user with OWNER role', async () => {
      const res = await request(app).post('/api/auth/register-org').send({
        ownerName: 'Marcus Vance',
        email: testEmail,
        password: testPassword,
        organizationName: 'Pacific Coast Luxury Realty',
        stateJurisdiction: 'CA',
        planTier: 'SOLO',
      });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('token');
      expect(res.body).toHaveProperty('user');
      expect(res.body.user.role).toBe('OWNER');
      expect(res.body.user.email).toBe(testEmail);
      expect(res.body.organization.stateJurisdiction).toBe('CA');
      expect(res.body.organization.subscriptionTier).toBe('SOLO');

      createdOrgId = res.body.organization.id;
      sessionToken = res.body.token;

      // Verify user password was hashed securely in DB
      const dbUser = await prisma.user.findUnique({ where: { email: testEmail } });
      expect(dbUser).not.toBeNull();
      expect(dbUser!.passwordHash).not.toBe(testPassword);
      expect(verifyPassword(testPassword, dbUser!.passwordHash!)).toBe(true);
    });

    it('rejects duplicate registration with same email', async () => {
      const res = await request(app).post('/api/auth/register-org').send({
        ownerName: 'Marcus Vance',
        email: testEmail,
        password: testPassword,
        organizationName: 'Duplicate Realty',
      });
      expect(res.status).toBe(409);
    });
  });

  describe('Password Sign In (POST /api/auth/login)', () => {
    it('rejects incorrect password', async () => {
      const res = await request(app).post('/api/auth/login').send({
        email: testEmail,
        password: 'WrongPassword!',
      });
      expect(res.status).toBe(401);
    });

    it('authenticates with correct password and issues session token', async () => {
      const res = await request(app).post('/api/auth/login').send({
        email: testEmail,
        password: testPassword,
      });
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('token');
      expect(res.body.user.email).toBe(testEmail);
      expect(res.body.user.role).toBe('OWNER');
    });
  });

  describe('Billing & Subscription Status (GET /api/billing/subscription)', () => {
    it('requires authentication', async () => {
      const res = await request(app).get('/api/billing/subscription');
      expect(res.status).toBe(401);
    });

    it('returns subscription details and usage limits for authenticated organization', async () => {
      const res = await request(app)
        .get('/api/billing/subscription')
        .set('Authorization', `Bearer ${sessionToken}`);

      expect(res.status).toBe(200);
      expect(res.body.organizationId).toBe(createdOrgId);
      expect(res.body.tier).toBe('SOLO');
      expect(res.body.status).toBe('ACTIVE');
      expect(res.body.stateJurisdiction).toBe('CA');
      expect(res.body.planDetails.name).toBe('Solo Agent');
      expect(res.body.usage.seatsUsed).toBe(1);
      expect(res.body.usage.maxSeats).toBe(1);
    });
  });

  describe('Stripe Checkout Session (POST /api/billing/create-checkout-session)', () => {
    it('creates checkout session or sandbox fallback for upgrade', async () => {
      const res = await request(app)
        .post('/api/billing/create-checkout-session')
        .set('Authorization', `Bearer ${sessionToken}`)
        .send({
          plan: 'TEAM',
          isAnnual: true,
        });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('url');
    });
  });

  describe('Dev Mode Tier Upgrade (POST /api/billing/dev-upgrade)', () => {
    it('upgrades organization tier and reflects in subscription query', async () => {
      const upgradeRes = await request(app)
        .post('/api/billing/dev-upgrade')
        .set('Authorization', `Bearer ${sessionToken}`)
        .send({ plan: 'TEAM' });

      expect(upgradeRes.status).toBe(200);
      expect(upgradeRes.body.subscriptionTier).toBe('TEAM');

      const subRes = await request(app)
        .get('/api/billing/subscription')
        .set('Authorization', `Bearer ${sessionToken}`);

      expect(subRes.status).toBe(200);
      expect(subRes.body.tier).toBe('TEAM');
      expect(subRes.body.planDetails.name).toBe('Brokerage Team');
      expect(subRes.body.planDetails.maxDeals).toBeNull(); // Unlimited
      expect(subRes.body.planDetails.maxAgents).toBe(10);
    });
  });
});
