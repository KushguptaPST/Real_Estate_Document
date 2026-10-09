/**
 * Email Service — Real-time transactional email delivery via Resend / SMTP / SendGrid.
 */

import nodemailer from 'nodemailer';
import { logger } from '../utils/logger.js';

export interface SendEmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  from?: string;
}

export interface SendEmailResult {
  success: boolean;
  messageId?: string;
  providerMessageId?: string;
  error?: string;
}

/**
 * Dispatches an email using the configured provider (Resend, SendGrid, or SMTP).
 */
export async function sendEmail(options: SendEmailOptions): Promise<SendEmailResult> {
  const driver = process.env['EMAIL_DRIVER'] ?? 'resend';
  const from = options.from ?? process.env['EMAIL_FROM'] ?? 'Contingency Copilot <onboarding@resend.dev>';
  const recipients = Array.isArray(options.to) ? options.to : [options.to];

  if (recipients.length === 0) {
    return { success: false, error: 'No recipients provided' };
  }

  // 1. SendGrid Provider
  if (driver === 'sendgrid') {
    const apiKey = process.env['SENDGRID_API_KEY'];
    if (!apiKey) {
      logger.warn('[Email] SENDGRID_API_KEY is not configured. Falling back to dev logger mode.');
      const stubId = `dev-stub-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      return { success: true, messageId: stubId, providerMessageId: stubId };
    }

    try {
      const sgMail = (await import('@sendgrid/mail')).default;
      sgMail.setApiKey(apiKey);
      const [response] = await sgMail.send({
        to: recipients,
        from,
        subject: options.subject,
        html: options.html,
        text: options.text,
      });
      const messageId = response?.headers?.['x-message-id'] || `sg-${Date.now()}`;
      logger.info(`[Email sent via SendGrid] ID: ${messageId} to ${recipients.join(', ')}`);
      return { success: true, messageId, providerMessageId: messageId };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      logger.error(`[SendGrid Error] ${msg}`);
      return { success: false, error: msg };
    }
  }

  // 2. Resend Provider (Recommended)
  if (driver === 'resend') {
    const apiKey = process.env['RESEND_API_KEY'];
    if (!apiKey) {
      logger.warn('[Email] RESEND_API_KEY is not set. Simulating email send.');
      const stubId = `dev-stub-resend-${Date.now()}`;
      return { success: true, messageId: stubId, providerMessageId: stubId };
    }

    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from,
          to: recipients,
          subject: options.subject,
          html: options.html,
          text: options.text,
        }),
      });

      const data = (await response.json()) as { id?: string; message?: string; name?: string };

      if (!response.ok) {
        logger.error(`[Resend Error] ${data.message || response.statusText}`);
        return { success: false, error: data.message || `HTTP ${response.status}` };
      }

      logger.info(`[Email sent via Resend] ID: ${data.id} to ${recipients.join(', ')}`);
      return { success: true, messageId: data.id, providerMessageId: data.id };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      logger.error(`[Resend Network Error] ${msg}`);
      return { success: false, error: msg };
    }
  }

  // 3. Standard SMTP (Nodemailer)
  if (driver === 'smtp') {
    const host = process.env['SMTP_HOST'];
    const user = process.env['SMTP_USER'];
    const pass = process.env['SMTP_PASS'];

    if (!host || !user || !pass) {
      logger.warn('[Email] SMTP credentials not fully set. Simulating email send.');
      const stubId = `dev-stub-smtp-${Date.now()}`;
      return { success: true, messageId: stubId, providerMessageId: stubId };
    }

    try {
      const transporter = nodemailer.createTransport({
        host,
        port: Number(process.env['SMTP_PORT'] ?? 587),
        secure: process.env['SMTP_SECURE'] === 'true',
        auth: { user, pass },
      });

      const info = await transporter.sendMail({
        from,
        to: recipients.join(', '),
        subject: options.subject,
        html: options.html,
        text: options.text,
      });

      logger.info(`[Email sent via SMTP] ID: ${info.messageId} to ${recipients.join(', ')}`);
      return { success: true, messageId: info.messageId, providerMessageId: info.messageId };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      logger.error(`[SMTP Error] ${msg}`);
      return { success: false, error: msg };
    }
  }

  // Default fallback
  const stubId = `dev-stub-fallback-${Date.now()}`;
  logger.info(`[Email Mock] Would send to ${recipients.join(', ')}: "${options.subject}"`);
  return { success: true, messageId: stubId, providerMessageId: stubId };
}

// ── HTML Email Templates ───────────────────────────────────────────────────────

function emailShell(content: string, preheader: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Contingency Copilot</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; color: #0f172a; margin: 0; padding: 24px 12px; }
    .container { max-width: 580px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); }
    .header { background: #0f172a; padding: 24px; text-align: center; }
    .header h1 { color: #ffffff; margin: 0; font-size: 18px; font-weight: 700; letter-spacing: -0.02em; }
    .content { padding: 32px 24px; }
    .badge { display: inline-block; padding: 4px 10px; border-radius: 9999px; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; }
    .badge-amber { background: #fef3c7; color: #92400e; }
    .badge-rose { background: #ffe4e6; color: #9f1239; }
    .badge-emerald { background: #d1fae5; color: #065f46; }
    .badge-blue { background: #e0f2fe; color: #0369a1; }
    .info-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 18px; margin: 20px 0; }
    .info-row { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #f1f5f9; font-size: 13px; }
    .info-row:last-child { border-bottom: none; }
    .info-label { color: #64748b; font-weight: 500; }
    .info-value { color: #0f172a; font-weight: 600; text-align: right; }
    .btn { display: inline-block; background: #0f172a; color: #ffffff !important; padding: 12px 24px; border-radius: 10px; text-decoration: none; font-weight: 600; font-size: 13px; text-align: center; margin-top: 16px; }
    .footer { padding: 20px 24px; background: #f8fafc; border-top: 1px solid #e2e8f0; text-align: center; font-size: 11px; color: #94a3b8; }
  </style>
</head>
<body>
  <div style="display:none;font-size:1px;color:#333333;line-height:1px;max-height:0px;max-width:0px;opacity:0;overflow:hidden;">
    ${preheader}
  </div>
  <div class="container">
    <div class="header">
      <h1>Contingency Deadline Copilot</h1>
    </div>
    <div class="content">
      ${content}
    </div>
    <div class="footer">
      Automated Real Estate Compliance Engine • Strictly Confidential<br>
      Protecting buyer earnest money deposits and contractual milestones.
    </div>
  </div>
</body>
</html>`;
}

export function generateTemplate(
  template: '3d' | '1d' | 'dayOf' | 'missed' | 'summary' | 'docs_received',
  data: {
    dealAddress: string;
    deadlineLabel?: string;
    dueDate?: string;
    daysRemaining?: number;
    buyerName?: string;
    sellerName?: string;
    deadlines?: Array<{ label: string; status: string; dueDate: string }>;
    appUrl?: string;
    dealId?: string;
  },
): { subject: string; html: string; text: string } {
  const appUrl = data.appUrl ?? 'http://localhost:3000';
  const dealLink = data.dealId ? `${appUrl}/deals/${data.dealId}` : appUrl;
  const address = data.dealAddress || 'Property Transaction';

  switch (template) {
    case '3d': {
      const subject = `[T-3 Early Warning] ${data.deadlineLabel ?? 'Contingency'} Due Soon — ${address}`;
      const preheader = `Action required in 3 days: ${data.deadlineLabel} deadline approaching.`;
      const html = emailShell(
        `
        <span class="badge badge-amber">3-Day Notice</span>
        <h2 style="font-size: 20px; font-weight: 700; color: #0f172a; margin: 12px 0 6px;">${data.deadlineLabel ?? 'Contingency Deadline'} Due in 3 Days</h2>
        <p style="font-size: 14px; color: #475569; line-height: 1.5; margin: 0 0 16px;">
          This is an early reminder to ensure all required documentation, inspections, or loan approval letters are on track before the contingency period expires.
        </p>
        <div class="info-card">
          <div class="info-row"><span class="info-label">Property:</span><span class="info-value">${address}</span></div>
          <div class="info-row"><span class="info-label">Milestone:</span><span class="info-value">${data.deadlineLabel ?? 'Contingency'}</span></div>
          <div class="info-row"><span class="info-label">Due Date:</span><span class="info-value">${data.dueDate ?? 'Upcoming'}</span></div>
          <div class="info-row"><span class="info-label">Action Window:</span><span class="info-value" style="color: #b45309;">72 Hours Remaining</span></div>
        </div>
        <div style="text-align: center;">
          <a href="${dealLink}" class="btn">Open Deal Workspace &rarr;</a>
        </div>
      `,
        preheader,
      );
      const text = `3-DAY NOTICE: ${data.deadlineLabel} for ${address} is due on ${data.dueDate}. Review transaction: ${dealLink}`;
      return { subject, html, text };
    }

    case '1d': {
      const subject = `[CRITICAL: T-1 Day] Action Required Tomorrow: ${data.deadlineLabel ?? 'Contingency'} — ${address}`;
      const preheader = `URGENT: ${data.deadlineLabel} expires in 24 hours. Sign contingency removal or request extension.`;
      const html = emailShell(
        `
        <span class="badge badge-rose">Urgent 24-Hour Notice</span>
        <h2 style="font-size: 20px; font-weight: 700; color: #9f1239; margin: 12px 0 6px;">${data.deadlineLabel ?? 'Contingency Deadline'} Expires Tomorrow</h2>
        <p style="font-size: 14px; color: #475569; line-height: 1.5; margin: 0 0 16px;">
          Please ensure the buyer signs the contingency removal notice (or submits a formal extension addendum) before 5:00 PM tomorrow to avoid breach or notice to perform.
        </p>
        <div class="info-card">
          <div class="info-row"><span class="info-label">Property:</span><span class="info-value">${address}</span></div>
          <div class="info-row"><span class="info-label">Milestone:</span><span class="info-value">${data.deadlineLabel ?? 'Contingency'}</span></div>
          <div class="info-row"><span class="info-label">Expiration:</span><span class="info-value" style="color: #e11d48;">Tomorrow, ${data.dueDate ?? ''}</span></div>
        </div>
        <div style="text-align: center;">
          <a href="${dealLink}" class="btn" style="background: #e11d48;">Review &amp; Confirm Removal &rarr;</a>
        </div>
      `,
        preheader,
      );
      const text = `CRITICAL 24-HR NOTICE: ${data.deadlineLabel} for ${address} expires tomorrow (${data.dueDate}). Review deal: ${dealLink}`;
      return { subject, html, text };
    }

    case 'dayOf': {
      const subject = `[TODAY] Expiration Notice: ${data.deadlineLabel ?? 'Contingency'} — ${address}`;
      const preheader = `FINAL NOTICE: ${data.deadlineLabel} expires today. Submit removal documents now.`;
      const html = emailShell(
        `
        <span class="badge badge-rose">Final Expiration Notice</span>
        <h2 style="font-size: 20px; font-weight: 700; color: #9f1239; margin: 12px 0 6px;">${data.deadlineLabel ?? 'Contingency Deadline'} Expires TODAY</h2>
        <p style="font-size: 14px; color: #475569; line-height: 1.5; margin: 0 0 16px;">
          Today is the contractual expiration date for this milestone. Immediate execution and document delivery is required.
        </p>
        <div class="info-card">
          <div class="info-row"><span class="info-label">Property:</span><span class="info-value">${address}</span></div>
          <div class="info-row"><span class="info-label">Milestone:</span><span class="info-value">${data.deadlineLabel ?? 'Contingency'}</span></div>
          <div class="info-row"><span class="info-label">Status:</span><span class="info-value" style="color: #e11d48; font-weight: 700;">Expiring Today (${data.dueDate ?? ''})</span></div>
        </div>
        <div style="text-align: center;">
          <a href="${dealLink}" class="btn" style="background: #9f1239;">Complete Milestone Now &rarr;</a>
        </div>
      `,
        preheader,
      );
      const text = `FINAL NOTICE TODAY: ${data.deadlineLabel} for ${address} expires today. Complete here: ${dealLink}`;
      return { subject, html, text };
    }

    case 'missed': {
      const subject = `[PAST DUE ALERT] Action Overdue: ${data.deadlineLabel ?? 'Contingency'} — ${address}`;
      const preheader = `ESC-RISK: Milestone date has passed without recorded removal.`;
      const html = emailShell(
        `
        <span class="badge badge-rose">Escalation Notice</span>
        <h2 style="font-size: 20px; font-weight: 700; color: #9f1239; margin: 12px 0 6px;">${data.deadlineLabel ?? 'Contingency'} is Past Due</h2>
        <p style="font-size: 14px; color: #475569; line-height: 1.5; margin: 0 0 16px;">
          The scheduled deadline has elapsed without confirmed completion. The transaction coordinator and managing broker should review earnest money and notice-to-perform risks immediately.
        </p>
        <div class="info-card">
          <div class="info-row"><span class="info-label">Property:</span><span class="info-value">${address}</span></div>
          <div class="info-row"><span class="info-label">Milestone:</span><span class="info-value">${data.deadlineLabel ?? 'Contingency'}</span></div>
          <div class="info-row"><span class="info-label">Original Due Date:</span><span class="info-value" style="color: #e11d48;">${data.dueDate ?? 'Past Due'}</span></div>
        </div>
        <div style="text-align: center;">
          <a href="${dealLink}" class="btn">Resolve Milestone Status &rarr;</a>
        </div>
      `,
        preheader,
      );
      const text = `PAST DUE: ${data.deadlineLabel} for ${address} is past due (${data.dueDate}). Check status: ${dealLink}`;
      return { subject, html, text };
    }

    case 'summary': {
      const subject = `[Transaction Summary] Contingency Milestone Status — ${address}`;
      const preheader = `Current status of all contingency deadlines for ${address}.`;
      const deadlineRows = (data.deadlines || [])
        .map(
          (d) => `
        <div class="info-row">
          <span class="info-label">${d.label}</span>
          <span class="info-value">${d.dueDate} • <strong style="font-size: 11px;">${d.status}</strong></span>
        </div>`,
        )
        .join('');

      const html = emailShell(
        `
        <span class="badge badge-blue">Deal Intelligence</span>
        <h2 style="font-size: 20px; font-weight: 700; color: #0f172a; margin: 12px 0 6px;">Contingency Timeline Overview</h2>
        <p style="font-size: 14px; color: #475569; line-height: 1.5; margin: 0 0 16px;">
          Here is the active milestone tracking brief for <strong>${address}</strong>:
        </p>
        <div class="info-card">
          <div class="info-row"><span class="info-label">Property Address:</span><span class="info-value">${address}</span></div>
          ${data.buyerName ? `<div class="info-row"><span class="info-label">Buyer:</span><span class="info-value">${data.buyerName}</span></div>` : ''}
          ${data.sellerName ? `<div class="info-row"><span class="info-label">Seller:</span><span class="info-value">${data.sellerName}</span></div>` : ''}
        </div>
        <h3 style="font-size: 14px; font-weight: 700; color: #0f172a; margin: 16px 0 8px;">Key Milestones &amp; Dates:</h3>
        <div class="info-card">
          ${deadlineRows || '<div style="font-size: 12px; color: #94a3b8; text-align: center;">No deadlines scheduled yet.</div>'}
        </div>
        <div style="text-align: center;">
          <a href="${dealLink}" class="btn">View Live Deal Workspace &rarr;</a>
        </div>
      `,
        preheader,
      );
      const text = `TRANSACTION SUMMARY for ${address}:\n${(data.deadlines || []).map((d) => `- ${d.label}: ${d.dueDate} (${d.status})`).join('\n')}\nView: ${dealLink}`;
      return { subject, html, text };
    }

    case 'docs_received':
    default: {
      const subject = `[Documents Ingested] New Contract Document Attached — ${address}`;
      const preheader = `New document received and processed for ${address}.`;
      const html = emailShell(
        `
        <span class="badge badge-emerald">New Document</span>
        <h2 style="font-size: 20px; font-weight: 700; color: #0f172a; margin: 12px 0 6px;">Contract Document Ingested</h2>
        <p style="font-size: 14px; color: #475569; line-height: 1.5; margin: 0 0 16px;">
          A new document was forwarded to this deal's inbound email alias and indexed into your AI copilot workspace.
        </p>
        <div class="info-card">
          <div class="info-row"><span class="info-label">Property:</span><span class="info-value">${address}</span></div>
          <div class="info-row"><span class="info-label">Status:</span><span class="info-value" style="color: #059669;">Indexed &amp; Verified</span></div>
        </div>
        <div style="text-align: center;">
          <a href="${dealLink}" class="btn">Open Copilot &rarr;</a>
        </div>
      `,
        preheader,
      );
      const text = `DOCUMENT INGESTED for ${address}. View deal: ${dealLink}`;
      return { subject, html, text };
    }
  }
}
