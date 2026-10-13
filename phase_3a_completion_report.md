# Phase 3A Completion Report — Production-Grade Outbound Messaging Integration

**Project:** AI Real Estate Sales Agent & Multi-Tenant Contingency Copilot  
**Repository:** `/Users/badal11/Desktop/Real_Estate_Contigency`  
**Phase:** Phase 3A — Production-Grade Outbound Messaging Integration  
**Date:** 2026-10-12  
**Status:** Verification Complete — All Criteria Met  

---

## 1. Architecture Decisions & Provider Choice

### Provider Selection: Resend (Default) with SendGrid Adapter
- **Primary Driver:** `resend` via REST API (`https://api.resend.com/emails`) using standard fetch without unnecessary heavyweight dependencies.
- **Secondary Driver:** `sendgrid` adapter provided through `IMessagingProvider` interface.
- **Provider Abstraction:** Implemented `IMessagingProvider` interface in `backend/src/services/messaging/messagingProvider.ts`. Application services and business logic interact exclusively through `IMessagingProvider` and never call external vendor SDKs directly.
- **Safe Development & Test Simulation:** When `RESEND_API_KEY` or `SENDGRID_API_KEY` is not configured outside production, or when `NODE_ENV === 'test'`, simulated outbound dispatch is executed with mock IDs (`sim-resend-...`), guaranteeing that **zero real external emails or customer communications are sent during automated testing or local development**.
- **Production Fail-Closed Guarantee:** In production (`NODE_ENV === 'production'`), any dispatch requested without valid provider configuration immediately returns a non-transient failure and fails closed.

### Durable Queue Architecture: Transactional Outbox Pattern
- **Decision:** As established in the repository audit, Redis/BullMQ are not configured in this project. Instead of introducing external infrastructure, we implemented a durable, ACID-compliant **Transactional Outbox Pattern** directly in PostgreSQL via Prisma.
- **Atomicity:** When an AI draft is approved or an advisor message is dispatched, message state updates and outbox job insertion (`OutboxJob`) occur within a single atomic Prisma transaction (`prisma.$transaction`).
- **Concurrency & Locking:** Outbox workers acquire jobs using conditional optimistic locking (`updateMany` with `status`, `updatedAt`, and `lockedAt`), ensuring that multiple concurrent worker processes never dispatch the same message twice.

---

## 2. Files Changed & Why

| File | Change Type | Purpose |
| :--- | :--- | :--- |
| `backend/prisma/schema.prisma` | Modified | Added `DeliveryStatus` and `OutboxStatus` enums, delivery fields to `ConversationMessage`, `OutboxJob` model, and new audit action enums. |
| `backend/prisma/migrations/20261012000000_p3a_outbound_dispatch/migration.sql` | New | Forward-only SQL migration for outbox tables, delivery status fields, and audit enum values. |
| `backend/src/services/messaging/messagingProvider.ts` | New | Provider abstraction (`IMessagingProvider`), Resend and SendGrid drivers, and safe dev/test mocking. |
| `backend/src/services/messaging/outboxDispatcher.ts` | New | Outbox queueing, optimistic concurrency locking, bounded exponential backoff, worker dispatch, and manual retry handler. |
| `backend/src/api/routes/messagingWebhooks.ts` | New | Signature-verified webhook endpoints (`POST /api/webhooks/resend`, `POST /api/webhooks/sendgrid`) with idempotency and terminal status guards. |
| `backend/src/services/webhook.service.ts` | Modified | Added `verifySvixSignature` for constant-time HMAC-SHA256 signature verification over Svix headers (`svix-id`, `svix-timestamp`, `svix-signature`). |
| `backend/src/services/conversation.service.ts` | Modified | Connected approved AI drafts and advisor messages to outbox dispatch queue; added `retryLeadMessage`. |
| `backend/src/api/routes/conversations.ts` | Modified | Added `POST /api/leads/:id/conversations/messages/:msgId/retry` route with lead ownership and role authorization. |
| `backend/src/app.ts` | Modified | Mounted `/api/webhooks` router for external delivery status webhooks. |
| `backend/.env.example` | Modified | Added placeholder configuration for `RESEND_WEBHOOK_SECRET`, `SENDGRID_API_KEY`, and `SENDGRID_WEBHOOK_SECRET`. |
| `frontend/src/services/api.ts` | Modified | Added `conversationsApi.retryMessage(leadId, msgId)`. |
| `frontend/src/pages/LeadDetailPage.tsx` | Modified | Rendered delivery status badges (`Queued`, `Sending...`, `Dispatched`, `Delivered`, `Failed`, `Retry Pending`), failure notice, double-click guards, and "Retry Dispatch" button. |
| `backend/tests/security/p3aOutboundMessaging.test.ts` | New | Comprehensive 15-test verification suite covering lifecycle, concurrency, retries, webhooks, and PII redaction. |

