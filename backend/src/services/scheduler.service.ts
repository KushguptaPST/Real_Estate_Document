import cron from 'node-cron';
import { PrismaClient } from '@prisma/client';
import { checkAndDispatchAlerts } from './alert.service.js';
import { logger } from '../utils/logger.js';

const prisma = new PrismaClient();
let cronTask: cron.ScheduledTask | null = null;

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
}

export function stopScheduler(): void {
  cronTask?.stop();
  cronTask = null;
}
