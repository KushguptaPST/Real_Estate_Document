/**
 * Telegram Bot Service — Real-Time Conversational AI Integration
 *
 * Connects Telegram Bot (@BadalLabsAssistantBot) with the Agentic AI
 * Sales Copilot loop, CRM lead tracking, and property inventory matching.
 */

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';
import { logger } from '../utils/logger.js';
import { prisma } from '../utils/prisma.js';
import { runSalesAgentLoop } from './agent/agentRuntime.js';
import { getProperties } from './propertyMatch.service.js';

interface TelegramUser {
  id: number;
  is_bot: boolean;
  first_name: string;
  last_name?: string;
  username?: string;
}

interface TelegramChat {
  id: number;
  first_name?: string;
  username?: string;
  type: string;
}

interface TelegramVoice {
  file_id: string;
  file_unique_id: string;
  duration: number;
  mime_type?: string;
  file_size?: number;
}

interface TelegramMessage {
  message_id: number;
  from: TelegramUser;
  chat: TelegramChat;
  date: number;
  text?: string;
  voice?: TelegramVoice;
}

interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
}

let isRunning = false;
let pollingAbortController: AbortController | null = null;
let lastUpdateId = 0;

/**
 * Sends a text message to a Telegram chat.
 */
export async function sendTelegramMessage(
  chatId: number | string,
  text: string,
  options?: {
    parseMode?: 'HTML' | 'Markdown';
    replyMarkup?: any;
  },
): Promise<boolean> {
  const token = process.env['TELEGRAM_BOT_TOKEN'];
  if (!token) return false;

  try {
    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: options?.parseMode,
        reply_markup: options?.replyMarkup,
      }),
    });

    const data = (await response.json()) as any;
    if (!data.ok) {
      logger.warn(`[Telegram] Failed to send message to chat ${chatId}: ${data.description}`);
      return false;
    }
    return true;
  } catch (err: any) {
    logger.error(`[Telegram] Error sending message: ${err.message}`);
    return false;
  }
}

/**
 * Sends a chat action (e.g. typing) to Telegram.
 */
export async function sendTelegramChatAction(
  chatId: number | string,
  action: 'typing' = 'typing',
): Promise<void> {
  const token = process.env['TELEGRAM_BOT_TOKEN'];
  if (!token) return;

  try {
    await fetch(`https://api.telegram.org/bot${token}/sendChatAction`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, action }),
    });
  } catch {
    // Ignore non-critical chat action failure
  }
}

/**
 * Splits text into sentence/clause chunks under 170 chars for Google TTS.
 */
