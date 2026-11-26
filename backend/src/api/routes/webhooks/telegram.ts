// ─────────────────────────────────────────────────────────────────────────────
// /api/webhooks/telegram/:secret — Multi-Tenant Telegram Bot Webhook Route
// ─────────────────────────────────────────────────────────────────────────────

import { Router, type Request, type Response } from 'express';
import { logger } from '../../../utils/logger.js';
import { resolveOrgByTelegramSecret } from '../../../services/channelRegistry.service.js';
import { handleTelegramWebhookUpdate } from '../../../services/telegram.service.js';

const router = Router();

router.post('/:secret', async (req: Request, res: Response) => {
  const secret = req.params['secret'];
  if (!secret) {
    res.status(400).json({ error: 'Missing webhook secret' });
    return;
  }

  const orgChannel = await resolveOrgByTelegramSecret(secret);
  if (!orgChannel) {
    res.status(404).json({ error: 'Unknown Telegram bot binding' });
    return;
  }

  // Acknowledge Telegram immediately
  res.status(200).json({ ok: true });

  const update = req.body;
  if (update?.message) {
    handleTelegramWebhookUpdate(
      update.message,
      orgChannel.organizationId,
      orgChannel.telegramBotToken ?? undefined,
    ).catch((err) => {
      logger.error(`[Telegram Webhook] Error processing update: ${(err as Error).message}`);
    });
  }
});

export default router;
