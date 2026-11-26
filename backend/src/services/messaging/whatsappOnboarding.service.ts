// ─────────────────────────────────────────────────────────────────────────────
// WhatsApp Embedded Signup v4 (Pay-on-Behalf / Coexistence) & Telegram Connect
// Handles OAuth code exchange, WABA webhook subscription, Master Credit Line
// attachment (Solution Partner / BSP mode), and Telegram bot webhook setup.
// ─────────────────────────────────────────────────────────────────────────────

import crypto from 'node:crypto';
import { prisma } from '../../utils/prisma.js';
import { logger } from '../../utils/logger.js';
import { getOrCreateOrgChannel } from '../channelRegistry.service.js';
import { startOrgTelegramPolling } from '../telegram.service.js';

export interface WhatsAppEmbeddedSignupInput {
  code?: string;
  phoneNumberId: string;
  wabaId: string;
  accessTokenOverride?: string;
  whatsappProvider?: 'COEXISTENCE' | 'DEDICATED' | 'BSP_MANAGED';
  bspAppId?: string;
}

export async function completeWhatsAppEmbeddedSignup(
  organizationId: string,
  input: WhatsAppEmbeddedSignupInput,
) {
  const existing = await getOrCreateOrgChannel(organizationId);
  const appId = process.env['META_APP_ID'];
  const appSecret = process.env['META_APP_SECRET'];
  const creditLineId = process.env['META_CREDIT_LINE_ID'];

  let finalAccessToken = input.accessTokenOverride || existing.whatsappAccessToken || '';
  let creditLineAttached = false;

  // 1. Exchange Meta Embedded Signup OAuth code for a System User / Business token
  if (input.code && appId && appSecret) {
    const tokenUrl = new URL('https://graph.facebook.com/v21.0/oauth/access_token');
    tokenUrl.searchParams.set('client_id', appId);
    tokenUrl.searchParams.set('client_secret', appSecret);
    tokenUrl.searchParams.set('code', input.code);

    const tokenRes = await fetch(tokenUrl.toString(), { signal: AbortSignal.timeout(10000) });
    const tokenData = (await tokenRes.json()) as { access_token?: string; error?: { message?: string } };
    if (!tokenRes.ok || !tokenData.access_token) {
      throw new Error(tokenData.error?.message || `Meta OAuth exchange failed (${tokenRes.status})`);
    }
    finalAccessToken = tokenData.access_token;

    // 2. Subscribe platform app webhook to client's WABA
    const subRes = await fetch(`https://graph.facebook.com/v21.0/${input.wabaId}/subscribed_apps`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${finalAccessToken}` },
      signal: AbortSignal.timeout(10000),
    });
    if (!subRes.ok) {
      const subErr = (await subRes.json().catch(() => ({}))) as any;
      logger.warn(`[WhatsApp Embedded Signup] subscribed_apps warning: ${subErr?.error?.message || subRes.status}`);
    }

    // 3. Attach Master Credit Line (Pay-on-Behalf so client pays ONLY our SaaS)
    if (creditLineId && process.env['META_SYSTEM_USER_TOKEN']) {
      try {
        const creditRes = await fetch(
          `https://graph.facebook.com/v21.0/${creditLineId}/whatsapp_credit_sharing_and_attach`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${process.env['META_SYSTEM_USER_TOKEN']}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              waba_id: input.wabaId,
              waba_currency: existing.defaultCurrency || 'INR',
            }),
            signal: AbortSignal.timeout(10000),
          },
        );
        creditLineAttached = creditRes.ok;
      } catch (err: any) {
        logger.warn(`[WhatsApp Embedded Signup] Credit line attach warning: ${err.message}`);
      }
    }
  }

  const verifyToken =
    existing.whatsappVerifyToken || `wa_verify_${crypto.randomBytes(12).toString('hex')}`;

  const updated = await prisma.organizationChannel.update({
    where: { organizationId },
    data: {
      whatsappPhoneNumberId: input.phoneNumberId.trim(),
      whatsappWabaId: input.wabaId.trim(),
      ...(finalAccessToken ? { whatsappAccessToken: finalAccessToken } : {}),
      whatsappVerifyToken: verifyToken,
      whatsappProvider: input.whatsappProvider || (creditLineAttached ? 'BSP_MANAGED' : 'COEXISTENCE'),
      ...(input.bspAppId ? { bspAppId: input.bspAppId } : {}),
    },
  });

  return {
    connected: true,
    whatsappPhoneNumberId: updated.whatsappPhoneNumberId,
    whatsappWabaId: updated.whatsappWabaId,
    whatsappProvider: updated.whatsappProvider,
    creditLineAttached,
    hasToken: Boolean(updated.whatsappAccessToken),
  };
}