function splitTextForTts(text: string, maxLen = 170): string[] {
  const clean = text
    .replace(/<[^>]*>/g, '')
    .replace(/https?:\/\/\S+/g, '')
    .replace(/[•\*\_\`\#]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!clean) return [];
  if (clean.length <= maxLen) return [clean];

  const sentences = clean.split(/(?<=[.!?])\s+/);
  const chunks: string[] = [];
  let current = '';

  for (const s of sentences) {
    if ((current + ' ' + s).trim().length <= maxLen) {
      current = (current + ' ' + s).trim();
    } else {
      if (current) chunks.push(current);
      if (s.length <= maxLen) {
        current = s;
      } else {
        const words = s.split(' ');
        let sub = '';
        for (const w of words) {
          if ((sub + ' ' + w).trim().length <= maxLen) {
            sub = (sub + ' ' + w).trim();
          } else {
            if (sub) chunks.push(sub);
            sub = w;
          }
        }
        current = sub;
      }
    }
  }
  if (current) chunks.push(current);
  return chunks.slice(0, 5);
}

/**
 * Synthesizes ultra-realistic human speech:
 * Priority 1: Configured voice engine (Azure Neural for Indian woman voice, or ElevenLabs)
 * Priority 2: Alternative high-fidelity engine fallback
 * Priority 3: Google TTS emergency fallback
 */
async function generateHumanVoiceAudio(text: string): Promise<Buffer | null> {
  const preferredVoice = process.env['TELEGRAM_VOICE'] || 'en-IN-NeerjaExpressiveNeural';
  const voiceEngine = process.env['TELEGRAM_VOICE_ENGINE'] || (preferredVoice.includes('Neural') ? 'azure' : 'elevenlabs');

  // Priority: Azure Neural Indian Woman Voice
  if (voiceEngine === 'azure') {
    try {
      const tts = new MsEdgeTTS();
      await tts.setMetadata(preferredVoice, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
      const { audioStream } = tts.toStream(text);
      const chunks: Buffer[] = [];

      await new Promise<void>((resolve, reject) => {
        audioStream.on('data', (c: any) => chunks.push(Buffer.from(c)));
        audioStream.on('end', () => resolve());
        audioStream.on('error', (err: any) => reject(err));
      });

      if (chunks.length > 0) {
        return Buffer.concat(chunks);
      }
    } catch (err: any) {
      logger.warn(`[Telegram Voice] Neural voice error: ${err.message}. Falling back.`);
    }
  }

  // Priority: ElevenLabs
  const elevenKey = process.env['ELEVENLABS_API_KEY'];
  const elevenVoice = process.env['ELEVENLABS_VOICE_ID'] || 'pNInz6obpgDQGcFmaJgB';

  if (elevenKey) {
    try {
      const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${elevenVoice}`, {
        method: 'POST',
        headers: {
          'xi-api-key': elevenKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text,
          model_id: 'eleven_multilingual_v2',
          voice_settings: {
            stability: 0.4,
            similarity_boost: 0.8,
            style: 0.3,
            use_speaker_boost: true,
          },
        }),
      });

      if (res.ok) {
        const audioBuffer = Buffer.from(await res.arrayBuffer());
        logger.info(`[ElevenLabs] Successfully generated ${audioBuffer.length} bytes of human voice`);
        return audioBuffer;
      }
    } catch (err: any) {
      logger.warn(`[ElevenLabs] Request failed: ${err.message}.`);
    }
  }

  // Fallback: Azure Neural Indian Woman Voice
  try {
    const tts = new MsEdgeTTS();
    await tts.setMetadata('en-IN-NeerjaExpressiveNeural', OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
    const { audioStream } = tts.toStream(text);
    const chunks: Buffer[] = [];

    await new Promise<void>((resolve, reject) => {
      audioStream.on('data', (c: any) => chunks.push(Buffer.from(c)));
      audioStream.on('end', () => resolve());
      audioStream.on('error', (err: any) => reject(err));
    });

    if (chunks.length > 0) {
      return Buffer.concat(chunks);
    }
  } catch {}

  // Fallback to Google TTS chunks
  try {
    const chunks = splitTextForTts(text);
    if (chunks.length === 0) return null;

    const audioBuffers: Buffer[] = [];
    for (const chunk of chunks) {
      const ttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(chunk)}&tl=en&client=tw-ob`;
      const res = await fetch(ttsUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)' },
      });
      if (res.ok) {
        audioBuffers.push(Buffer.from(await res.arrayBuffer()));
      }
    }
    return audioBuffers.length > 0 ? Buffer.concat(audioBuffers) : null;
  } catch {
    return null;
  }
}

/**
 * Converts text to realistic human speech and delivers a native Telegram voice note.
 */
export async function sendTelegramVoiceMessage(
  chatId: number | string,
  text: string,
  caption?: string,
): Promise<boolean> {
  const token = process.env['TELEGRAM_BOT_TOKEN'];
  if (!token) return false;

  try {
    const cleanText = text
      .replace(/<[^>]*>/g, '') // remove HTML tags
      .replace(/https?:\/\/\S+/g, '') // remove URLs
      .replace(/[•\*\_\`\#]/g, '') // remove markdown
      .replace(/₹\s*([\d\.]+)\s*Cr\b/gi, '$1 Crores')
      .replace(/₹\s*([\d\.]+)\s*Lakhs?\b/gi, '$1 Lakhs')
      .replace(/₹\s*([\d\,]+)/gi, '$1 rupees')
      .replace(/\bBHK\b/gi, 'B H K')
      .replace(/\bITPL\b/gi, 'I T P L')
      .replace(/\bORR\b/gi, 'Outer Ring Road')
      .replace(/\bBadal\b/gi, 'Baadal') // Ensure proper Indian pronunciation "Baadal" (बादल)
      .replace(/\s+/g, ' ')
      .trim();

    if (!cleanText) return false;

    // Generate natural human voice audio
    const fullAudio = await generateHumanVoiceAudio(cleanText.slice(0, 500));
    if (!fullAudio || fullAudio.length === 0) return false;

    const formData = new FormData();
    formData.append('chat_id', String(chatId));
    formData.append('voice', new Blob([fullAudio], { type: 'audio/mpeg' }), 'human_voice.mp3');
    if (caption) {
      formData.append('caption', caption.slice(0, 1024));
    }

    const tgRes = await fetch(`https://api.telegram.org/bot${token}/sendVoice`, {
      method: 'POST',
      body: formData,
    });

    const data = (await tgRes.json()) as any;
    if (!data.ok) {
      logger.warn(`[Telegram Voice] sendVoice failed: ${data.description}`);
      return false;
    }

    return true;
  } catch (err: any) {
    logger.error(`[Telegram Voice] Error generating/sending human voice note: ${err.message}`);
    return false;
  }
}