---

## 3. Database & Migration Changes

### Forward-Only Schema Additions
1. **Enums Added:**
   - `DeliveryStatus`: `NOT_APPLICABLE`, `QUEUED`, `SENDING`, `SENT`, `DELIVERED`, `FAILED`, `RETRY_PENDING`
   - `OutboxStatus`: `PENDING`, `PROCESSING`, `COMPLETED`, `FAILED`, `RETRYING`
   - `AuditAction`: Added `MESSAGE_DISPATCH_QUEUED`, `MESSAGE_SENT`, `MESSAGE_DELIVERED`, `MESSAGE_DISPATCH_FAILED`, `MESSAGE_BOUNCED`, `MESSAGE_RETRY_REQUESTED`
2. **ConversationMessage Model Updates:**
   - `deliveryStatus DeliveryStatus @default(NOT_APPLICABLE)`
   - `deliveredAt DateTime?`
   - `sentAt DateTime?`
   - `failedAt DateTime?`
   - `providerMessageId String?`
   - `deliveryError String?`
   - `idempotencyKey String? @unique`
   - Indexes added: `@@index([providerMessageId])`, `@@index([deliveryStatus])`
3. **OutboxJob Model (`outbox_jobs` table):**
   - `id String @id @default(cuid())`
   - `organizationId String?`
   - `messageId String @unique`
   - `recipientEmail String`
   - `channel MessageChannel @default(EMAIL)`
   - `payload Json`
   - `idempotencyKey String @unique`
   - `status OutboxStatus @default(PENDING)`
   - `attempts Int @default(0)`
   - `maxAttempts Int @default(3)`
   - `nextAttemptAt DateTime @default(now())`
   - `lockedAt DateTime?`
   - `lockedBy String?`
   - `lastError String?`
   - `providerMessageId String?`
   - Foreign key cascade on `messageId` referencing `ConversationMessage.id`
   - Indexes on `[status, nextAttemptAt]`, `[organizationId]`, `[providerMessageId]`

### Operator Migration Command
To apply this migration in staging or production environments, an authorized operator should run:
```bash
npx prisma migrate deploy
```
*(Verified: Executed successfully with exit code 0 against isolated local PostgreSQL test database `copilot_test`.)*

---

## 4. Dispatch Lifecycle & Idempotency Strategy

```
AI Draft Generated (PENDING_APPROVAL)
       │
       ▼
Human Advisor Review (Approve Action)
       │
       ▼ (Atomic Transaction)
Outbox Job Enqueued (QUEUED, idempotencyKey: "dispatch-<messageId>")
       │
       ▼ (Optimistic Atomic Lock)
Dispatch Worker Claimed (SENDING, status: PROCESSING)
       │
       ├── Provider API Accepts ──────────────► SENT (sentAt recorded)
       │                                           │
       │                                           ▼
       │                               Provider Webhook Confirms
       │                                           │
       │                                           ▼
       │                                       DELIVERED (deliveredAt recorded)
       │
       ├── Transient Failure (Rate limit/5xx) ─► RETRY_PENDING (Exponential backoff)
       │
       └── Permanent Failure / Max Attempts ──► FAILED (failedAt recorded)
                                                   │
                                                   ▼
                                            Authorized Manual Retry
```

