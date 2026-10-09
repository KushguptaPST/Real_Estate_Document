# Email & Inbound Processing Architecture (Person A)

## Overview
Contingency Deadline Copilot provides automated email alerts for upcoming deal contingencies, along with SendGrid Inbound Parse integration for direct email-in document upload.

---

## 1. Automated Email Alerts & Cron Scheduler

### Services & Components:
* **`services/email.service.ts`**: Deliver emails via `@sendgrid/mail` with exponential backoff retries (3 attempts). Includes a safe fallback dev logger when `SENDGRID_API_KEY` is not present. Protects user PII by never logging full email body strings.
* **`services/emailTemplates.ts`**: Generates HTML & text templates for 6 scenarios: `3-day`, `1-day`, `day-of`, `missed`, `deal-summary`, and `documents-received`.
* **`services/scheduler.service.ts`**: Background daemon running on `ALERT_CRON` schedule (default: hourly `0 * * * *`).

### Idempotency & Timezone Rules:
1. **Advisory Locks:** Acquires a PostgreSQL transaction advisory lock (`pg_try_advisory_xact_lock`) on every cron tick to prevent duplicate email sends when multiple backend instances are deployed.
2. **Unique Database Constraint:** `EmailLog` table enforces `@@unique([deadlineId, window])`. An email for a specific window (`d3`, `d1`, `day_of`, `missed`) will fire **at most once per deadline**.
3. **Reset on Date Edit:** If an agent edits a confirmed deadline date, `resetDeadlineAlertWindows(deadlineId)` clears previous window records so new alerts calculate correctly for the updated date.
4. **Catch-up Rule:** If a deadline is confirmed when already inside a window (e.g. 2 days before due date), the system triggers the appropriate active window (`d3`) on the next tick.

---

## 2. SendGrid Inbound Parse Webhook

### Endpoint: `POST /api/inbound/email`

### Intake Flow:
1. **Security Check:** Validates URL secret parameter `?secret=YOUR_WEBHOOK_SECRET` or header `x-inbound-secret` against `INBOUND_WEBHOOK_SECRET`.
2. **Deal Alias Matching:** Matches `deal-<shortId>@inbound.domain.com` alias to the target deal, or falls back to property address matching in the subject line.
3. **Sender Allowlist:** Checks sender email address against the deal's `NotificationSetting.recipients` allowlist.
4. **PDF Security Validation:**
   * Checks MIME type `application/pdf`.
   * Reads raw file bytes to verify magic header (`%PDF` / `0x25 0x50 0x44 0x46`).
   * Rejects non-PDF or oversized files (> 25MB).
5. **Ingestion & AI Extraction:**
   * Saves PDF file via `storage.service.ts`.
   * Creates `Document` row in Postgres.
   * Writes `AuditLog` for `DOCUMENT_UPLOADED` (with `source="email"`) and `EMAIL_INBOUND_RECEIVED`.
   * Launches Gemini AI clause extraction pipeline asynchronously.
   * Dispatches `documents-received` email to configured deal recipients.

---

## 3. Notification API Endpoints

* `GET /api/deals/:id/notifications/settings`: Get deal alert settings.
* `PUT /api/deals/:id/notifications/settings`: Update recipients, window flags (`d3`, `d1`, `dayOf`, `missed`), timezone.
* `POST /api/deals/:id/notifications/test`: Send instant test alert email.
* `POST /api/deals/:id/notifications/summary`: Send full deal summary email report.
* `POST /api/deals/:id/notifications/preview`: Render subject, HTML, and text preview for templates.
* `GET /api/deals/:id/notifications/log`: View history of sent/pending email logs.
* `GET /api/deals/:id/notifications/inbound-address`: Retrieve deal's unique forwarding email alias.
