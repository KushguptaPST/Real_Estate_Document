/**
 * Alert Service — Automated deadline alert evaluation, Resend email dispatch, and cron scheduler.
 */

import { prisma } from '../utils/prisma.js';
import cron from 'node-cron';
import { logger } from '../utils/logger.js';
import { maskEmail } from '../utils/audit.js';
import { sendEmail, generateTemplate } from './email.service.js';


export interface AlertPayload {
  to: string;
  dealId: string;
  deadlineLabel: string;
  deadlineDate: Date;
  daysUntilDeadline: number;
}

/**
 * Checks all active deals and dispatches reminders for matching windows (3d, 1d, dayOf, missed).
 */
export async function checkAndDispatchAlerts(): Promise<{ processed: number; sent: number }> {
  logger.info('[Alert Service] Running scheduled contingency alert evaluation...');
  let sentCount = 0;

  try {
    const deals = await prisma.deal.findMany({
      where: { status: 'ACTIVE' },
      include: {
        notificationSettings: true,
        deadlines: {
          where: {
            status: { in: ['CONFIRMED', 'ACTIVE', 'PENDING'] },
          },
        },
      },
    });

    const now = new Date();

    for (const deal of deals) {
      const settings = deal.notificationSettings;
      if (!settings || !settings.enabled) continue;

      const recipients = (settings.recipients as string[]) || [];
      if (recipients.length === 0) continue;

      for (const deadline of deal.deadlines) {
        const targetDate = deadline.confirmedDate ?? deadline.computedDate;
        const diffMs = targetDate.getTime() - now.getTime();
        const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

        let templateToSend: '3d' | '1d' | 'dayOf' | 'missed' | null = null;

        if (diffDays === 3 && settings.window3d) {
          templateToSend = '3d';
        } else if (diffDays === 1 && settings.window1d) {
          templateToSend = '1d';
        } else if (diffDays === 0 && settings.windowDayOf) {
          templateToSend = 'dayOf';
        } else if (diffDays < 0 && settings.windowMissed && deadline.status !== 'COMPLETED') {
          templateToSend = 'missed';
        }

        if (!templateToSend) continue;

        // Check if alert for this deadline and window was already sent
        const existingLog = await prisma.emailLog.findFirst({
          where: {
            deadlineId: deadline.id,
            template: templateToSend,
          },
        });

        if (existingLog) continue;

        const dateFormatted = targetDate.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        });

        const emailContent = generateTemplate(templateToSend, {
          dealAddress: deal.propertyAddress,
          deadlineLabel: deadline.label,
          dueDate: dateFormatted,
          dealId: deal.id,
        });

        // Dispatch to all recipients
        for (const recipient of recipients) {
          const result = await sendEmail({
            to: recipient,
            subject: emailContent.subject,
            html: emailContent.html,
            text: emailContent.text,
          });

          await prisma.emailLog.create({
            data: {
              dealId: deal.id,
              organizationId: deal.organizationId,
              deadlineId: deadline.id,
              recipient,
              template: templateToSend,
              status: result.success ? 'SENT' : 'BOUNCED',
              providerMessageId: result.messageId ?? null,
              errorMessage: result.error ?? null,
            },
          });

          if (result.success) {
            sentCount++;
            logger.info(`[Alert Sent] Dispatched ${templateToSend} for ${deadline.label} to ${maskEmail(recipient)}`);
          }
        }

        // Update deadline status to MISSED if overdue
        if (templateToSend === 'missed') {
          await prisma.deadline.update({
            where: { id: deadline.id },
            data: { status: 'MISSED' },
          });
        }

        // Log audit trail
        await prisma.auditLog.create({
          data: {
            dealId: deal.id,
            organizationId: deal.organizationId,
            action: 'ALERT_SENT',
            entityType: 'Deadline',
            entityId: deadline.id,
            actor: 'system',
            note: `Automated ${templateToSend} deadline alert dispatched via Resend to ${recipients.join(', ')}`,
          },
        });
      }
    }

    logger.info(`[Alert Service] Evaluation completed. Dispatched ${sentCount} notifications.`);
    return { processed: deals.length, sent: sentCount };
  } catch (err) {
    logger.error(`[Alert Service Error] ${err instanceof Error ? err.message : 'Unknown error'}`);
    return { processed: 0, sent: sentCount };
  }
}

let scheduledAlertTask: cron.ScheduledTask | null = null;

/**
 * Initializes the background cron job for deadline alerts.
 */
export function initAlertCron(): cron.ScheduledTask {
  const cronExpr = process.env['ALERT_CRON'] ?? '0 * * * *'; // hourly
  logger.info(`[Alert Scheduler] Initialized with cron schedule: "${cronExpr}"`);

  scheduledAlertTask = cron.schedule(cronExpr, async () => {
    await checkAndDispatchAlerts();
  });
  return scheduledAlertTask;
}

/**
 * Gracefully stops the background cron job for deadline alerts.
 */
export function stopAlertCron(): void {
  if (scheduledAlertTask) {
    scheduledAlertTask.stop();
    scheduledAlertTask = null;
    logger.info('[Alert Scheduler] Stopped background cron task.');
  }
}

export async function scheduleAlerts(dealId: string): Promise<void> {
  logger.info(`[Alert Service] Triggering immediate check for activated deal: ${dealId}`);
  await checkAndDispatchAlerts();
}
