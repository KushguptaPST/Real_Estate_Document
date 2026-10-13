import crypto from 'node:crypto';
import { readdirSync, existsSync, rmSync } from 'node:fs';
import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import { createApp } from '../../src/app.js';
import { createMemberSession, deleteOrgUsers, createIntakeKey } from '../helpers/auth.js';

const app = createApp();
const prisma = new PrismaClient();
const uid = () => crypto.randomBytes(5).toString('hex');
const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
const PDF = Buffer.from('%PDF-1.4\n1 0 obj << /Type /Catalog >> endobj\ntrailer << /Root 1 0 R >>\n%%EOF\n');

describe('Phase 0 — public lead intake (API keys) and inbound email webhook', () => {
  let orgA: { id: string };
  let orgB: { id: string };
  let ownerA: Awaited<ReturnType<typeof createMemberSession>>;
  let agentA: Awaited<ReturnType<typeof createMemberSession>>;
  let keyA: string;
  let keyB: string;

  beforeAll(async () => {
    orgA = await prisma.organization.create({ data: { name: 'P0 Intake Org A' } });
    orgB = await prisma.organization.create({ data: { name: 'P0 Intake Org B' } });
    ownerA = await createMemberSession(orgA.id, { role: 'OWNER' });
    agentA = await createMemberSession(orgA.id, { role: 'AGENT' });
    keyA = await createIntakeKey(orgA.id);
    keyB = await createIntakeKey(orgB.id);
  });

  afterAll(async () => {
    await prisma.webhookEvent.deleteMany({ where: { organizationId: { in: [orgA.id, orgB.id] } } });
    await prisma.document.deleteMany({ where: { organizationId: { in: [orgA.id, orgB.id] } } });
    await prisma.deal.deleteMany({ where: { organizationId: { in: [orgA.id, orgB.id] } } });
    await deleteOrgUsers([orgA.id, orgB.id]);
    await prisma.organization.deleteMany({ where: { id: { in: [orgA.id, orgB.id] } } });
    await prisma.$disconnect();
  });

  const intake = (body: object, key?: string) => {
    const r = request(app).post('/api/leads/inbound');
    return (key ? r.set('X-Api-Key', key) : r).send(body);
  };

  describe('POST /api/leads/inbound — API key misuse', () => {
    it('rejects requests with no API key', async () => {
      const res = await intake({ fullName: 'No Key', email: `nokey.${uid()}@example.com` });
      expect(res.status).toBe(401);
    });

    it('rejects unknown, malformed and session-token keys', async () => {
      expect((await intake({ fullName: 'X' }, `rek_${crypto.randomBytes(32).toString('base64url')}`)).status).toBe(401);
      expect((await intake({ fullName: 'X' }, 'not-a-key')).status).toBe(401);
      expect((await intake({ fullName: 'X' }, ownerA.token)).status).toBe(401);
    });

    it('rejects a revoked key', async () => {
      const created = await request(app).post('/api/org/api-keys').set(auth(ownerA.token)).send({ name: 'to revoke' });
      expect(created.status).toBe(201);
      expect((await intake({ fullName: 'Before Revoke', email: `rev.${uid()}@example.com` }, created.body.key)).status).toBe(202);
      const del = await request(app).delete(`/api/org/api-keys/${created.body.apiKey.id}`).set(auth(ownerA.token));
      expect(del.status).toBe(204);
      expect((await intake({ fullName: 'After Revoke' }, created.body.key)).status).toBe(401);
    });

    it('ignores organizationId in the body — the lead lands in the key\'s organization', async () => {
      const email = `inject.${uid()}@example.com`;
      const res = await intake({ fullName: 'Injected Org', email, organizationId: orgB.id }, keyA);
      expect(res.status).toBe(202);
      const leads = await prisma.lead.findMany({ where: { email } });
      expect(leads).toHaveLength(1);
      expect(leads[0]!.organizationId).toBe(orgA.id);
    });

    it('does not leak or overwrite another tenant\'s lead with the same email', async () => {
      const email = `victim.${uid()}@example.com`;
      const victim = await prisma.lead.create({
        data: { fullName: 'Victim Original Name', email, phone: '5550001111', organizationId: orgB.id },
      });
      await prisma.conversationThread.create({
        data: {
          leadId: victim.id,
          organizationId: orgB.id,
          messages: { create: { organizationId: orgB.id, senderType: 'CUSTOMER', content: 'B-ONLY-CONFIDENTIAL' } },
        },
      });

      const res = await intake({ fullName: 'Attacker Rename', email, phone: '5559999999' }, keyA);
      expect(res.status).toBe(202);
      expect(res.body).toEqual({ received: true });
      expect(JSON.stringify(res.body)).not.toContain('B-ONLY-CONFIDENTIAL');

      const after = await prisma.lead.findUnique({ where: { id: victim.id } });
      expect(after).toMatchObject({ fullName: 'Victim Original Name', phone: '5550001111', organizationId: orgB.id });
    });

    it('response is identical for new and existing leads (no existence oracle)', async () => {
      const email = `oracle.${uid()}@example.com`;
      const first = await intake({ fullName: 'Oracle', email }, keyA);
      const second = await intake({ fullName: 'Oracle', email }, keyA);
      expect(first.status).toBe(second.status);
      expect(first.body).toEqual(second.body);
    });

    it('only OWNER can create or list API keys; listing never returns secrets', async () => {
      expect((await request(app).post('/api/org/api-keys').set(auth(agentA.token)).send({ name: 'agent key' })).status).toBe(403);
      expect((await request(app).get('/api/org/api-keys').set(auth(agentA.token))).status).toBe(403);
      const list = await request(app).get('/api/org/api-keys').set(auth(ownerA.token));
      expect(list.status).toBe(200);
      const body = JSON.stringify(list.body);
      expect(body).not.toMatch(/keyHash/);
      expect(body).not.toContain(keyA);
    });

    it('an OWNER cannot revoke another organization\'s key', async () => {
      const keys = await prisma.organizationApiKey.findMany({ where: { organizationId: orgB.id } });
      const res = await request(app).delete(`/api/org/api-keys/${keys[0]!.id}`).set(auth(ownerA.token));
      expect(res.status).toBe(404);
      expect((await intake({ fullName: 'Still Works', email: `still.${uid()}@example.com` }, keyB)).status).toBe(202);
    });

    it('rate-limits a single key', async () => {
      const key = await createIntakeKey(orgA.id);
      const email = `ratelimit.${uid()}@example.com`;
      const statuses: number[] = [];
      for (let i = 0; i < 31; i++) statuses.push((await intake({ fullName: 'Rate', email }, key)).status);
      expect(statuses.slice(0, 30).every((s) => s === 202)).toBe(true);
      expect(statuses[30]).toBe(429);
    });
  });

  describe('POST /api/inbound/email — signed JSON lead webhook', () => {
    const secret = 'p0-webhook-signing-secret-0123456789';
    const sign = (raw: string, key = secret) => 'sha256=' + crypto.createHmac('sha256', key).update(raw).digest('hex');
    const post = (raw: string, headers: Record<string, string>) => {
      let r = request(app).post('/api/inbound/email').set('Content-Type', 'application/json');
      for (const [k, v] of Object.entries(headers)) r = r.set(k, v);
      return r.send(raw);
    };

    beforeEach(() => {
      process.env['EMAIL_WEBHOOK_SECRET'] = secret;
    });
    afterAll(() => {
      process.env['EMAIL_WEBHOOK_SECRET'] = '';
    });

    it('fails closed with 503 when no signing secret is configured', async () => {
      process.env['EMAIL_WEBHOOK_SECRET'] = '';
      const raw = JSON.stringify({ eventId: uid(), from: 'a@example.com' });
      const res = await post(raw, { 'X-Webhook-Signature': sign(raw), 'X-Api-Key': keyA });
      expect(res.status).toBe(503);
    });

    it('rejects a missing signature', async () => {
      const raw = JSON.stringify({ eventId: uid(), from: 'a@example.com' });
      expect((await post(raw, { 'X-Api-Key': keyA })).status).toBe(401);
    });

    it('rejects a signature made with the wrong key', async () => {
      const raw = JSON.stringify({ eventId: uid(), from: 'a@example.com' });
      expect((await post(raw, { 'X-Webhook-Signature': sign(raw, 'wrong-secret'), 'X-Api-Key': keyA })).status).toBe(401);
    });

    it('rejects malformed signatures without throwing', async () => {
      const raw = JSON.stringify({ eventId: uid(), from: 'a@example.com' });
      for (const bad of ['sha256=', 'sha256=zz', 'sha256=' + 'a'.repeat(63), 'deadbeef']) {
        expect((await post(raw, { 'X-Webhook-Signature': bad, 'X-Api-Key': keyA })).status).toBe(401);
      }
    });

    it('verifies over the raw bytes (whitespace-sensitive), not a re-serialised body', async () => {
      const raw = `{ "eventId": "${uid()}",   "from": "raw.${uid()}@example.com", "fromName": "Raw Body" }`;
      const ok = await post(raw, { 'X-Webhook-Signature': sign(raw), 'X-Api-Key': keyA });
      expect(ok.status).toBe(202);

      const reserialised = JSON.stringify(JSON.parse(raw));
      const bad = await post(raw, { 'X-Webhook-Signature': sign(reserialised), 'X-Api-Key': keyA });
      expect(bad.status).toBe(401);
    });

    it('requires an org API key even with a valid signature', async () => {
      const raw = JSON.stringify({ eventId: uid(), from: 'a@example.com' });
      expect((await post(raw, { 'X-Webhook-Signature': sign(raw) })).status).toBe(401);
    });

    it('requires a provider event id (no timestamp fallback)', async () => {
      const raw = JSON.stringify({ from: `noevent.${uid()}@example.com` });
      expect((await post(raw, { 'X-Webhook-Signature': sign(raw), 'X-Api-Key': keyA })).status).toBe(422);
    });

    it('ignores organizationId in the payload; tenant comes from the API key', async () => {
      const from = `wh.inject.${uid()}@example.com`;
      const raw = JSON.stringify({ eventId: uid(), from, fromName: 'WH Inject', organizationId: orgB.id });
      expect((await post(raw, { 'X-Webhook-Signature': sign(raw), 'X-Api-Key': keyA })).status).toBe(202);
      const leads = await prisma.lead.findMany({ where: { email: from } });
      expect(leads.map((l) => l.organizationId)).toEqual([orgA.id]);
    });

    it('event ids are namespaced per tenant (one org cannot pre-claim another\'s event)', async () => {
      const eventId = `shared-${uid()}`;
      const rawA = JSON.stringify({ eventId, from: `ns.a.${uid()}@example.com` });
      const rawB = JSON.stringify({ eventId, from: `ns.b.${uid()}@example.com` });
      expect((await post(rawA, { 'X-Webhook-Signature': sign(rawA), 'X-Api-Key': keyA })).status).toBe(202);
      const resB = await post(rawB, { 'X-Webhook-Signature': sign(rawB), 'X-Api-Key': keyB });
      expect(resB.status).toBe(202);
      expect(resB.body.message).toBeUndefined();
    });
  });

  describe('POST /api/inbound/email — inbound parse (multipart attachments)', () => {
    const inboundSecret = 'p0-inbound-parse-secret-0123456789';
    let deal: { id: string; inboundAlias: string | null };
    const tempDir = 'uploads/temp';
    const tempCount = () => (existsSync(tempDir) ? readdirSync(tempDir).length : 0);

    beforeAll(async () => {
      deal = await prisma.deal.create({
        data: {
          organizationId: orgA.id,
          propertyAddress: '500 Inbound Ave',
          status: 'ACTIVE',
          notificationSettings: { create: { organizationId: orgA.id, recipients: ['agent.allowed@example.com'] } },
        },
      });
      await prisma.deal.create({ data: { organizationId: orgB.id, propertyAddress: '900 Other Tenant Rd', status: 'ACTIVE' } });
    });
    beforeEach(() => {
      process.env['INBOUND_WEBHOOK_SECRET'] = inboundSecret;
    });
    afterAll(() => {
      process.env['INBOUND_WEBHOOK_SECRET'] = '';
    });

    const parse = (fields: Record<string, string>, secret?: string) => {
      let r = request(app).post('/api/inbound/email');
      if (secret) r = r.set('X-Inbound-Secret', secret);
      for (const [k, v] of Object.entries(fields)) r = r.field(k, v);
      return r.attach('attachments', PDF, { filename: 'contract.pdf', contentType: 'application/pdf' });
    };

    it('fails closed with 503 when INBOUND_WEBHOOK_SECRET is not configured', async () => {
      process.env['INBOUND_WEBHOOK_SECRET'] = '';
      expect((await parse({ to: 'x@y.com', from: 'agent.allowed@example.com' }, 'anything')).status).toBe(503);
    });

    it('rejects a wrong secret before any attachment is written to disk', async () => {
      const before = tempCount();
      const res = await parse({ to: 'x@y.com', from: 'agent.allowed@example.com' }, 'wrong-secret');
      expect(res.status).toBe(401);
      expect(tempCount()).toBe(before);
    });

    it('the inbound-address endpoint issues a high-entropy alias', async () => {
      const res = await request(app).get(`/api/deals/${deal.id}/notifications/inbound-address`).set(auth(agentA.token));
      expect(res.status).toBe(200);
      expect(res.body.inboundEmail).toMatch(/^deal-[a-f0-9]{24}@/);
      deal = (await prisma.deal.findUnique({ where: { id: deal.id } }))!;
      expect(deal.inboundAlias).toMatch(/^[a-f0-9]{24}$/);
    });

    it('does not match deals by guessable id prefixes/suffixes or by subject line', async () => {
      const byIdSuffix = await parse({ to: `deal-${deal.id.slice(-6)}@d.com`, from: 'agent.allowed@example.com' }, inboundSecret);
      expect(byIdSuffix.status).toBe(404);
      const byIdPrefix = await parse({ to: `deal-${deal.id.slice(0, 8)}@d.com`, from: 'agent.allowed@example.com' }, inboundSecret);
      expect(byIdPrefix.status).toBe(404);
      const bySubject = await parse({ to: 'nobody@d.com', subject: 'Re: 900 Other Tenant Rd', from: 'agent.allowed@example.com' }, inboundSecret);
      expect(bySubject.status).toBe(404);
    });

    it('rejects senders not on the deal allowlist', async () => {
      const res = await parse({ to: `deal-${deal.inboundAlias}@d.com`, from: 'Mallory <mallory@evil.example>' }, inboundSecret);
      expect(res.status).toBe(403);
    });

    it('rejects every sender when the deal has no allowlist configured', async () => {
      const bare = await prisma.deal.create({
        data: { organizationId: orgA.id, propertyAddress: '1 No Allowlist Ln', status: 'ACTIVE', inboundAlias: crypto.randomBytes(12).toString('hex') },
      });
      const res = await parse({ to: `deal-${bare.inboundAlias}@d.com`, from: 'anyone@example.com' }, inboundSecret);
      expect(res.status).toBe(403);
    });

    it('accepts an allowlisted sender to the exact alias and stores the document in the deal\'s tenant', async () => {
      const res = await parse({ to: `Deal Inbox <deal-${deal.inboundAlias}@d.com>`, from: 'Agent <agent.allowed@example.com>' }, inboundSecret);
      expect(res.status).toBe(200);
      expect(res.body.processedAttachments).toBe(1);
      const docs = await prisma.document.findMany({ where: { dealId: deal.id } });
      expect(docs).toHaveLength(1);
      expect(docs[0]!.organizationId).toBe(orgA.id);
      if (existsSync(docs[0]!.storagePath)) rmSync(docs[0]!.storagePath);
    });
  });
});
