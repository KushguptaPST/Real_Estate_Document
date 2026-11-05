import request from 'supertest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/utils/prisma.js';
import {
  formatSpokenVoiceMemoScript,
  generateSyntheticVoiceSample,
  renderVoiceNoteOggOpus,
  generateAdvisorVoiceNote,
} from '../src/services/voice/voiceNote.service.js';
import {
  chunkMessageBubbles,
  enforceTennisVolleyRule,
  calculateTypingDelayMs,
  prepareConversationalBubbles,
  isNightOwlWindow,
  getNightOwlAcknowledgment,
} from '../src/services/messaging/humanChatPhysics.js';
import { whatsAppService } from '../src/services/messaging/whatsapp.service.js';

describe('Phase 1: Meta WhatsApp & 5-Pillar Voice Note Pipeline', () => {
  const app = createApp();
  let testOrgId: string;

  beforeAll(async () => {
    const org = await prisma.organization.upsert({
      where: { id: 'test-voice-wa-org' },
      update: {},
      create: {
        id: 'test-voice-wa-org',
        name: 'Voice & WhatsApp Test Realty',
      },
    });
    testOrgId = org.id;
  });

  afterAll(async () => {
    await prisma.conversationMessage.deleteMany({
      where: { organizationId: testOrgId },
    });
    await prisma.conversationThread.deleteMany({
      where: { organizationId: testOrgId },
    });
    await prisma.lead.deleteMany({
      where: { organizationId: testOrgId },
    });
    await prisma.organization.deleteMany({
      where: { id: testOrgId },
    });
    await prisma.$disconnect();
  });

  // ── 1. Voice Note Pipeline & 5 Acoustic Pillars ─────────────────────────
  describe('Pillar 1: Spoken Voice Memo Syntax Engine', () => {
    it('normalizes written currencies and real estate acronyms to conversational speech', () => {
      const input = 'We have 3BHK units in Prestige near ITPL starting at ₹2.45 Cr with ₹50 Lakhs initial downpayment.';
      const result = formatSpokenVoiceMemoScript(input, { advisorName: 'Arjun', leadName: 'Badal' });

      expect(result).toContain('3 B H K');
      expect(result).toContain('I T P L');
      expect(result).toContain('2.45 Crore');
      expect(result).toContain('50 Lakh');
      expect(result).toContain('Arjun here!');
    });

    it('injects personal conversational greeting if not present', () => {
      const input = 'The developer just released 2 high-floor units.';
      const result = formatSpokenVoiceMemoScript(input, { advisorName: 'Kush', leadName: 'Sarah' });

      expect(result).toMatch(/^Hey Sarah, Kush here!/);
    });
  });

  describe('Pillars 3, 4, 5: Acoustic Processing & OGG-OPUS Transcoding', () => {
    it('synthesizes synthetic audio and encodes to native OGG-OPUS with OggS header', async () => {
      const rawWav = await generateSyntheticVoiceSample('Test voice note speech tone');
      expect(rawWav).toBeInstanceOf(Buffer);
      expect(rawWav.length).toBeGreaterThan(100);

      const oggOpus = await renderVoiceNoteOggOpus(rawWav, {
        roomToneDb: -48,
        applyMicEq: true,
      });

      expect(oggOpus).toBeInstanceOf(Buffer);
      expect(oggOpus.length).toBeGreaterThan(100);

      // Verify OGG file container signature 'OggS' (0x4F, 0x67, 0x67, 0x53)
      expect(oggOpus[0]).toBe(0x4f); // 'O'
      expect(oggOpus[1]).toBe(0x67); // 'g'
      expect(oggOpus[2]).toBe(0x67); // 'g'
      expect(oggOpus[3]).toBe(0x53); // 'S'
    });

    it('runs end-to-end advisor voice note generation', async () => {
      const note = await generateAdvisorVoiceNote(
        'Hey Badal! Just saw your interest in the Whitefield residence. Let me send you the floor plans.',
        { advisorName: 'Arjun', leadName: 'Badal' }
      );

      expect(note.mimeType).toBe('audio/ogg; codecs=opus');
      expect(note.audioBuffer.length).toBeGreaterThan(100);
      expect(note.scriptText).toContain('Arjun here!');
      // Verify OggS header
      expect(note.audioBuffer[0]).toBe(0x4f);
      expect(note.audioBuffer[1]).toBe(0x67);
    });
  });

  // ── 2. Human Chat Physics ────────────────────────────────────────────────
  describe('Human Chat Physics Engine', () => {
    it('splits bulk paragraphs into 2-3 natural micro-bubbles', () => {
      const paragraph =
        'Hey Badal! 👋 Arjun here from Apex Realty.\n\nSaw you checked out the 2BHK at Godrej Splendour on Instagram. That 85L inventory has literally 3 units left with open balcony views.\n\nWere you looking at this for self-use, or more as an investment rental?';

      const bubbles = chunkMessageBubbles(paragraph);
      expect(bubbles.length).toBe(3);
      expect(bubbles[0]).toContain('Apex Realty');
      expect(bubbles[1]).toContain('Godrej Splendour');
      expect(bubbles[2]).toContain('investment rental?');
    });

    it('enforces The Tennis Volley Rule by keeping only 1 question mark', () => {
      const multiQuestionBubbles = [
        'Hey Badal, can you tell me if you are looking for 2BHK or 3BHK?',
        'Also are you looking for ready to move?',
        'Would Saturday morning or Sunday afternoon work better to visit?',
      ];

      const singleVolley = enforceTennisVolleyRule(multiQuestionBubbles);
      const questionMarksCount = singleVolley.reduce(
        (acc, b) => acc + (b.includes('?') ? 1 : 0),
        0
      );

      expect(questionMarksCount).toBe(1);
      expect(singleVolley[2]).toContain('?');
      expect(singleVolley[0]).not.toContain('?');
      expect(singleVolley[1]).not.toContain('?');
    });

    it('calculates realistic human typing delay bounded between 1.2s and 3.8s', () => {
      expect(calculateTypingDelayMs('Hi')).toBe(1200); // Floor 1200ms
      expect(calculateTypingDelayMs('A'.repeat(50))).toBe(2250); // 50 * 45ms
      expect(calculateTypingDelayMs('A'.repeat(200))).toBe(3800); // Ceiling 3800ms
    });

    it('prepares conversational bubbles with typing delays', () => {
      const payload = prepareConversationalBubbles(
        'Hey there! We have verified options available. Would you like to tour this weekend?'
      );
      expect(payload.length).toBeGreaterThanOrEqual(1);
      expect(payload[0]!.typingDelayMs).toBeGreaterThanOrEqual(1200);
    });
  });

  // ── 3. WhatsApp Service ──────────────────────────────────────────────────
  describe('WhatsApp Business Service', () => {
    it('sanitizes international phone numbers into clean E.164 digits', () => {
      expect(whatsAppService.sanitizePhoneNumber('+91 98765-43210')).toBe('919876543210');
      expect(whatsAppService.sanitizePhoneNumber('+1 (415) 555-2671')).toBe('14155552671');
    });

    it('simulates text message delivery in test mode', async () => {
      const res = await whatsAppService.sendTextMessage('+919876543210', 'Test message from agent');
      expect(res.success).toBe(true);
      expect(res.messageId).toMatch(/^sim-wa-text-/);
    });

    it('simulates voice note delivery in test mode', async () => {
      const sampleOgg = Buffer.from('OggS simulated voice payload');
      const res = await whatsAppService.sendVoiceNote('+919876543210', sampleOgg);
      expect(res.success).toBe(true);
      expect(res.messageId).toMatch(/^sim-wa-voice-/);
    });

    it('simulates interactive site-visit buttons in test mode', async () => {
      const buttons = [
        { id: 'sat_11am', title: 'Book Sat 11 AM' },
        { id: 'sun_3pm', title: 'Book Sun 3 PM' },
      ];
      const res = await whatsAppService.sendInteractiveButtons(
        '+919876543210',
        'Which day works better for you?',
        buttons
      );
      expect(res.success).toBe(true);
      expect(res.messageId).toMatch(/^sim-wa-buttons-/);
    });
  });

  // ── 4. Webhook Routes & Speed-to-Lead Endpoints ─────────────────────────
  describe('WhatsApp Inbound Webhook Routes', () => {
    it('passes Meta webhook verification handshake on GET /api/inbound/whatsapp', async () => {
      const challengeCode = '1158201444';
      const verifyToken = 'contingency_copilot_meta_webhook_secret';

      const res = await request(app)
        .get('/api/inbound/whatsapp')
        .query({
          'hub.mode': 'subscribe',
          'hub.verify_token': verifyToken,
          'hub.challenge': challengeCode,
        });

      expect(res.status).toBe(200);
      expect(res.text).toBe(challengeCode);
    });

    it('rejects invalid verify token with 403 on GET /api/inbound/whatsapp', async () => {
      const res = await request(app)
        .get('/api/inbound/whatsapp')
        .query({
          'hub.mode': 'subscribe',
          'hub.verify_token': 'wrong-secret-token',
          'hub.challenge': '12345',
        });

      expect(res.status).toBe(403);
    });

    it('processes inbound WhatsApp customer message and stores in CRM', async () => {
      process.env['DEFAULT_ORG_ID'] = testOrgId;
      const testPhone = '919876500001';
      const uniqueMsgId = `wamid.HBgL${Date.now()}`;

      const metaWebhookPayload = {
        object: 'whatsapp_business_account',
        entry: [
          {
            id: 'WHATSAPP_BUSINESS_ACCOUNT_ID',
            changes: [
              {
                value: {
                  messaging_product: 'whatsapp',
                  metadata: {
                    display_phone_number: '15550234567',
                    phone_number_id: 'PHONE_NUMBER_ID',
                  },
                  contacts: [
                    {
                      profile: { name: 'Rohan Sharma' },
                      wa_id: testPhone,
                    },
                  ],
                  messages: [
                    {
                      from: testPhone,
                      id: uniqueMsgId,
                      timestamp: `${Math.floor(Date.now() / 1000)}`,
                      type: 'text',
                      text: {
                        body: 'Looking for a 3BHK in Whitefield under 2.5 Cr. Can you share details?',
                      },
                    },
                  ],
                },
                field: 'messages',
              },
            ],
          },
        ],
      };

      const res = await request(app)
        .post('/api/inbound/whatsapp')
        .send(metaWebhookPayload);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ status: 'received' });

      // Poll briefly for background async processing to complete
      let lead: any = null;
      for (let i = 0; i < 25; i++) {
        lead = await prisma.lead.findFirst({
          where: { organizationId: testOrgId, phone: testPhone },
          include: {
            conversations: {
              include: { messages: true },
            },
          },
        });
        if (lead && lead.conversations?.[0]?.messages?.length > 0) {
          break;
        }
        await new Promise((r) => setTimeout(r, 100));
      }

      expect(lead).toBeDefined();
      expect(lead?.fullName).toContain('Rohan Sharma');
      expect(lead?.source).toBe('WHATSAPP');

      // Verify message was recorded
      const thread = lead?.conversations[0];
      expect(thread).toBeDefined();
      expect(thread?.channel).toBe('WHATSAPP');

      const customerMsg = thread?.messages.find((m) => m.senderType === 'CUSTOMER');
      expect(customerMsg).toBeDefined();
      expect(customerMsg?.content).toContain('3BHK in Whitefield');
      expect(customerMsg?.providerMessageId).toBe(uniqueMsgId);
    });
  });
});