/**
 * Assigns a platform-managed WhatsApp line from the SaaS master WABA
 * when a brokerage wants an instant AI number without connecting their own.
 */
export async function assignPlatformWhatsAppNumber(organizationId: string) {
  const existing = await getOrCreateOrgChannel(organizationId);
  if (existing.whatsappPhoneNumberId) {
    return {
      connected: true,
      whatsappPhoneNumberId: existing.whatsappPhoneNumberId,
      whatsappProvider: existing.whatsappProvider || 'PLATFORM_MANAGED',
      isSimulated: existing.whatsappPhoneNumberId.startsWith('wa_platform_'),
    };
  }

  const platformPhoneId = `wa_platform_${organizationId.slice(-8)}_${Date.now().toString(36)}`;
  const platformWabaId = process.env['META_WABA_ID'] || `waba_platform_${organizationId.slice(-6)}`;
  const verifyToken =
    existing.whatsappVerifyToken || `wa_verify_${crypto.randomBytes(12).toString('hex')}`;

  const updated = await prisma.organizationChannel.update({
    where: { organizationId },
    data: {
      whatsappPhoneNumberId: platformPhoneId,
      whatsappWabaId: platformWabaId,
      ...(process.env['META_WHATSAPP_TOKEN']
        ? { whatsappAccessToken: process.env['META_WHATSAPP_TOKEN'] }
        : {}),
      whatsappVerifyToken: verifyToken,
      whatsappProvider: 'PLATFORM_MANAGED',
    },
  });

  return {
    connected: true,
    whatsappPhoneNumberId: updated.whatsappPhoneNumberId,
    whatsappProvider: updated.whatsappProvider,
    isSimulated: !Boolean(process.env['META_WHATSAPP_TOKEN']),
  };
}

export async function connectTelegramBotForOrg(
  organizationId: string,
  params: { botToken: string; publicBaseUrl: string },
) {
  const channel = await getOrCreateOrgChannel(organizationId);
  const cleanToken = params.botToken.trim();
  const secret = channel.telegramWebhookSecret || crypto.randomBytes(18).toString('hex');

  let username = `bot_${organizationId.slice(-6)}`;
  let webhookRegistered = false;

  // Validate token with Telegram getMe unless running in offline test mode
  if (process.env['NODE_ENV'] !== 'test') {
    const meRes = await fetch(`https://api.telegram.org/bot${cleanToken}/getMe`, {
      signal: AbortSignal.timeout(8000),
    });
    const meData = (await meRes.json()) as { ok: boolean; result?: { username?: string }; description?: string };
    if (!meRes.ok || !meData.ok || !meData.result) {
      throw new Error(meData.description || 'Invalid Telegram Bot Token');
    }
    username = meData.result.username || username;

    const effectiveBaseUrl = (
      process.env['API_PUBLIC_URL'] ||
      process.env['APP_PUBLIC_URL'] ||
      process.env['RENDER_EXTERNAL_URL'] ||
      params.publicBaseUrl ||
      ''
    ).trim();
    const isHttps = effectiveBaseUrl.startsWith('https://');
    if (isHttps) {
      const webhookUrl = `${effectiveBaseUrl.replace(/\/$/, '')}/api/webhooks/telegram/${secret}`;
      const setRes = await fetch(`https://api.telegram.org/bot${cleanToken}/setWebhook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: webhookUrl }),
        signal: AbortSignal.timeout(8000),
      });
      const setData = (await setRes.json()) as { ok: boolean; description?: string };
      if (!setRes.ok || !setData.ok) {
        throw new Error(setData.description || 'Failed to register Telegram webhook');
      }
      webhookRegistered = true;
    } else {
      await startOrgTelegramPolling(organizationId, cleanToken);
      webhookRegistered = true;
    }
  }

  const updated = await prisma.organizationChannel.update({
    where: { organizationId },
    data: {
      telegramBotToken: cleanToken,
      telegramBotUsername: username,
      telegramWebhookSecret: secret,
    },
  });

  return {
    connected: true,
    telegramBotUsername: updated.telegramBotUsername,
    telegramWebhookSecret: updated.telegramWebhookSecret,
    webhookRegistered,
  };
}
