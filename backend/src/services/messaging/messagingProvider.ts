/**
 * Messaging Provider Abstraction — Vendor-neutral outbound delivery interface.
 * Implements Resend, SendGrid, and safe mock/simulation drivers.
 */

import { logger } from '../../utils/logger.js';
import { maskEmail } from '../../utils/audit.js';

export interface OutboundMessagePayload {
  to: string;
  from?: string;
  subject: string;
  html?: string;
  text: string;
  metadata?: Record<string, string>;
}

export interface OutboundDispatchResult {
  success: boolean;
  providerMessageId?: string;
  error?: string;
  isTransient?: boolean;
}

export interface IMessagingProvider {
  readonly name: string;
  send(payload: OutboundMessagePayload): Promise<OutboundDispatchResult>;
}

/**
 * Validates email address format strictly.
 */
export function isValidEmail(email: string): boolean {
  if (!email || typeof email !== 'string') return false;
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
  return emailRegex.test(email.trim());
}

/**
 * Resend Email Provider
 */
export class ResendMessagingProvider implements IMessagingProvider {
  readonly name = 'resend';

  async send(payload: OutboundMessagePayload): Promise<OutboundDispatchResult> {
    const isProd = process.env['NODE_ENV'] === 'production';
    const isTest = process.env['NODE_ENV'] === 'test';
    const apiKey = process.env['RESEND_API_KEY'];
    const from = payload.from ?? process.env['EMAIL_FROM'] ?? 'Contingency Copilot <onboarding@resend.dev>';

    // Safety: In test or dev without key, safely simulate
    if (!apiKey) {
      if (isProd) {
        return {
          success: false,
          error: 'RESEND_API_KEY is not configured in production environment',
          isTransient: false,
        };
      }
      const simId = `sim-resend-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
      logger.info(`[Resend Simulated Send] Recipient: ${maskEmail(payload.to)}, Mock ID: ${simId}`);
      return {
        success: true,
        providerMessageId: simId,
      };
    }

    // Safety: If in test environment even with a key, do not send real emails!
    if (isTest) {
      const testId = `test-resend-${Date.now()}`;
      return { success: true, providerMessageId: testId };
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from,
          to: [payload.to],
          subject: payload.subject,
          html: payload.html || `<p>${payload.text}</p>`,
          text: payload.text,
          headers: payload.metadata ? { ...payload.metadata } : undefined,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      const data = (await response.json()) as { id?: string; message?: string; statusCode?: number };

      if (!response.ok) {
        const status = response.status;
        const isTransient = status === 429 || status >= 500;
        const errorMsg = data.message || `Resend API returned HTTP ${status}`;
        logger.error(`[Resend Dispatch Error] HTTP ${status}: ${errorMsg}`);
        return {
          success: false,
          error: errorMsg,
          isTransient,
        };
      }

      logger.info(`[Resend Dispatched] ID: ${data.id} to ${maskEmail(payload.to)}`);
      return {
        success: true,
        providerMessageId: data.id,
      };
    } catch (err: any) {
      const isAbort = err.name === 'AbortError';
      const msg = isAbort ? 'Resend API connection timed out (10s)' : (err.message || 'Unknown network error');
      logger.error(`[Resend Network Error] ${msg}`);
      return {
        success: false,
        error: msg,
        isTransient: true, // Network/timeout errors are transient
      };
    }
  }
}

/**
 * SendGrid Email Provider
 */
export class SendGridMessagingProvider implements IMessagingProvider {
  readonly name = 'sendgrid';

  async send(payload: OutboundMessagePayload): Promise<OutboundDispatchResult> {
    const isProd = process.env['NODE_ENV'] === 'production';
    const isTest = process.env['NODE_ENV'] === 'test';
    const apiKey = process.env['SENDGRID_API_KEY'];
    const from = payload.from ?? process.env['EMAIL_FROM'] ?? 'Contingency Copilot <onboarding@resend.dev>';

    if (!apiKey) {
      if (isProd) {
        return {
          success: false,
          error: 'SENDGRID_API_KEY is not configured in production environment',
          isTransient: false,
        };
      }
      const simId = `sim-sendgrid-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
      logger.info(`[SendGrid Simulated Send] Recipient: ${maskEmail(payload.to)}, Mock ID: ${simId}`);
      return {
        success: true,
        providerMessageId: simId,
      };
    }

    if (isTest) {
      const testId = `test-sendgrid-${Date.now()}`;
      return { success: true, providerMessageId: testId };
    }

    try {
      const moduleName = '@sendgrid/mail';
      const sgMail = ((await import(moduleName)) as any).default;
      sgMail.setApiKey(apiKey);

      const [response] = await sgMail.send({
        to: payload.to,
        from,
        subject: payload.subject,
        html: payload.html || `<p>${payload.text}</p>`,
        text: payload.text,
        customArgs: payload.metadata,
      });

      const messageId = response?.headers?.['x-message-id'] || `sg-${Date.now()}`;
      logger.info(`[SendGrid Dispatched] ID: ${messageId} to ${maskEmail(payload.to)}`);
      return {
        success: true,
        providerMessageId: messageId,
      };
    } catch (err: any) {
      const statusCode = err.code || err.statusCode;
      const isTransient = statusCode === 429 || (typeof statusCode === 'number' && statusCode >= 500);
      const errorMsg = err.message || 'Unknown SendGrid error';
      logger.error(`[SendGrid Dispatch Error] ${errorMsg}`);
      return {
        success: false,
        error: errorMsg,
        isTransient,
      };
    }
  }
}

/**
 * Provider factory returning the configured messaging driver.
 */
let customProviderOverride: IMessagingProvider | null = null;

export function setCustomMessagingProvider(provider: IMessagingProvider | null): void {
  customProviderOverride = provider;
}

export function getMessagingProvider(): IMessagingProvider {
  if (customProviderOverride) {
    return customProviderOverride;
  }

  const driver = (process.env['EMAIL_DRIVER'] || 'resend').toLowerCase();
  switch (driver) {
    case 'sendgrid':
      return new SendGridMessagingProvider();
    case 'resend':
    default:
      return new ResendMessagingProvider();
  }
}
