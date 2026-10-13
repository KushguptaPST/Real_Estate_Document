import request from 'supertest';
import { createApp } from '../../src/app.js';
import { PrismaClient } from '@prisma/client';
import { createMemberSession, deleteOrgUsers } from '../helpers/auth.js';

const app = createApp();
const prisma = new PrismaClient();

describe('Phase 33 Security Matrix: Multi-Tenant Isolation Tests', () => {
  let orgA: any;
  let orgB: any;
  let tokenA: string;
  let tokenB: string;
  let leadA: any;
  let leadB: any;

  beforeAll(async () => {
    // Provision Organization A
    orgA = await prisma.organization.create({
      data: { name: 'Tenant Alpha Brokerage' },
    });

    // Provision Organization B
    orgB = await prisma.organization.create({
      data: { name: 'Tenant Beta Brokerage' },
    });

    tokenA = (await createMemberSession(orgA.id)).token;

    tokenB = (await createMemberSession(orgB.id)).token;

    // Create Lead for Org A
    leadA = await prisma.lead.create({
      data: {
        fullName: 'Client Alpha',
        email: 'alpha.client@example.com',
        organizationId: orgA.id,
      },
    });

    // Create Lead for Org B
    leadB = await prisma.lead.create({
      data: {
        fullName: 'Client Beta',
        email: 'beta.client@example.com',
        organizationId: orgB.id,
      },
    });
  });

  afterAll(async () => {
    await prisma.lead.deleteMany({ where: { id: { in: [leadA.id, leadB.id] } } });
    await deleteOrgUsers([orgA.id, orgB.id]);
    await prisma.organization.deleteMany({ where: { id: { in: [orgA.id, orgB.id] } } });
    await prisma.$disconnect();
  });

  it('Organization A receives ONLY its own leads in GET /api/leads', async () => {
    const res = await request(app)
      .get('/api/leads')
      .set('Authorization', `Bearer ${tokenA}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    const leadIds = res.body.map((l: any) => l.id);
    expect(leadIds).toContain(leadA.id);
    expect(leadIds).not.toContain(leadB.id);
  });

  it('Organization A CANNOT access Lead B via GET /api/leads/:id', async () => {
    const res = await request(app)
      .get(`/api/leads/${leadB.id}`)
      .set('Authorization', `Bearer ${tokenA}`);

    expect(res.status).toBe(404);
  });

  it('Organization A CANNOT update Lead B via PATCH /api/leads/:id', async () => {
    const res = await request(app)
      .patch(`/api/leads/${leadB.id}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ fullName: 'Malicious Rename' });

    expect(res.status).toBe(404);
  });

  it('Organization A CANNOT access Lead B conversations', async () => {
    const res = await request(app)
      .get(`/api/leads/${leadB.id}/conversations`)
      .set('Authorization', `Bearer ${tokenA}`);

    expect(res.status).toBe(404);
  });
});