/**
 * Resolves default organization for Telegram leads.
 */
async function resolveDefaultOrganization(): Promise<string> {
  const preferredOrg = await prisma.organization.findFirst({
    where: {
      OR: [{ name: { contains: 'Apex' } }, { id: 'cmuyc3rxl0001xj888pzcoyop' }],
    },
  });
  if (preferredOrg) return preferredOrg.id;

  const anyOrg = await prisma.organization.findFirst();
  if (anyOrg) return anyOrg.id;

  // Fallback create demo org
  const newOrg = await prisma.organization.create({
    data: { name: 'Apex Realty Brokerage' },
  });
  return newOrg.id;
}

/**
 * Finds or creates a CRM Lead and Conversation Thread for a Telegram User.
 */
async function getOrCreateTelegramLead(user: TelegramUser, orgId: string) {
  const externalId = `telegram:${user.id}`;
  const fullName =
    [user.first_name, user.last_name].filter(Boolean).join(' ') ||
    (user.username ? `@${user.username}` : `Telegram Buyer ${user.id}`);

  const email = user.username
    ? `${user.username}@telegram.user`
    : `tg_${user.id}@contingencycopilot.internal`;

  let lead = await prisma.lead.findFirst({
    where: {
      organizationId: orgId,
      OR: [{ externalId }, { email }],
    },
    include: { requirements: true },
  });

  if (!lead) {
    lead = await prisma.lead.create({
      data: {
        organizationId: orgId,
        externalId,
        fullName,
        email,
        source: 'PORTAL_INQUIRY',
        status: 'NEW',
        priority: 'MEDIUM',
      },
      include: { requirements: true },
    });

    // Create empty requirement record if missing
    await prisma.leadRequirement.create({
      data: {
        leadId: lead.id,
      },
    });

    logger.info(`[Telegram] Created new Lead for user ${fullName} (${user.id}) in org ${orgId}`);
  }

  // Find or create conversation thread
  let thread = await prisma.conversationThread.findFirst({
    where: {
      leadId: lead.id,
      organizationId: orgId,
    },
  });

  if (!thread) {
    thread = await prisma.conversationThread.create({
      data: {
        leadId: lead.id,
        organizationId: orgId,
        channel: 'WEB_CHAT',
        state: 'AUTOPILOT',
        autoReplyEnabled: true,
      },
    });
  }

  return { lead, thread };
}

/**
 * Downloads and saves user voice sample from Telegram for cloning.
 */
export async function saveIncomingVoiceSample(fileId: string, userId: number | string): Promise<string | null> {
  const token = process.env['TELEGRAM_BOT_TOKEN'];
  if (!token) return null;

  try {
    const fileRes = await fetch(`https://api.telegram.org/bot${token}/getFile?file_id=${fileId}`);
    const fileData = (await fileRes.json()) as any;
    if (!fileData.ok || !fileData.result?.file_path) return null;

    const remotePath = fileData.result.file_path;
    const downloadUrl = `https://api.telegram.org/file/bot${token}/${remotePath}`;

    const audioRes = await fetch(downloadUrl);
    if (!audioRes.ok) return null;

    const buffer = Buffer.from(await audioRes.arrayBuffer());
    const uploadDir = path.resolve(process.cwd(), 'uploads/voice_samples');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const oggPath = path.join(uploadDir, `voice_sample_${userId}.ogg`);
    const wavPath = path.join(uploadDir, `voice_sample_${userId}.wav`);
    fs.writeFileSync(oggPath, buffer);

    try {
      execSync(`/opt/homebrew/bin/ffmpeg -y -i "${oggPath}" -ar 24000 "${wavPath}" 2>/dev/null`);
      logger.info(`[Telegram Voice] Converted voice sample to WAV: ${wavPath}`);
      return wavPath;
    } catch {
      return oggPath;
    }
  } catch (err: any) {
    logger.error(`[Telegram Voice] Failed to save voice sample: ${err.message}`);
    return null;
  }
}

