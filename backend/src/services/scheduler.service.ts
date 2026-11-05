import cron from 'node-cron';
import { prisma } from '../utils/prisma.js';
import { checkAndDispatchAlerts } from './alert.service.js';
import { processOutboxJobs } from './messaging/outboxDispatcher.js';
import { logger } from '../utils/logger.js';

let cronTask: cron.ScheduledTask | null = null;
let outboxInterval: NodeJS.Timeout | null = null;

export async function resetDeadlineAlertWindows(deadlineId: string): Promise<void> {
  await prisma.emailLog.deleteMany({ where: { deadlineId } });
}

export async function runDeadlineSchedulerTick(): Promise<{ processed: number; sent: number }> {
  return checkAndDispatchAlerts();
}

export function startScheduler(): void {
  if (cronTask) return;
  const cronExpression = process.env['ALERT_CRON'] || '0 * * * *';
  logger.info(`[Scheduler] Starting node-cron scheduler with schedule: "${cronExpression}"`);
  cronTask = cron.schedule(cronExpression, async () => {
    try {
      await runDeadlineSchedulerTick();
    } catch (error) {
      logger.error('[Scheduler] Error during scheduler execution tick:', error);
    }
  });

  // GAP-10: Periodic outbox worker loop (every 60s) for retrying and autonomous queue draining
  if (!outboxInterval) {
    outboxInterval = setInterval(async () => {
      try {
        const result = await processOutboxJobs({ batchSize: 10 });
        if (result.processed > 0) {
          logger.info(`[Scheduler] Outbox tick processed: ${result.processed} (succeeded: ${result.succeeded}, retried: ${result.retried})`);
        }
      } catch (err) {
        logger.error('[Scheduler] Error during outbox worker tick:', err);
      }
    }, 60_000);
  }
}

export function stopScheduler(): void {
  cronTask?.stop();
  cronTask = null;
  if (outboxInterval) {
    clearInterval(outboxInterval);
    outboxInterval = null;
  }
}
