// ─────────────────────────────────────────────────────────────────────────────
// Persistent Platform AI Switchboard & Failover Control Plane
// Replaces volatile in-memory state in admin.ts with DB-backed PlatformConfig.
// ─────────────────────────────────────────────────────────────────────────────

import { type PlatformConfig } from '@prisma/client';
import { prisma } from '../utils/prisma.js';
import { logger } from '../utils/logger.js';

export type TtsEngine = 'eleven_flash_v2_5' | 'cartesia_sonic' | 'edge_neural';

const CONFIG_CACHE_TTL_MS = 15_000;
const AUTO_FAILOVER_THRESHOLD = 3;

let cachedConfig: { value: PlatformConfig; fetchedAt: number } | null = null;

export function clearPlatformConfigCache(): void {
  cachedConfig = null;
}

export async function getPlatformConfig(bypassCache = false): Promise<PlatformConfig> {
  if (!bypassCache && cachedConfig && Date.now() - cachedConfig.fetchedAt < CONFIG_CACHE_TTL_MS) {
    return cachedConfig.value;
  }

  const config = await prisma.platformConfig.upsert({
    where: { id: 'default' },
    create: { id: 'default' },
    update: {},
  });

  cachedConfig = { value: config, fetchedAt: Date.now() };
  return config;
}

export async function updatePlatformConfig(
  updates: Partial<{
    primaryTtsEngine: string;
    primaryLlmModel: string;
    outboundDialerPaused: boolean;
    maxPlatformConcurrency: number;
    autoFailoverEnabled: boolean;
    failoverReason: string | null;
  }>,
  adminEmail: string,
  auditNote?: string,
): Promise<PlatformConfig> {
  const before = await getPlatformConfig(true);
  const updated = await prisma.platformConfig.update({
    where: { id: 'default' },
    data: {
      ...updates,
      updatedBy: adminEmail,
      ...(updates.primaryTtsEngine && updates.primaryTtsEngine !== before.primaryTtsEngine
        ? { consecutiveTtsFailures: 0 }
        : {}),
    },
  });

  await prisma.adminAuditLog.create({
    data: {
      adminEmail,
      action: 'PLATFORM_CONFIG_UPDATED',
      note: auditNote || 'Updated platform switchboard configuration',
      metadata: { before, after: updated } as object,
    },
  });

  cachedConfig = { value: updated, fetchedAt: Date.now() };
  return updated;
}

/**
 * Tracks consecutive TTS synthesis failures and automatically promotes a backup engine
 * when autoFailoverEnabled is true and >= 3 consecutive failures occur on the active engine.
 */
export async function recordTtsOutcome(
  engine: TtsEngine,
  success: boolean,
  errorMessage?: string,
): Promise<PlatformConfig> {
  const config = await getPlatformConfig(true);
  if (engine !== config.primaryTtsEngine) {
    return config;
  }

  if (success) {
    if (config.consecutiveTtsFailures === 0) return config;
    const reset = await prisma.platformConfig.update({
      where: { id: 'default' },
      data: { consecutiveTtsFailures: 0 },
    });
    cachedConfig = { value: reset, fetchedAt: Date.now() };
    return reset;
  }

  const nextFailures = config.consecutiveTtsFailures + 1;
  if (!config.autoFailoverEnabled || nextFailures < AUTO_FAILOVER_THRESHOLD) {
    const incremented = await prisma.platformConfig.update({
      where: { id: 'default' },
      data: { consecutiveTtsFailures: nextFailures },
    });
    cachedConfig = { value: incremented, fetchedAt: Date.now() };
    return incremented;
  }

  // Promote next resilient TTS engine
  const canUseCartesia = Boolean(process.env['CARTESIA_API_KEY'] && process.env['CARTESIA_VOICE_ID']);
  const nextEngine: TtsEngine =
    engine === 'eleven_flash_v2_5'
      ? canUseCartesia
        ? 'cartesia_sonic'
        : 'edge_neural'
      : 'edge_neural';

  const reason = `Auto-failover from ${engine} -> ${nextEngine} after ${nextFailures} consecutive failures${
    errorMessage ? `: ${errorMessage.slice(0, 120)}` : ''
  }`;

  const failedOver = await prisma.platformConfig.update({
    where: { id: 'default' },
    data: {
      primaryTtsEngine: nextEngine,
      consecutiveTtsFailures: 0,
      lastFailoverAt: new Date(),
      failoverReason: reason,
      updatedBy: 'system-auto-failover',
    },
  });

  await prisma.adminAuditLog.create({
    data: {
      adminEmail: 'system-auto-failover',
      action: 'TTS_AUTO_FAILOVER',
      note: reason,
      metadata: { previousEngine: engine, nextEngine, failureCount: nextFailures } as object,
    },
  });

  logger.error(`[Platform Switchboard] ${reason}`);
  cachedConfig = { value: failedOver, fetchedAt: Date.now() };
  return failedOver;
}
