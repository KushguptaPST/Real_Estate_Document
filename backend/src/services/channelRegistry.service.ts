// ─────────────────────────────────────────────────────────────────────────────
// Multi-Tenant Channel Registry Service
// Resolves Organization IDs from WhatsApp Phone IDs, Plivo DIDs, Telegram Secrets,
// and Public Website Widget Keys.
// ─────────────────────────────────────────────────────────────────────────────

import crypto from 'node:crypto';
import { prisma } from '../utils/prisma.js';

export async function getOrCreateOrgChannel(organizationId: string) {
  let channel = await prisma.organizationChannel.findUnique({
    where: { organizationId },
  });

  if (!channel) {
    channel = await prisma.organizationChannel.create({
      data: {
        organizationId,
        telegramWebhookSecret: crypto.randomBytes(18).toString('hex'),
        widgetAllowedOrigins: ['http://localhost:3000', 'http://localhost:5173'],
      },
    });
  }
  return channel;
}

export async function resolveOrgByWhatsappPhoneId(phoneNumberId?: string): Promise<{
  organizationId: string;
  accessToken?: string;
  phoneNumberId?: string;
} | null> {
  if (phoneNumberId) {
    const channel = await prisma.organizationChannel.findUnique({
      where: { whatsappPhoneNumberId: phoneNumberId },
      select: {
        organizationId: true,
        whatsappAccessToken: true,
        whatsappPhoneNumberId: true,
      },
    });
    if (channel) {
      return {
        organizationId: channel.organizationId,
        accessToken: channel.whatsappAccessToken ?? undefined,
        phoneNumberId: channel.whatsappPhoneNumberId ?? undefined,
      };
    }
  }

  // Fallback for single-tenant dev/test environments
  if (process.env['DEFAULT_ORG_ID']) {
    return { organizationId: process.env['DEFAULT_ORG_ID'] };
  }
  const firstOrg = await prisma.organization.findFirst({ select: { id: true } });
  return firstOrg ? { organizationId: firstOrg.id } : null;
}

export async function resolveOrgByPlivoNumber(toNumber: string): Promise<{
  organizationId: string;
  plivoNumber: string;
} | null> {
  const digits = toNumber.replace(/[^\d]/g, '');
  if (digits) {
    const numbers = await prisma.plivoNumber.findMany({
      where: { isActive: true },
      select: { organizationId: true, phoneNumber: true },
    });
    const matched = numbers.find((n) => {
      const nDigits = n.phoneNumber.replace(/[^\d]/g, '');
      return nDigits === digits || (digits.length >= 10 && nDigits.endsWith(digits.slice(-10)));
    });
    if (matched) {
      return { organizationId: matched.organizationId, plivoNumber: matched.phoneNumber };
    }
  }

  if (process.env['DEFAULT_ORG_ID']) {
    return { organizationId: process.env['DEFAULT_ORG_ID'], plivoNumber: toNumber };
  }
  const firstOrg = await prisma.organization.findFirst({ select: { id: true } });
  return firstOrg ? { organizationId: firstOrg.id, plivoNumber: toNumber } : null;
}

export async function resolveOrgByTelegramSecret(secret: string) {
  return prisma.organizationChannel.findUnique({
    where: { telegramWebhookSecret: secret },
    select: {
      organizationId: true,
      telegramBotToken: true,
      telegramBotUsername: true,
    },
  });
}

export async function resolveOrgByWidgetKey(widgetPublicKey: string) {
  return prisma.organizationChannel.findUnique({
    where: { widgetPublicKey },
    include: { organization: { select: { id: true, name: true } } },
  });
}