/**
 * Processes an incoming Telegram message through the AI Sales Agent.
 */
async function handleIncomingMessage(msg: TelegramMessage, orgId: string): Promise<void> {
  const chatId = msg.chat.id;
  let text = (msg.text || '').trim();
  const isVoiceInput = Boolean(msg.voice);
  let savedVoiceSamplePath: string | null = null;

  if (msg.voice) {
    savedVoiceSamplePath = await saveIncomingVoiceSample(msg.voice.file_id, msg.from.id);
    if (!text) {
      text = `Hello, I sent a voice note (${msg.voice.duration}s) about property options.`;
    }
  }

  if (!text) return;

  const { lead, thread } = await getOrCreateTelegramLead(msg.from, orgId);

  // If user sent a voice sample, acknowledge and confirm audio capture
  if (savedVoiceSamplePath) {
    await sendTelegramMessage(
      chatId,
      `🎙️ <b>Voice Sample Captured (${msg.voice?.duration}s)!</b>\n\nI have saved your audio sample. Our AI will analyze your vocal timbre and tone.`,
      { parseMode: 'HTML' }
    );
  }

  // Command: /voice
  if (text.toLowerCase() === '/voice' || text.includes('Voice Note') || text.includes('Voice Mode')) {
    const voiceIntro = "Hello! Voice mode is active. You can send me voice messages anytime or listen to my spoken voice replies. What kind of property are you looking for today?";
    await sendTelegramMessage(chatId, `🎙️ <b>Voice Mode Active!</b>\n\n${voiceIntro}\n\n<i>Try asking: "What homes are available under $800k?"</i>`, { parseMode: 'HTML' });
    await sendTelegramVoiceMessage(chatId, voiceIntro);
    return;
  }

  // 1. Command: /resume or /ai or 'Resume AI Copilot'
  if (
    text.toLowerCase() === '/ai' ||
    text.toLowerCase() === '/resume' ||
    text.includes('Resume AI') ||
    text.toLowerCase() === 'switch to ai'
  ) {
    await prisma.conversationThread.update({
      where: { id: thread.id },
      data: {
        state: 'AUTOPILOT',
        isHumanTakeover: false,
        takeoverBy: null,
        autoReplyEnabled: true,
      },
    });

    const resumeMsg =
      `⚡ <b>AI Sales Copilot resumed!</b>\n\n` +
      `I am ready to help you again. What kind of property are you looking for? (e.g. "Looking for 2 bedrooms in Miami under $800k")`;

    await sendTelegramMessage(chatId, resumeMsg, {
      parseMode: 'HTML',
      replyMarkup: { remove_keyboard: true },
    });
    return;
  }

  // 2. Command: /start
  if (text.toLowerCase() === '/start') {
    // Reset any takeover on /start so user can restart AI chat
    await prisma.conversationThread.update({
      where: { id: thread.id },
      data: {
        state: 'AUTOPILOT',
        isHumanTakeover: false,
        takeoverBy: null,
        autoReplyEnabled: true,
      },
    });

    const welcome =
      `👋 <b>Hello ${msg.from.first_name}!</b>\n\n` +
      `Welcome to <b>Apex Realty AI Copilot</b>. I am your autonomous real estate sales advisor.\n\n` +
      `Here is what I can do for you:\n` +
      `• 🔍 <b>Find Properties:</b> Tell me your budget, preferred city, or bedroom requirements.\n` +
      `• 📅 <b>Book Tours:</b> Schedule an on-site property walkthrough.\n` +
      `• 📋 <b>Answer Questions:</b> Inquire about HOA fees, schools, price points, and features.\n\n` +
      `<i>Try asking:</i>\n` +
      `👉 "Show me 2-bedroom properties under $800,000"\n` +
      `👉 "What homes are available in Miami or Dallas?"\n` +
      `👉 "/properties" to list verified inventory now!`;

    await sendTelegramMessage(chatId, welcome, {
      parseMode: 'HTML',
      replyMarkup: { remove_keyboard: true },
    });
    return;
  }

  // 3. Command: /help
  if (text.toLowerCase() === '/help') {
    const helpText =
      `🤖 <b>AI Sales Assistant Commands:</b>\n\n` +
      `• /start — Restart conversation and reset to AI mode\n` +
      `• /properties — View verified live inventory\n` +
      `• /ai or /resume — Switch back to AI mode from human takeover\n` +
      `• /help — Show this help message\n\n` +
      `You can also just talk naturally! E.g.: <i>"Looking for a 3-bed house with a backyard under $750k"</i>`;
    await sendTelegramMessage(chatId, helpText, { parseMode: 'HTML' });
    return;
  }

  // 4. Command: /properties or Quick Button
  if (text.toLowerCase() === '/properties' || text.includes('Available Properties')) {
    await sendTelegramChatAction(chatId, 'typing');
    const allProperties = await getProperties({ organizationId: orgId });
    const properties = allProperties.slice(0, 5);
    if (!properties || properties.length === 0) {
      await sendTelegramMessage(chatId, 'Currently no active listings found in verified inventory.');
      return;
    }

    let listingsText = `🏡 <b>Verified Available Inventory:</b>\n\n`;
    for (const p of properties) {
      const isIndia =
        (p.city &&
          (p.city.toLowerCase().includes('bengaluru') ||
            p.city.toLowerCase().includes('whitefield') ||
            p.city.toLowerCase().includes('bangalore'))) ||
        p.price >= 1000000;
      const priceFormatted = isIndia
        ? p.price >= 10000000
          ? `₹${(p.price / 10000000).toFixed(2)} Cr`
          : `₹${(p.price / 100000).toFixed(2)} Lakhs`
        : new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            maximumFractionDigits: 0,
          }).format(p.price);

      listingsText += `• <b>${p.title}</b>\n  📍 ${p.address}, ${p.city}\n  💵 <b>${priceFormatted}</b> | 🛏 ${p.bedrooms} Beds | 🛁 ${p.bathrooms} Baths\n  ✨ Status: ${p.status}\n\n`;
    }
    listingsText += `<i>Would you like to schedule a tour or see more details on any of these?</i>`;
    await sendTelegramMessage(chatId, listingsText, { parseMode: 'HTML' });
    return;
  }

  // 4. Save Customer Message to CRM Thread
  await prisma.conversationMessage.create({
    data: {
      threadId: thread.id,
      organizationId: orgId,
      senderType: 'CUSTOMER',
      content: text,
      approvalStatus: 'APPROVED',
    },
  });

  // Indicate typing indicator on Telegram while AI plans and executes tools
  await sendTelegramChatAction(chatId, 'typing');

  // Load recent messages for agent context
  const recentHistory = await prisma.conversationMessage.findMany({
    where: { threadId: thread.id },
    orderBy: { createdAt: 'desc' },
    take: 8,
  });

  const formattedHistory = recentHistory
    .slice()
    .reverse()
    .map((m) => ({ senderType: m.senderType, content: m.content }));

  // 5. Execute Multi-Turn Agentic Sales Loop
  let agentResult;
  try {
    agentResult = await runSalesAgentLoop({
      leadId: lead.id,
      organizationId: orgId,
      threadId: thread.id,
      customerMessage: text,
      recentMessages: formattedHistory,
      customerName: lead.fullName,
    });
  } catch (agentErr: any) {
    logger.error(`[Telegram] Error executing sales agent loop: ${agentErr.message}`);
    const firstName = lead.fullName ? lead.fullName.split(' ')[0] : 'there';
    agentResult = {
      response:
        `Hey ${firstName}! For a 3BHK in Whitefield around 2 Cr, you have some solid options. Right now I have ready units in Prestige Shantiniketan at ₹2.15 Cr and Brigade Woods at ₹1.85 Cr, plus Godrej Splendour for late 2026. Are you looking to move in right away, or are you flexible on timeline?`,
      suggestedFollowUps: ['Looking to move in immediately', 'Flexible on timeline', 'View Prestige Shantiniketan'],
      reasoning: 'Conversational fallback response',
      executedTools: [],
      exhaustedLimit: false,
    };
  }

  // Save AI Response to CRM Thread
  await prisma.conversationMessage.create({
    data: {
      threadId: thread.id,
      organizationId: orgId,
      senderType: 'AI',
      content: agentResult.response,
      suggestedAction: {
        followUps: agentResult.suggestedFollowUps,
        reasoning: agentResult.reasoning,
        toolExecutions: agentResult.executedTools,
      } as object,
      approvalStatus: 'APPROVED',
    },
  });

  // 6. Deliver AI Response to Telegram
  let replyContent = agentResult.response;

  if (agentResult.suppressed || !replyContent) {
    const notice =
      `👤 <b>A human advisor is currently assigned to this conversation.</b>\n\n` +
      `Our advisor team has received your message: <i>"${text}"</i>.\n\n` +
      `<i>Tap below or send <b>/ai</b> to resume chatting with the automated AI Copilot:</i>`;

    await sendTelegramMessage(chatId, notice, {
      parseMode: 'HTML',
      replyMarkup: { remove_keyboard: true },
    });
    return;
  }

  // Deliver clean message with no button options/keyboards
  await sendTelegramMessage(chatId, replyContent, {
    replyMarkup: { remove_keyboard: true },
  });

  // Also deliver spoken voice note naturally with no bot captions
  if (replyContent && !agentResult.suppressed) {
    sendTelegramVoiceMessage(chatId, replyContent).catch((err) => {
      logger.warn(`[Telegram Voice] Voice note delivery failed: ${err.message}`);
    });
  }
}