### Idempotency Controls
- **Client Duplicate Prevention:** Approving an already-approved draft checks `existing.deliveryStatus === 'NOT_APPLICABLE'`. Second approvals return the existing state and suppress duplicate outbox creation.
- **Database Unique Constraint:** `OutboxJob.messageId` and `OutboxJob.idempotencyKey` are decorated with `@unique` constraints. Concurrent creation attempts are thwarted by PostgreSQL unique constraints.
- **Worker Lock Atomicity:** `prisma.outboxJob.updateMany({ where: { id: job.id, status: job.status, updatedAt: job.updatedAt }, data: { status: 'PROCESSING', lockedAt: now, lockedBy: workerId } })`. If another worker updated the row, `count === 0` and the worker immediately skips it.

---

## 5. Retry & Failure-Recovery Behavior

- **Transient vs Permanent Classification:**
  - HTTP 429 (Rate Limit) and HTTP 5xx / Network timeouts are flagged `isTransient: true`.
  - HTTP 400 (Invalid address), 401 (Auth failure), and domain rejections are flagged `isTransient: false`.
- **Bounded Exponential Backoff:**
  - Formula: `Math.min(300, 5 * Math.pow(3, attempts))` seconds (Attempt 1: 5s, Attempt 2: 15s, Attempt 3: 45s, capped at 5 minutes).
- **Terminal Exhaustion:**
  - Upon reaching `maxAttempts: 3`, the job status transitions to `FAILED` and the message transitions to `FAILED` with sanitized error details in `deliveryError`.
- **Stale Lock Recovery:**
  - Locks older than 2 minutes are automatically reclaimed if a worker process crashes mid-dispatch.
- **Manual Retry Action:**
  - Eligible failed messages can be retried by authorized assigned advisors or organization owners via `POST /api/leads/:id/conversations/messages/:msgId/retry`.

---

## 6. Webhook Verification & Delivery-State Guarantees

- **Signature Verification:**
  - Resend webhooks use Svix headers (`svix-id`, `svix-timestamp`, `svix-signature`).
  - Secret `whsec_...` is base64-decoded and used to compute constant-time HMAC-SHA256 (`crypto.timingSafeEqual`).
  - Timestamp skew check enforces a 300-second window to prevent replay attacks.
  - Fails closed: Missing secret or malformed headers return HTTP 401 Unauthorized.
- **Webhook Idempotency:**
  - Every external event is recorded via `recordWebhookEvent` in the `WebhookEvent` table. Duplicate event deliveries return HTTP 200 `{ duplicate: true }` without re-executing updates.
- **Terminal State Guard:**
  - Once a message is marked `DELIVERED`, webhooks never move the status backward to `SENT`, `QUEUED`, or `FAILED`.
- **Distinction Between Send and Delivery:**
  - A successful API submission only marks a message as `SENT` (dispatched).
  - Only provider webhook delivery confirmation events (`email.delivered` / `delivered`) transition the message to `DELIVERED`.

---

## 7. Security & Tenant-Isolation Controls

1. **Strict Tenant Scoping:** Every queue entry, dispatch check, retry endpoint, and webhook correlation validates tenant organization ownership.
2. **Advisor Role Authorization:**
   - Agents (`AGENT` role) can only send messages or trigger manual retries for leads specifically assigned to them (`lead.assignedUserId === caller.id`).
   - Organization `OWNER` and `ADMIN` roles can manage across organization leads.
   - Cross-tenant requests return 404/403.
3. **No Unauthenticated Mutations:** Webhooks require cryptographically valid signatures before any message record is queried or modified.
4. **PII Redaction:** Recipient email addresses in audit logs and system logs are masked (`maskEmail`, e.g. `a***r@example.com`).
5. **Frontend Status Forgery Prevention:** Frontend client PATCH endpoints strictly validate `ApprovalStatus` and do not allow client-supplied `deliveryStatus` values.

---

## 8. Tests Run, Results & Verification Commands

