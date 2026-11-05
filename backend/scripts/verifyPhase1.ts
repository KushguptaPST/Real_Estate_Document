/**
 * Verification Script for Phase 1: Meta WhatsApp Cloud API & 5-Pillar Voice Note Pipeline
 */

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
import { prisma } from '../src/utils/prisma.js';

async function runVerification() {
  console.log('=================================================================');
  console.log('🚀 Phase 1: Meta WhatsApp & 5-Pillar Voice Note Pipeline Test');
  console.log('=================================================================\n');

  let passed = 0;
  let total = 0;

  function assert(desc: string, condition: boolean, extra?: string) {
    total++;
    if (condition) {
      console.log(`✅ [PASS] ${desc}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${desc} ${extra || ''}`);
    }
  }

  // ── 1. Pillar 1: Conversational Voice Scripting ───────────────────────────
  console.log('--- Test Suite 1: Spoken Voice Memo Syntax Engine ---');
  const inputScript = 'We have 3BHK residences in Whitefield near ITPL starting at ₹2.45 Cr with ₹50 Lakhs downpayment.';
  const spoken = formatSpokenVoiceMemoScript(inputScript, { advisorName: 'Arjun', leadName: 'Badal' });

  assert('Normalizes 3BHK to 3 B H K', spoken.includes('3 B H K'));
  assert('Normalizes ITPL to I T P L', spoken.includes('I T P L'));
  assert('Normalizes ₹2.45 Cr to 2.45 Crore', spoken.includes('2.45 Crore'));
  assert('Normalizes ₹50 Lakhs to 50 Lakh', spoken.includes('50 Lakh'));
  assert('Prepends personal advisor greeting', spoken.startsWith('Hey Badal, Arjun here!'));

  // ── 2. Pillars 3, 4, 5: Acoustic Processing via FFmpeg ────────────────────
  console.log('\n--- Test Suite 2: Acoustic Processing & Native OGG-OPUS ---');
  const rawAudio = await generateSyntheticVoiceSample('Testing voice audio synthesis');
  assert('Generates raw speech audio tone buffer', rawAudio.length > 500, `Length: ${rawAudio.length}`);

  const oggOpus = await renderVoiceNoteOggOpus(rawAudio, {
    roomToneDb: -48,
    applyMicEq: true,
  });
  assert('Encodes to OGG-OPUS buffer', oggOpus.length > 500, `Length: ${oggOpus.length}`);

  // Check OggS signature: 0x4F, 0x67, 0x67, 0x53
  const isOggS = oggOpus[0] === 0x4f && oggOpus[1] === 0x67 && oggOpus[2] === 0x67 && oggOpus[3] === 0x53;
  assert("Contains authentic 'OggS' container header", isOggS);

  const fullNote = await generateAdvisorVoiceNote(
    'Hey Badal! Rahul here. Just wanted to share the Prestige Shantiniketan 3BHK floor plan with you.',
    { advisorName: 'Rahul', leadName: 'Badal' }
  );
  assert("Full voice note returns 'audio/ogg; codecs=opus'", fullNote.mimeType === 'audio/ogg; codecs=opus');
  assert('Full voice note audio buffer is non-empty', fullNote.audioBuffer.length > 500);

  // ── 3. Human Chat Physics Engine ─────────────────────────────────────────
  console.log('\n--- Test Suite 3: Human Chat Physics & Conversational Cadence ---');
  const longPitch =
    'Hey Badal! Rahul here from Apex Realty.\n\nSaw you checked out the 3BHK at Prestige Shantiniketan. That unit has an open terrace facing the private gardens.\n\nWould you like to walk through the space this Saturday at 11 AM?';

  const bubbles = chunkMessageBubbles(longPitch);
  assert('Chunks pitch into 3 micro-bubbles', bubbles.length === 3, `Count: ${bubbles.length}`);

  const multiQuestions = [
    'Are you looking for 2BHK or 3BHK?',
    'What is your target budget ceiling?',
    'Would Saturday at 11 AM or Sunday at 3 PM work better for you?',
  ];
  const volleyCompliant = enforceTennisVolleyRule(multiQuestions);
  const qCount = volleyCompliant.reduce((acc, b) => acc + (b.includes('?') ? 1 : 0), 0);
  assert('Enforces Tennis Volley Rule (strictly 1 question mark)', qCount === 1, `qCount: ${qCount}`);

  const delayShort = calculateTypingDelayMs('Hey');
  const delayMedium = calculateTypingDelayMs('A'.repeat(50));
  const delayLong = calculateTypingDelayMs('A'.repeat(300));
  assert('Typing delay enforces floor of 1200ms', delayShort === 1200);
  assert('Typing delay scales dynamically (50 chars -> 2250ms)', delayMedium === 2250);
  assert('Typing delay enforces ceiling of 3800ms', delayLong === 3800);

  const prepared = prepareConversationalBubbles('Hello! Check out our inventory. Are you ready for a tour?');
  assert('Prepares structured ChatBubble objects with typing delays', prepared.length >= 1 && prepared[0]!.typingDelayMs >= 1200);

  // ── 4. WhatsApp Cloud API Service ─────────────────────────────────────────
  console.log('\n--- Test Suite 4: Meta WhatsApp Cloud API Service ---');
  const sanitized = whatsAppService.sanitizePhoneNumber('+91 (987) 654-3210');
  assert('Sanitizes international phone to E.164 digits', sanitized === '919876543210');

  const textRes = await whatsAppService.sendTextMessage(sanitized, 'Hello from WhatsApp service');
  assert('Dispatches text message in simulation mode', textRes.success && textRes.messageId!.startsWith('sim-wa-text-'));

  const voiceRes = await whatsAppService.sendVoiceNote(sanitized, oggOpus);
  assert('Dispatches voice note in simulation mode', voiceRes.success && voiceRes.messageId!.startsWith('sim-wa-voice-'));

  const btnRes = await whatsAppService.sendInteractiveButtons(sanitized, 'Select tour slot:', [
    { id: 'sat_11am', title: 'Book Sat 11 AM' },
    { id: 'sun_3pm', title: 'Book Sun 3 PM' },
  ]);
  assert('Dispatches interactive buttons in simulation mode', btnRes.success && btnRes.messageId!.startsWith('sim-wa-buttons-'));

  // ── 5. Database & Tenant Integration ──────────────────────────────────────
  console.log('\n--- Test Suite 5: Database & Lead Thread Integration ---');
  const testOrg = await prisma.organization.upsert({
    where: { id: 'demo-sandbox-org' },
    update: {},
    create: { id: 'demo-sandbox-org', name: 'Demo Sandbox Brokerage' },
  });
  assert('Demo sandbox organization exists in database', Boolean(testOrg.id));

  console.log('\n=================================================================');
  console.log(`📊 Result: ${passed}/${total} checks passed (${Math.round((passed / total) * 100)}%)`);
  console.log('=================================================================\n');

  await prisma.$disconnect();

  if (passed === total) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runVerification().catch((err) => {
  console.error('Fatal verification error:', err);
  process.exit(1);
});
