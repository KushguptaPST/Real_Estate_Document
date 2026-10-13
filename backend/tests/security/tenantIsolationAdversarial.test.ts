import request from 'supertest';
import { createApp } from '../../src/app.js';
import { PrismaClient } from '@prisma/client';
import { createMemberSession, deleteOrgUsers } from '../helpers/auth.js';

const app = createApp();
const prisma = new PrismaClient();

describe('Phase 33 Adversarial Multi-Tenant Isolation & Parameter Injection Matrix', () => {
  let orgA: any;
  let orgB: any;
  let tokenA: string;
  let tokenB: string;
  let leadB: any;
  let propertyB: any;
  let dealB: any;
  let taskB: any;
  let docB: any;

  beforeAll(async () => {
    // Provision Org A & Org B
    orgA = await prisma.organization.create({ data: { name: 'Adversarial Org A' } });
    orgB = await prisma.organization.create({ data: { name: 'Adversarial Org B Target' } });

    tokenA = (await createMemberSession(orgA.id, { role: 'OWNER' })).token;
    tokenB = (await createMemberSession(orgB.id, { role: 'OWNER' })).token;

    // Create Victim Resources in Org B
    leadB = await prisma.lead.create({
      data: {
        fullName: 'Victim Customer B',
        email: 'victim.b@example.com',
        organizationId: orgB.id,
      },
    });

    propertyB = await prisma.property.create({
      data: {
        title: 'Victim Private Property B',
        price: 2500000,
        bedrooms: 5,
        bathrooms: 4,
        propertyType: 'SINGLE_FAMILY',
        city: 'Beverly Hills',
        address: '90210 Secret Way',
        organizationId: orgB.id,
      },
    });

    dealB = await prisma.deal.create({
      data: {
        organizationId: orgB.id,
        propertyAddress: '90210 Secret Way',
        buyerName: 'Victim Buyer B',
        status: 'ACTIVE',
      },
    });

    taskB = await prisma.transactionTask.create({
      data: {
        dealId: dealB.id,
        organizationId: orgB.id,
        title: 'Confidential Wire Transfer',
        description: 'Financing obligation',
        status: 'PENDING',
        amount: 500000,
        dueDate: new Date(),
      },
    });

    docB = await prisma.document.create({
      data: {
        organizationId: orgB.id,
        dealId: dealB.id,
        filename: 'secret_financials_b.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 2048,
        storagePath: '/uploads/secret_financials_b.pdf',
        chunks: {
          create: [
            {
              organizationId: orgB.id,
              dealId: dealB.id,
              pageNumber: 1,
              chunkIndex: 0,
              content: 'CONFIDENTIAL FINANCIAL ACCOUNT NUMBER: 9876543210',
              embedding: [0.9, 0.8, 0.7],
            },
          ],
        },
      },
    });
  });

  afterAll(async () => {
    await prisma.documentChunk.deleteMany({ where: { organizationId: orgB.id } });
    await prisma.document.deleteMany({ where: { organizationId: orgB.id } });
    await prisma.transactionTask.deleteMany({ where: { organizationId: orgB.id } });
    await prisma.deal.deleteMany({ where: { organizationId: orgB.id } });
    await prisma.property.deleteMany({ where: { organizationId: orgB.id } });
    await prisma.lead.deleteMany({ where: { organizationId: orgB.id } });
    await deleteOrgUsers([orgA.id, orgB.id]);
    await prisma.organization.deleteMany({ where: { id: { in: [orgA.id, orgB.id] } } });
    await prisma.$disconnect();
  });

  describe('Adversarial Parameter Injection & Token Precedence', () => {
    it('Body Injection: supplying orgB.id in POST body creates resource in orgA.id (token wins)', async () => {
      const res = await request(app)
        .post('/api/properties')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          title: 'Attempted Cross Tenant Creation',
          price: 1000000,
          bedrooms: 2,
          bathrooms: 2,
          propertyType: 'CONDO',
          city: 'SF',
          address: '100 Market St',
          organizationId: orgB.id, // Attacker sends Victim Org ID in body!
        });

      expect(res.status).toBe(201);
      // Verify DB record belongs to Org A, NOT Org B!
      const createdProp = await prisma.property.findUnique({ where: { id: res.body.id } });
      expect(createdProp?.organizationId).toBe(orgA.id);
      expect(createdProp?.organizationId).not.toBe(orgB.id);

      // Clean up test prop
      await prisma.property.delete({ where: { id: res.body.id } });
    });

    it('Query Injection: supplying ?organizationId=orgB.id in GET returns 404 / Org A data only', async () => {
      const res = await request(app)
        .get(`/api/leads?organizationId=${orgB.id}`)
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(200);
      const leadIds = res.body.map((l: any) => l.id);
      expect(leadIds).not.toContain(leadB.id);
    });

    it('Header Injection: X-Organization-Id header does not override token organizationId', async () => {
      const res = await request(app)
        .get(`/api/leads/${leadB.id}`)
        .set('Authorization', `Bearer ${tokenA}`)
        .set('X-Organization-Id', orgB.id);

      expect(res.status).toBe(404);
    });
  });

  describe('Cross-Tenant Operations Against Victim Org B Resources', () => {
    it('GET /api/leads/:id — 404 for Victim Lead', async () => {
      const res = await request(app)
        .get(`/api/leads/${leadB.id}`)
        .set('Authorization', `Bearer ${tokenA}`);
      expect(res.status).toBe(404);
    });

    it('PATCH /api/leads/:id — 404 for Victim Lead', async () => {
      const res = await request(app)
        .patch(`/api/leads/${leadB.id}`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ fullName: 'Hacked Name' });
      expect(res.status).toBe(404);
    });

    it('DELETE /api/leads/:id — 404 for Victim Lead', async () => {
      const res = await request(app)
        .delete(`/api/leads/${leadB.id}`)
        .set('Authorization', `Bearer ${tokenA}`);
      expect(res.status).toBe(404);
    });

    it('GET /api/properties/:id — 404 for Victim Property', async () => {
      const res = await request(app)
        .get(`/api/properties/${propertyB.id}`)
        .set('Authorization', `Bearer ${tokenA}`);
      expect(res.status).toBe(404);
    });

    it('GET /api/deals/:id/tasks — 404 for Victim Deal Tasks', async () => {
      const res = await request(app)
        .get(`/api/deals/${dealB.id}/tasks`)
        .set('Authorization', `Bearer ${tokenA}`);
      expect(res.status).toBe(404);
    });

    it('PATCH /api/deals/:id/tasks/:taskId — 404 for Victim Deal Task Update', async () => {
      const res = await request(app)
        .patch(`/api/deals/${dealB.id}/tasks/${taskB.id}`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ title: 'Malicious Obligation Wipe' });
      expect(res.status).toBe(404);
    });

    it('POST /api/knowledge/ask — Cannot retrieve Victim document text or citations', async () => {
      const res = await request(app)
        .post('/api/knowledge/ask')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ question: 'CONFIDENTIAL FINANCIAL ACCOUNT NUMBER' });

      expect(res.status).toBe(200);
      expect(res.body.answer).not.toContain('9876543210');
      if (res.body.citations) {
        const citationDocIds = res.body.citations.map((c: any) => c.documentId);
        expect(citationDocIds).not.toContain(docB.id);
      }
    });
  });
});
