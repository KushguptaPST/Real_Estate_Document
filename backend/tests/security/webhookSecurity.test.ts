import request from 'supertest';
import crypto from 'crypto';
import { createApp } from '../../src/app.js';
import { PrismaClient } from '@prisma/client';
import { createIntakeKey, deleteOrgUsers } from '../helpers/auth.js';

const app = createApp();
const prisma = new PrismaClient();

describe('Phase 33 Security Matrix: Webhook Security & Idempotency Tests', () => {
  const secret = 'test-webhook-secret-key-2026';
  const originalSecret = process.env.WEBHOOK_SECRET;

  let org: any;
  let apiKey: string;

  beforeAll(async () => {
    process.env.WEBHOOK_SECRET = secret;
    org = await prisma.organization.create({ data: { name: 'Webhook Security Org' } });
    apiKey = await createIntakeKey(org.id);
  });

  afterAll(async () => {
    process.env.WEBHOOK_SECRET = originalSecret;
    await prisma.webhookEvent.deleteMany({ where: { organizationId: org.id } });
    await deleteOrgUsers([org.id]);
    await prisma.organization.delete({ where: { id: org.id } });
    await prisma.$disconnect();
  });

  function generateSignature(payloadStr: string, key: string = secret): string {
    return 'sha256=' + crypto.createHmac('sha256', key).update(payloadStr).digest('hex');
  }

  it('1. Accepts valid HMAC signature on webhook payload', async () => {
    const rawPayload = JSON.stringify({
      eventId: `evt-valid-${Date.now()}`,
      fromName: 'HMAC Valid Buyer',
      from: `hmac.valid.${Date.now()}@example.com`,
      body: 'Looking for a townhouse in Austin under $700k.',
    });

    const sig = generateSignature(rawPayload, secret);

    const res = await request(app)
      .post('/api/inbound/email')
      .set('Content-Type', 'application/json')
      .set('x-webhook-signature', sig)
      .set('X-Api-Key', apiKey)
      .send(rawPayload);

    expect([200, 202]).toContain(res.status);
    expect(res.body.received).toBe(true);
  });

  it('2. Rejects invalid HMAC signature with 401', async () => {
    const rawPayload = JSON.stringify({
      eventId: `evt-invalid-${Date.now()}`,
      fromName: 'Spoofed Buyer',
      from: 'spoofed@example.com',
      body: 'Malicious payload',
    });

    const res = await request(app)
      .post('/api/inbound/email')
      .set('Content-Type', 'application/json')
      .set('x-webhook-signature', 'sha256=invalid_fake_signature_hash')
      .set('X-Api-Key', apiKey)
      .send(rawPayload);

    expect(res.status).toBe(401);
  });

  it('3. Rejects modified payload (tampered body after signing)', async () => {
    const originalPayload = JSON.stringify({
      eventId: `evt-tamper-${Date.now()}`,
      fromName: 'Original Buyer',
      from: 'original@example.com',
      body: 'Original text',
    });

    const sig = generateSignature(originalPayload, secret);

    const tamperedPayload = JSON.stringify({
      eventId: `evt-tamper-${Date.now()}`,
      fromName: 'Original Buyer',
      from: 'original@example.com',
      body: 'TAMPERED TEXT BY MAN-IN-THE-MIDDLE',
    });

    const res = await request(app)
      .post('/api/inbound/email')
      .set('Content-Type', 'application/json')
      .set('x-webhook-signature', sig)
      .set('X-Api-Key', apiKey)
      .send(tamperedPayload);

    expect(res.status).toBe(401);
  });

  it('4. Handles duplicate external event ID idempotently (no duplicate processing)', async () => {
    const eventId = `evt-dup-${Date.now()}`;
    const rawPayload = JSON.stringify({
      eventId,
      fromName: 'Idempotency Buyer',
      from: `idempotency.${Date.now()}@example.com`,
      body: 'Looking for a condo',
    });

    const sig = generateSignature(rawPayload, secret);

    // Initial Delivery
    const res1 = await request(app)
      .post('/api/inbound/email')
      .set('Content-Type', 'application/json')
      .set('x-webhook-signature', sig)
      .set('X-Api-Key', apiKey)
      .send(rawPayload);

    expect([200, 202]).toContain(res1.status);

    // Replayed Duplicate Delivery
    const res2 = await request(app)
      .post('/api/inbound/email')
      .set('Content-Type', 'application/json')
      .set('x-webhook-signature', sig)
      .set('X-Api-Key', apiKey)
      .send(rawPayload);

    expect(res2.status).toBe(200);
    expect(res2.body.message).toBe('Duplicate event ignored');
  });

  it('5. Rejects unknown/unsupported provider route with 404', async () => {
    const res = await request(app)
      .post('/api/inbound/unknown_provider_xyz')
      .send({ test: true });

    expect(res.status).toBe(404);
  });
});