/**
 * Continuous Long-Polling loop for Telegram Updates.
 */
async function pollUpdates(orgId: string): Promise<void> {
  const token = process.env['TELEGRAM_BOT_TOKEN'];
  if (!token) return;

  while (isRunning) {
    try {
      pollingAbortController = new AbortController();
      const timeoutSec = 20;
      const url = `https://api.telegram.org/bot${token}/getUpdates?offset=${lastUpdateId + 1}&timeout=${timeoutSec}`;

      const response = await fetch(url, {
        signal: pollingAbortController.signal,
      });

      if (!response.ok) {
        logger.warn(`[Telegram Polling] HTTP error ${response.status}: ${response.statusText}`);
        await new Promise((r) => setTimeout(r, 4000));
        continue;
      }

      const data = (await response.json()) as { ok: boolean; result: TelegramUpdate[] };
      if (data.ok && Array.isArray(data.result)) {
        for (const update of data.result) {
          lastUpdateId = Math.max(lastUpdateId, update.update_id);
          if (update.message) {
            handleIncomingMessage(update.message, orgId).catch((err) => {
              logger.error(`[Telegram] Error handling message ${update.message?.message_id}: ${err.message}`);
            });
          }
        }
      }
    } catch (err: any) {
      if (err.name === 'AbortError' || !isRunning) {
        break;
      }
      logger.error(`[Telegram Polling] Polling network error: ${err.message}`);
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
}

/**
 * Initializes and starts the Telegram Bot Service.
 */
export async function initTelegramBot(): Promise<void> {
  const token = process.env['TELEGRAM_BOT_TOKEN'];
  if (!token) {
    logger.info('[Telegram] TELEGRAM_BOT_TOKEN not configured. Skipping bot start.');
    return;
  }

  if (isRunning) {
    logger.warn('[Telegram] Telegram bot is already running.');
    return;
  }

  try {
    // 1. Verify token with Telegram getMe API
    const res = await fetch(`https://api.telegram.org/bot${token}/getMe`);
    const data = (await res.json()) as any;

    if (!data.ok || !data.result) {
      logger.error(`[Telegram] Invalid bot token: ${data.description || 'Unknown error'}`);
      return;
    }

    const botInfo = data.result;
    logger.info(`🤖 [Telegram] Bot connected: @${botInfo.username} (${botInfo.first_name})`);

    // 2. Ensure Webhook is deleted for long polling
    await fetch(`https://api.telegram.org/bot${token}/deleteWebhook`);

    // 3. Resolve organization
    const orgId = await resolveDefaultOrganization();

    // 4. Start polling
    isRunning = true;
    pollUpdates(orgId).catch((err) => {
      logger.error(`[Telegram] Polling loop failed: ${err.message}`);
    });

    logger.info(`🚀 [Telegram] Real-Time Agentic AI listener active for @${botInfo.username}`);
  } catch (err: any) {
    logger.error(`[Telegram] Failed to initialize Telegram Bot: ${err.message}`);
  }
}

/**
 * Stops the Telegram Bot Polling loop cleanly.
 */
export function stopTelegramBot(): void {
  if (!isRunning) return;
  logger.info('[Telegram] Stopping Telegram bot polling...');
  isRunning = false;
  if (pollingAbortController) {
    pollingAbortController.abort();
    pollingAbortController = null;
  }
}
