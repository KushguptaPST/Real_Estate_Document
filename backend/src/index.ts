import 'dotenv/config';
import type { Server } from 'node:http';
import { createApp } from './app.js';
import { logger } from './utils/logger.js';
import { initAlertCron, stopAlertCron } from './services/alert.service.js';
import { initTelegramBot, stopTelegramBot } from './services/telegram.service.js';
import { assertSecurityConfig } from './services/auth.service.js';
import { prisma } from './utils/prisma.js';

// Refuse to start with an insecure configuration (missing/weak JWT_SECRET, demo login in production).
assertSecurityConfig();

const PORT = parseInt(process.env['PORT'] ?? '3001', 10);

const app = createApp();

let isShuttingDown = false;

export interface ShutdownOptions {
  timeoutMs?: number;
  exitOnComplete?: boolean;
}

/**
 * Idempotently executes graceful shutdown:
 * 1. Stops background cron jobs
 * 2. Stops accepting new HTTP requests and drains in-flight connections
 * 3. Disconnects shared Prisma connection pool
 * 4. Bounded by an emergency timeout to prevent hanging indefinitely
 */
export async function gracefulShutdown(
  server: Server | null,
  signal: string,
  options: ShutdownOptions = {},
): Promise<void> {
  if (isShuttingDown) {
    logger.warn(`[Shutdown] Already shutting down. Ignoring duplicate signal: ${signal}`);
    return;
  }
  isShuttingDown = true;
  logger.info(`[Shutdown] Received ${signal}. Initiating graceful shutdown...`);

  const timeoutMs = options.timeoutMs ?? 10000;
  const exitOnComplete = options.exitOnComplete ?? (process.env.NODE_ENV !== 'test');

  const emergencyTimer = setTimeout(() => {
    logger.error(`[Shutdown] Graceful shutdown timed out after ${timeoutMs}ms. Forcing process exit.`);
    if (exitOnComplete) {
      process.exit(1);
    }
  }, timeoutMs);
  emergencyTimer.unref();

  try {
    // 1. Stop background jobs
    stopAlertCron();
    stopTelegramBot();

    // 2. Stop accepting new HTTP requests and wait for in-flight requests to complete
    if (server && server.listening) {
      await new Promise<void>((resolve, reject) => {
        server.close((err) => {
          if (err) {
            logger.error(`[Shutdown] Error closing HTTP server: ${err.message}`);
            return reject(err);
          }
          logger.info('[Shutdown] HTTP server closed cleanly.');
          resolve();
        });
      });
    }

    // 3. Disconnect shared Prisma Client
    await prisma.$disconnect();
    logger.info('[Shutdown] Prisma client disconnected cleanly.');

    clearTimeout(emergencyTimer);
    logger.info('[Shutdown] Graceful shutdown completed successfully.');

    if (exitOnComplete) {
      process.exit(0);
    }
  } catch (err) {
    clearTimeout(emergencyTimer);
    logger.error(`[Shutdown] Error during graceful shutdown: ${err instanceof Error ? err.message : String(err)}`);
    if (exitOnComplete) {
      process.exit(1);
    }
    throw err;
  } finally {
    if (!exitOnComplete) {
      isShuttingDown = false;
    }
  }
}

export let server: Server | null = null;

if (process.env.NODE_ENV !== 'test') {
  server = app.listen(PORT, () => {
    logger.info(`🏠 Contingency Deadline Copilot API running on http://localhost:${PORT}`);
    logger.info(`   Health: http://localhost:${PORT}/health`);
    logger.info(`   Deals:  http://localhost:${PORT}/api/deals`);
    logger.info(`   Env:    ${process.env['NODE_ENV'] ?? 'development'}`);

    // Initialize automated contingency deadline alerts
    initAlertCron();

    // Initialize Telegram Bot agentic AI listener
    initTelegramBot().catch((err) => {
      logger.error(`[Telegram] Bot failed to start: ${err.message}`);
    });
  });
}

const handleSignal = (signal: string) => {
  gracefulShutdown(server, signal).catch((err) => {
    logger.error(`[Shutdown] Fatal shutdown failure: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  });
};

process.on('SIGTERM', () => handleSignal('SIGTERM'));
process.on('SIGINT', () => handleSignal('SIGINT'));
