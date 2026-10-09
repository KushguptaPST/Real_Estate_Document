import { format } from 'date-fns';

export interface EmailTemplateData {
  dealId: string;
  propertyAddress: string;
  deadlineLabel?: string;
  deadlineDate?: Date | string;
  dayType?: string;
  buyerName?: string;
  sellerName?: string;
  clauseText?: string;
  documentCount?: number;
  unconfirmedCount?: number;
  appUrl?: string;
}

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

function getAppUrl(): string {
  return process.env['FRONTEND_URL'] || process.env['CORS_ORIGIN'] || 'http://localhost:3000';
}

function formatDateFull(dateVal?: Date | string): string {
  if (!dateVal) return 'N/A';
  const d = typeof dateVal === 'string' ? new Date(dateVal) : dateVal;
  return format(d, 'EEEE, MMMM d, yyyy');
}

export function renderEmailTemplate(templateName: string, data: EmailTemplateData): RenderedEmail {
  const appUrl = data.appUrl || getAppUrl();
  const dealUrl = `${appUrl}/deals/${data.dealId}`;
  const dateFormatted = formatDateFull(data.deadlineDate);

  const disclaimerText = 'Notice: All tracked dates are confirmed by the managing agent. Contingency Deadline Copilot provides date tracking support and does not constitute legal advice.';

  switch (templateName) {
    case 'd3':
    case '3-day': {
      const subject = `[3-Day Notice] ${data.deadlineLabel || 'Contingency'} Due Soon — ${data.propertyAddress}`;
      const text = `3-DAY CONTINGENCY NOTICE\n\nProperty: ${data.propertyAddress}\nContingency: ${data.deadlineLabel}\nDue Date: ${dateFormatted}\n\nReview & Action Required: View deal timeline at ${dealUrl}\n\n${disclaimerText}`;
      const html = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background: #0f172a; color: #f8fafc; border-radius: 12px; border: 1px solid #1e293b;">
          <div style="margin-bottom: 16px;">
            <span style="background: rgba(59, 130, 246, 0.2); color: #60a5fa; border: 1px solid rgba(59, 130, 246, 0.4); padding: 4px 10px; border-radius: 6px; font-size: 12px; font-weight: 600; text-transform: uppercase;">3-Day Upcoming Deadline</span>
          </div>
          <h2 style="color: #ffffff; margin-top: 0;">${data.deadlineLabel || 'Contingency Deadline'}</h2>
          <p style="color: #94a3b8; font-size: 14px;"><strong>Property:</strong> ${data.propertyAddress}</p>
          <div style="background: #1e293b; padding: 16px; border-radius: 8px; border-left: 4px solid #3b82f6; margin: 20px 0;">
            <p style="margin: 0; font-size: 14px; color: #94a3b8;">Target Due Date:</p>
            <p style="margin: 4px 0 0 0; font-size: 18px; font-weight: 700; color: #ffffff;">${dateFormatted}</p>
          </div>
          ${data.clauseText ? `<p style="color: #cbd5e1; font-style: italic; font-size: 13px; background: rgba(255,255,255,0.03); padding: 12px; border-radius: 6px;">"${data.clauseText}"</p>` : ''}
          <div style="margin-top: 24px;">
            <a href="${dealUrl}" style="background: #2563eb; color: #ffffff; padding: 10px 20px; border-radius: 8px; font-weight: 600; text-decoration: none; display: inline-block;">View Deal Timeline &rarr;</a>
          </div>
          <hr style="border: 0; border-top: 1px solid #334155; margin: 24px 0;" />
          <p style="font-size: 11px; color: #64748b; margin: 0;">${disclaimerText}</p>
        </div>
      `;
      return { subject, html, text };
    }

    case 'd1':
    case '1-day': {
      const subject = `[URGENT 1-Day Warning] ${data.deadlineLabel || 'Contingency'} Due Tomorrow — ${data.propertyAddress}`;
      const text = `URGENT 1-DAY CONTINGENCY WARNING\n\nProperty: ${data.propertyAddress}\nContingency: ${data.deadlineLabel}\nDue Tomorrow: ${dateFormatted}\n\nAction Required: View deal timeline at ${dealUrl}\n\n${disclaimerText}`;
      const html = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background: #0f172a; color: #f8fafc; border-radius: 12px; border: 1px solid #dc2626;">
          <div style="margin-bottom: 16px;">
            <span style="background: rgba(239, 68, 68, 0.2); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.4); padding: 4px 10px; border-radius: 6px; font-size: 12px; font-weight: 600; text-transform: uppercase;">Urgent: Due Tomorrow</span>
          </div>
          <h2 style="color: #ffffff; margin-top: 0;">${data.deadlineLabel || 'Contingency Deadline'}</h2>
          <p style="color: #94a3b8; font-size: 14px;"><strong>Property:</strong> ${data.propertyAddress}</p>
          <div style="background: #1e293b; padding: 16px; border-radius: 8px; border-left: 4px solid #ef4444; margin: 20px 0;">
            <p style="margin: 0; font-size: 14px; color: #f87171; font-weight: 600;">Deadline Expires Tomorrow:</p>
            <p style="margin: 4px 0 0 0; font-size: 18px; font-weight: 700; color: #ffffff;">${dateFormatted}</p>
          </div>
          <div style="margin-top: 24px;">
            <a href="${dealUrl}" style="background: #dc2626; color: #ffffff; padding: 10px 20px; border-radius: 8px; font-weight: 600; text-decoration: none; display: inline-block;">Manage Deadline Now &rarr;</a>
          </div>
          <hr style="border: 0; border-top: 1px solid #334155; margin: 24px 0;" />
          <p style="font-size: 11px; color: #64748b; margin: 0;">${disclaimerText}</p>
        </div>
      `;
      return { subject, html, text };
    }

    case 'day_of': {
      const subject = `[DUE TODAY] ${data.deadlineLabel || 'Contingency'} — ${data.propertyAddress}`;
      const text = `DUE TODAY: ${data.deadlineLabel}\nProperty: ${data.propertyAddress}\nDate: ${dateFormatted}\n\nView deal timeline at ${dealUrl}\n\n${disclaimerText}`;
      const html = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background: #0f172a; color: #f8fafc; border-radius: 12px; border: 1px solid #f59e0b;">
          <div style="margin-bottom: 16px;">
            <span style="background: rgba(245, 158, 11, 0.2); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.4); padding: 4px 10px; border-radius: 6px; font-size: 12px; font-weight: 600; text-transform: uppercase;">Expires Today</span>
          </div>
          <h2 style="color: #ffffff; margin-top: 0;">${data.deadlineLabel || 'Contingency Deadline'}</h2>
          <p style="color: #94a3b8; font-size: 14px;"><strong>Property:</strong> ${data.propertyAddress}</p>
          <div style="background: #1e293b; padding: 16px; border-radius: 8px; border-left: 4px solid #f59e0b; margin: 20px 0;">
            <p style="margin: 0; font-size: 14px; color: #fbbf24; font-weight: 600;">Due Date Today:</p>
            <p style="margin: 4px 0 0 0; font-size: 18px; font-weight: 700; color: #ffffff;">${dateFormatted}</p>
          </div>
          <div style="margin-top: 24px;">
            <a href="${dealUrl}" style="background: #d97706; color: #ffffff; padding: 10px 20px; border-radius: 8px; font-weight: 600; text-decoration: none; display: inline-block;">Open Deal Dashboard &rarr;</a>
          </div>
          <hr style="border: 0; border-top: 1px solid #334155; margin: 24px 0;" />
          <p style="font-size: 11px; color: #64748b; margin: 0;">${disclaimerText}</p>
        </div>
      `;
      return { subject, html, text };
    }

    case 'missed': {
      const subject = `[OVERDUE DEADLINE] ${data.deadlineLabel || 'Contingency'} Missed — ${data.propertyAddress}`;
      const text = `OVERDUE DEADLINE: ${data.deadlineLabel}\nProperty: ${data.propertyAddress}\nDate: ${dateFormatted}\n\nCheck deal status at ${dealUrl}\n\n${disclaimerText}`;
      const html = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background: #0f172a; color: #f8fafc; border-radius: 12px; border: 1px solid #ef4444;">
          <div style="margin-bottom: 16px;">
            <span style="background: rgba(239, 68, 68, 0.2); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.4); padding: 4px 10px; border-radius: 6px; font-size: 12px; font-weight: 600; text-transform: uppercase;">Overdue Notice</span>
          </div>
          <h2 style="color: #ffffff; margin-top: 0;">${data.deadlineLabel || 'Contingency Deadline'}</h2>
          <p style="color: #94a3b8; font-size: 14px;"><strong>Property:</strong> ${data.propertyAddress}</p>
          <div style="background: #1e293b; padding: 16px; border-radius: 8px; border-left: 4px solid #ef4444; margin: 20px 0;">
            <p style="margin: 0; font-size: 14px; color: #f87171;">Original Target Due Date:</p>
            <p style="margin: 4px 0 0 0; font-size: 18px; font-weight: 700; color: #ffffff;">${dateFormatted}</p>
          </div>
          <div style="margin-top: 24px;">
            <a href="${dealUrl}" style="background: #dc2626; color: #ffffff; padding: 10px 20px; border-radius: 8px; font-weight: 600; text-decoration: none; display: inline-block;">Update Status &rarr;</a>
          </div>
          <hr style="border: 0; border-top: 1px solid #334155; margin: 24px 0;" />
          <p style="font-size: 11px; color: #64748b; margin: 0;">${disclaimerText}</p>
        </div>
      `;
      return { subject, html, text };
    }

    case 'documents-received': {
      const subject = `[Document Uploaded] New Purchase Agreement Received — ${data.propertyAddress}`;
      const text = `NEW DOCUMENT RECEIVED\nProperty: ${data.propertyAddress}\nAI Extraction Complete. Please review and confirm detected contingency dates.\n\nReview now: ${dealUrl}/review\n\n${disclaimerText}`;
      const html = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background: #0f172a; color: #f8fafc; border-radius: 12px; border: 1px solid #10b981;">
          <div style="margin-bottom: 16px;">
            <span style="background: rgba(16, 185, 129, 0.2); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.4); padding: 4px 10px; border-radius: 6px; font-size: 12px; font-weight: 600; text-transform: uppercase;">Document Processing Complete</span>
          </div>
          <h2 style="color: #ffffff; margin-top: 0;">Purchase Agreement Processed</h2>
          <p style="color: #94a3b8; font-size: 14px;"><strong>Property:</strong> ${data.propertyAddress}</p>
          <p style="color: #cbd5e1; font-size: 14px;">Contingency clauses were automatically extracted from your uploaded PDF contract. Please review and confirm each extracted deadline date to activate automated tracking and warnings.</p>
          <div style="margin-top: 24px;">
            <a href="${dealUrl}/review" style="background: #059669; color: #ffffff; padding: 10px 20px; border-radius: 8px; font-weight: 600; text-decoration: none; display: inline-block;">Review &amp; Confirm Dates &rarr;</a>
          </div>
          <hr style="border: 0; border-top: 1px solid #334155; margin: 24px 0;" />
          <p style="font-size: 11px; color: #64748b; margin: 0;">${disclaimerText}</p>
        </div>
      `;
      return { subject, html, text };
    }

    case 'deal-summary':
    default: {
      const subject = `[Deal Summary Report] ${data.propertyAddress} — Timeline Overview`;
      const text = `DEAL SUMMARY REPORT\nProperty: ${data.propertyAddress}\nView complete details and audit log at ${dealUrl}\n\n${disclaimerText}`;
      const html = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background: #0f172a; color: #f8fafc; border-radius: 12px; border: 1px solid #334155;">
          <h2 style="color: #ffffff; margin-top: 0;">Deal Executive Summary</h2>
          <p style="color: #94a3b8; font-size: 14px;"><strong>Property:</strong> ${data.propertyAddress}</p>
          <p style="color: #cbd5e1; font-size: 14px;">A complete overview of your purchase agreement timeline, verified clauses, and active alerts is available in your copilot dashboard.</p>
          <div style="margin-top: 24px;">
            <a href="${dealUrl}" style="background: #2563eb; color: #ffffff; padding: 10px 20px; border-radius: 8px; font-weight: 600; text-decoration: none; display: inline-block;">Open Deal Dashboard &rarr;</a>
          </div>
          <hr style="border: 0; border-top: 1px solid #334155; margin: 24px 0;" />
          <p style="font-size: 11px; color: #64748b; margin: 0;">${disclaimerText}</p>
        </div>
      `;
      return { subject, html, text };
    }
  }
}