### Focused Phase 3A Test Suite
- **Command:** `npm test -- tests/security/p3aOutboundMessaging.test.ts`
- **Exit Code:** `0`
- **Result:** **15 / 15 Passed**
- **Coverage Areas:**
  - Approval required before AI draft dispatch
  - Client delivery status injection rejection
  - Idempotent double-click approval suppression
  - Lead ownership enforcement (assigned agent vs unassigned agent)
  - Cross-tenant dispatch and retry rejection
  - Missing/invalid recipient email rejection
  - Worker optimistic concurrency locks
  - Bounded exponential backoff on transient errors
  - Immediate termination on permanent errors
  - Webhook Svix signature verification (valid, tampered, expired)
  - Webhook delivery status update to `DELIVERED`
  - Idempotent duplicate webhook handling
  - Protection against backwards transitions from `DELIVERED`
  - Bounce webhook processing and audit logging
  - PII masking in audit trails

### Existing Security Regressions
- `tests/security/p2gRemediation.test.ts`: **36 / 36 Passed (Exit Code 0)**
- `tests/security/p2iPilotReadiness.test.ts`: **10 / 10 Passed (Exit Code 0)**

### Full Backend Test Suite
- **Command:** `npm test -- --runInBand`
- **Exit Code:** `0`
- **Result:** **32 / 32 Suites Passed, 405 / 405 Tests Passed (100% PASS)**
- **Duration:** 15.78s

### Static Analysis & Production Builds
- **Backend TypeScript Check:** `npx tsc --noEmit` — **Exit Code 0 (0 errors)**
- **Frontend Production Build:** `npm run build` (tsc + vite) — **Exit Code 0 (0 errors)**
- **Git Diff Whitespace Check:** `git diff --check` — **Exit Code 0 (0 errors)**

---

## 9. Required Environment Variables (Placeholders Only)

Add to `backend/.env` (and document in `.env.example`):

```bash
# Outbound Messaging Provider (resend | sendgrid)
EMAIL_DRIVER=resend

# Resend API Key & Webhook Secret
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxxxxx
RESEND_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# SendGrid (if using sendgrid driver)
SENDGRID_API_KEY=SG.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
SENDGRID_WEBHOOK_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Sender Identity
EMAIL_FROM=Contingency Copilot <onboarding@resend.dev>
FROM_EMAIL=onboarding@resend.dev
```

*Note: In test and development environments, live API keys are optional. The system safely logs and simulates delivery without contacting real external recipients.*

---

## 10. Remaining Risks, Manual Setup & Provider Limitations

1. **Domain Verification in Production:** Before production sending, the sending domain (`EMAIL_FROM`) must have verified DKIM, SPF, and DMARC records configured in the Resend or SendGrid dashboard.
2. **Webhook Endpoint URL Registration:** In production, the webhook endpoint `https://<your-domain>/api/webhooks/resend` must be added in the Resend Dashboard under Webhooks, selecting `email.sent`, `email.delivered`, `email.bounced`, and `email.complained` events, and copying the signing secret to `RESEND_WEBHOOK_SECRET`.
3. **Outbox Polling Worker Process:** In this phase, outbox processing triggers automatically upon approval/send actions and during manual retries. In a high-volume multi-instance cluster, a scheduled background cron (e.g. every 30 seconds) can be run to sweep any delayed retry jobs whose backoff window has elapsed.

---

## 11. Working-Tree Integrity & Preserved Changes

The workspace working tree was strictly preserved:
- All pre-existing modified files and untracked files remain intact.
- Zero destructive git commands were executed.
- No live messages were sent to real customers.

---

## 12. Release Verdict

**VERDICT: READY FOR CONTROLLED PRODUCTION PILOT**

- Outbound messaging pipeline is durable, idempotent, and secure.
- Human approval is strictly enforced before any AI draft enters the dispatch queue.
- Delivery status is never claimed prematurely and is updated only via signature-verified webhooks.
- All 32 backend test suites (405 tests) and frontend production builds pass with 100% success.
