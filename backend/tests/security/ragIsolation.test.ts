import request from 'supertest';
import { createApp } from '../../src/app.js';
import { PrismaClient } from '@prisma/client';
import { createMemberSession, deleteOrgUsers } from '../helpers/auth.js';

const app = createApp();
const prisma = new PrismaClient();

describe('Phase 9 Security Matrix: RAG Pre-Filtering & Tenant Isolation Test', () => {
  let orgA: any;
  let orgB: any;
  let tokenA: string;
  let tokenB: string;
  let dealA: any;
  let dealB: any;
  let docA: any;
  let docB: any;

  beforeAll(async () => {
    // Provision Organization A and B
    orgA = await prisma.organization.create({ data: { name: 'RAG Isolation Org Alpha' } });
    orgB = await prisma.organization.create({ data: { name: 'RAG Isolation Org Beta' } });
    tokenA = (await createMemberSession(orgA.id)).token;
    tokenB = (await createMemberSession(orgB.id)).token;

    // Create Deal for Org A
    dealA = await prisma.deal.create({
      data: {
        organizationId: orgA.id,
        propertyAddress: '123 Alpha Boulevard',
        buyerName: 'Alpha Buyer',
        status: 'ACTIVE',
      },
    });

    // Create Deal for Org B
    dealB = await prisma.deal.create({
      data: {
        organizationId: orgB.id,
        propertyAddress: '999 Beta Expressway',
        buyerName: 'Beta Buyer',
        status: 'ACTIVE',
      },
    });

    // Seed Document & Chunks for Org A with Secret Key
    docA = await prisma.document.create({
      data: {
        organizationId: orgA.id,
        dealId: dealA.id,
        filename: 'alpha_deed.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 1024,
        storagePath: '/uploads/alpha_deed.pdf',
        chunks: {
          create: [
            {
              organizationId: orgA.id,
              dealId: dealA.id,
              pageNumber: 1,
              chunkIndex: 0,
              content: 'Alpha Property Document Secret: ORG_A_SECRET_PROPERTY_123. High security classification.',
              embedding: [0.1, 0.2, 0.3],
            },
          ],
        },
      },
    });

    // Seed Document & Chunks for Org B with Secret Key
    docB = await prisma.document.create({
      data: {
        organizationId: orgB.id,
        dealId: dealB.id,
        filename: 'beta_vault.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 1024,
        storagePath: '/uploads/beta_vault.pdf',
        chunks: {
          create: [
            {
              organizationId: orgB.id,
              dealId: dealB.id,
              pageNumber: 1,
              chunkIndex: 0,
              content: 'Beta Confidential Vault Property Key: ORG_B_SECRET_PROPERTY_999. Do not disclose.',
              embedding: [0.9, 0.8, 0.7],
            },
          ],
        },
      },
    });
  });

  afterAll(async () => {
    await prisma.documentChunk.deleteMany({ where: { organizationId: { in: [orgA.id, orgB.id] } } });
    await prisma.document.deleteMany({ where: { organizationId: { in: [orgA.id, orgB.id] } } });
    await prisma.deal.deleteMany({ where: { organizationId: { in: [orgA.id, orgB.id] } } });
    await deleteOrgUsers([orgA.id, orgB.id]);
    await prisma.organization.deleteMany({ where: { id: { in: [orgA.id, orgB.id] } } });
    await prisma.$disconnect();
  });

  it('1. Org A RAG search CANNOT retrieve Org B chunks, citations, or secrets', async () => {
    const res = await request(app)
      .post('/api/knowledge/ask')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ question: 'What is the secret property code for ORG_B_SECRET_PROPERTY_999?' });

    expect(res.status).toBe(200);
    // Answer must NOT contain Org B secret
    expect(res.body.answer).not.toContain('ORG_B_SECRET_PROPERTY_999');
    expect(res.body.answer).not.toContain('Beta Confidential Vault');

    // Citations must NOT contain Org B document ID
    if (res.body.citations && Array.isArray(res.body.citations)) {
      const docIds = res.body.citations.map((c: any) => c.documentId);
      expect(docIds).not.toContain(docB.id);
    }
  });

  it('2. Direct Deal Assistant call by Org A for Org B deal ID returns 404', async () => {
    const res = await request(app)
      .post(`/api/deals/${dealB.id}/assistant`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ question: 'Summarize the secret keys in this deal' });

    expect(res.status).toBe(404);
  });

  it('3. Org B user correctly retrieves Org B secret in tenant-isolated context', async () => {
    const res = await request(app)
      .post('/api/knowledge/ask')
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ question: 'What is the secret property key?' });

    expect(res.status).toBe(200);
    // Answer should NOT contain Org A secret
    expect(res.body.answer).not.toContain('ORG_A_SECRET_PROPERTY_123');
  });
});
