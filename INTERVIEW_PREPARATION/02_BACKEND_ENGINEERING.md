# 02 — Complete Backend Engineering (`backend/src/`)

Your backend is an **80+ file** TypeScript modular monolith organized into:
- **Entry & App Factory:** `index.ts`, `app.ts`
- **3 Middleware files:** `auth.ts`, `errorHandler.ts`, `upload.ts`
- **25 Route Controllers:** `api/routes/*.ts` & `api/routes/webhooks/*.ts`
- **45+ Domain Services:** Escrow, CRM/Leads, Agentic AI, Omnichannel Messaging, Telephony/Voice, Billing/COGS, Platform/Webhooks
- **6 Utilities & 2 Type modules:** `utils/*.ts`, `types/*.ts`

---

## 1. Boot & Graceful Shutdown (`backend/src/index.ts`)

### Actual Code
```ts
// Refuse to start with an insecure configuration (missing/weak JWT_SECRET, demo login in production).
assertSecurityConfig();

const PORT = parseInt(process.env['PORT'] ?? '3001', 10);
const app = createApp();

if (process.env.NODE_ENV !== 'test') {
  server = app.listen(PORT, () => {
    initAlertCron();
    if (server) {
      attachPlivoStreamGateway(server);
    }
    initTelegramBot().catch((err) => {
      logger.error(`[Telegram] Bot failed to start: ${err.message}`);
    });
  });
}
```
- **Why `NODE_ENV !== 'test'`?** Supertest passes `createApp()` directly without binding a TCP port, preventing `EADDRINUSE` during parallel Jest runs.
- **Graceful Shutdown (`gracefulShutdown`):**
```ts
const emergencyTimer = setTimeout(() => {
  logger.error(`[Shutdown] Graceful shutdown timed out after ${timeoutMs}ms. Forcing process exit.`);
  if (exitOnComplete) process.exit(1);
}, timeoutMs);
emergencyTimer.unref();

stopAlertCron();
stopTelegramBot();
if (server && server.listening) {
  await new Promise<void>((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  });
}
await prisma.$disconnect();
```

---

## 2. Express Pipeline & `rawBody` Capture (`backend/src/app.ts`)

### Actual Code
```ts
app.disable('x-powered-by');
app.use(helmet());

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (allowedOrigins.has(origin) || allowedOrigins.has('*')) return callback(null, true);
      if (origin.endsWith('.vercel.app') || origin.endsWith('.onrender.com')) return callback(null, true);
      callback(null, false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Api-Key'],
  }),
);

// Keep the exact request bytes so webhook signatures are verified over what was signed.
app.use(
  express.json({
    limit: '1mb',
    verify: (req, _res, buf) => {
      (req as express.Request).rawBody = Buffer.from(buf);
    },
  }),
);
```
- **Why `req.rawBody`?** Meta WhatsApp, Resend (Svix), Stripe, and Razorpay compute HMAC signatures over the exact raw HTTP body bytes. `verify` captures `Buffer.from(buf)` before `JSON.parse` mutates formatting.

---

## 3. Centralized Error Handling (`backend/src/middleware/errorHandler.ts`)

### Actual Code
```ts
export function errorHandler(err: AppError, _req: Request, res: Response, _next: NextFunction): void {
  const statusCode = err.statusCode ?? 500;
  const isDev = process.env['NODE_ENV'] === 'development';
  const isClientSafe = err.isOperational || ((err as { expose?: boolean }).expose === true && statusCode < 500);
  const message = isClientSafe || isDev ? err.message : 'Internal server error';

  logger.error(`[${statusCode}] ${err.message}`, { stack: err.stack });
  res.status(statusCode).json({ error: { message, ...(isDev && { stack: err.stack }) } });
}

export function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next);
  };
}

export function createError(message: string, statusCode = 400): AppError {
  const err: AppError = new Error(message);
  err.statusCode = statusCode;
  err.isOperational = true;
  return err;
}
```
- **Why this pattern?** Express 4 doesn't catch rejected `async` promises automatically (`asyncHandler` fixes that), and `isOperational` prevents Prisma/provider errors from leaking secrets in production.

---

## 4. Fail-Closed Tenant Scope (`backend/src/utils/tenant.ts`) & Rate Limiter (`rateLimit.ts`)

### Actual Code (`tenant.ts`)
```ts
export function requireOrgId(organizationId: string | null | undefined): string {
  if (typeof organizationId !== 'string' || organizationId.trim().length === 0) {
    const err = createError('Organization scope is required', 500);
    err.isOperational = false;
    throw err;
  }
  return organizationId;
}
```
- **Why `isOperational = false`?** A missing `organizationId` inside a service is a server bug—failing closed with `500` stops cross-tenant data leaks.

### Actual Code (`rateLimit.ts`)
```ts
const hits = new Map<string, { count: number; resetAt: number }>();
// ...
entry.count++;
if (entry.count > options.max) {
  res.setHeader('Retry-After', String(Math.ceil((entry.resetAt - now) / 1000)));
  res.status(429).json({ error: { message: 'Too many requests. Please try again later.' } });
  return;
}
```
- **Limitation:** Per-process `Map` only; needs Redis for multi-instance deployments.

---

## 5. Deterministic Date Engine (`backend/src/services/dateEngine.service.ts`)

### Actual Code
```ts
function computeDeadline(startDate: Date, numberOfDays: number, dayType: DayType, country = 'US', state = 'CA'): Date {
  if (dayType === 'calendar') {
    return addDays(startDate, numberOfDays);
  }

  const hd = new Holidays(country, state);
  const holidayDates = new Set<string>([
    ...hd.getHolidays(startDate.getFullYear()).map((h) => format(new Date(h.date), 'yyyy-MM-dd')),
    ...hd.getHolidays(startDate.getFullYear() + 1).map((h) => format(new Date(h.date), 'yyyy-MM-dd')),
  ]);

  let current = startDate;
  let daysAdded = 0;
  while (daysAdded < numberOfDays) {
    current = addDays(current, 1);
    const dateStr = format(current, 'yyyy-MM-dd');
    if (!isWeekend(current) && !holidayDates.has(dateStr)) {
      daysAdded++;
    }
  }
  return current;
}
```
- **Why preload `startDate.getFullYear() + 1`?** A contract signed in late December crosses New Year's Day into January.

---

## 6. Transactional Outbox (`backend/src/services/messaging/outboxDispatcher.ts`)

### Actual Code
```ts
const existingJob = await prisma.outboxJob.findUnique({ where: { messageId } });
if (existingJob) {
  return { queued: true, jobId: existingJob.id, duplicate: true };
}

const result = await prisma.$transaction(async (tx) => {
  await tx.conversationMessage.update({
    where: { id: messageId },
    data: { deliveryStatus: 'QUEUED', idempotencyKey },
  });
  const job = await tx.outboxJob.create({
    data: { organizationId, messageId, recipientEmail: safeRecipient, /* ... */ },
  });
  return job;
});
```

---

## 7. Deals CRUD & Plan Tier Quota Enforcement (`backend/src/api/routes/deals.ts`)

### Actual Code
```ts
const orgId = req.user!.organizationId;
const org = await prisma.organization.findUnique({
  where: { id: orgId },
  select: { subscriptionTier: true, isSuspended: true },
});
if (org?.isSuspended) {
  throw createError('Workspace is suspended', 403);
}
const tier = (org?.subscriptionTier as PlanTier) || 'SOLO';
const planConfig = PLAN_CONFIGS[tier] || PLAN_CONFIGS.SOLO;
if (planConfig.maxDeals !== null) {
  const currentDeals = await prisma.deal.count({ where: { organizationId: orgId } });
  if (currentDeals >= planConfig.maxDeals) {
    throw createError(
      `Deal limit reached (${currentDeals}/${planConfig.maxDeals} on ${planConfig.name}). Upgrade to Brokerage Team for unlimited deals.`,
      402,
    );
  }
}
```
- **What to notice:** Tenant ID always comes from `req.user!.organizationId` (never `req.body`), and exceeding plan limits returns HTTP `402 Payment Required`.

---

## 8. Webhook Signature & Replay Protection (`backend/src/services/webhook.service.ts`)

### Actual Code
```ts
export function verifyWebhookSignature({ provider, signatureHeader, rawBody, secret }: WebhookVerificationParams): boolean {
  const webhookSecret = secret || getWebhookSecret(provider);
  if (!webhookSecret) return false;
  if (!signatureHeader || rawBody === undefined || rawBody === null) return false;

  const provided = signatureHeader.trim().replace(/^sha256=/, '');
  if (!/^[0-9a-f]{64}$/i.test(provided)) return false;

  const computed = crypto.createHmac('sha256', webhookSecret).update(rawBody).digest();
  return crypto.timingSafeEqual(Buffer.from(provided, 'hex'), computed);
}
```
- **Svix Replay Protection (`verifySvixSignature`):** Also checks `Math.abs(now - timestampNum) > toleranceSeconds` (`300s` default) so old captured webhooks cannot be replayed.

---

## 9. Razorpay Payment & Webhook Verification (`backend/src/services/razorpay.service.ts`)

### Actual Code
```ts
export function verifyRazorpayPaymentSignature(params: { orderId: string; paymentId: string; signature: string }): boolean {
  const { keySecret } = getRazorpayCredentials();
  if (!keySecret) {
    return (
      params.orderId.startsWith('order_sim_') &&
      params.signature === 'sim_sig' &&
      process.env['NODE_ENV'] !== 'production'
    );
  }
  const expected = crypto
    .createHmac('sha256', keySecret)
    .update(`${params.orderId}|${params.paymentId}`)
    .digest('hex');

  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(params.signature));
  } catch {
    return false;
  }
}
```
- **Note:** Simulated payment bypass is strictly blocked when `NODE_ENV === 'production'`.

---

## 10. Plivo Bidirectional Voice WebSocket Gateway (`backend/src/services/telephony/plivoStreamGateway.ts`)

### Actual Code
```ts
export function attachPlivoStreamGateway(httpServer: HttpServer): WebSocketServer {
  if (wssInstance) return wssInstance;
  const wss = new WebSocketServer({ noServer: true });
  wssInstance = wss;

  httpServer.on('upgrade', (request: IncomingMessage, socket, head) => {
    const urlPath = (request.url || '').split('?')[0] || '';
    if (!urlPath.startsWith('/ws/plivo/')) return;
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  });

  wss.on('connection', async (ws: WebSocket, request: IncomingMessage) => {
    const sessionId = (request.url || '').split('?')[0]!.replace('/ws/plivo/', '').trim();
    const callSession = await prisma.voiceCallSession.findUnique({ where: { id: sessionId } });
    if (!callSession) {
      ws.close(1008, 'Unknown call session');
      return;
    }
    // ... streams audio and bridges to lead's conversation thread
  });
  return wss;
}
```

---

## 11. Complete Route Controllers (`backend/src/api/routes/`) & Services Inventory

### 25 Route Controllers
- **Auth, Org, Billing & Admin:** `auth.ts`, `organization.ts`, `billing.ts` (Stripe + Razorpay), `admin.ts`.
- **Escrow & Contingency (`requireAuth`):** `deals.ts`, `documents.ts`, `deadlines.ts`, `tasks.ts`, `audit.ts`, `assistant.ts`, `notifications.ts`.
- **CRM, AI Sales OS & Omnichannel:** `leads.ts`, `conversations.ts`, `properties.ts` (+ `leadMatchesRouter`), `knowledge.ts`, `siteVisits.ts`, `leadTasks.ts`, `campaigns.ts`, `voice.ts`.
- **Public & Webhooks:** `inbound.ts`, `publicWidget.ts`, `webhooks/whatsapp.ts`, `webhooks/telegram.ts`, `webhooks/plivo.ts`, `messagingWebhooks.ts` (Resend Svix + SendGrid).

### 45+ Services by Domain
- **Auth & Platform:** `auth.service.ts`, `organization.service.ts`, `platformConfig.service.ts`, `webhook.service.ts`.
- **Escrow, PDF & RAG:** `pdf.service.ts`, `docClassifier.service.ts`, `ai.service.ts`, `dateEngine.service.ts`, `deadline.service.ts`, `transactionTask.service.ts`, `chunk.service.ts`, `embedding.service.ts`, `retrieval.service.ts`, `assistant.service.ts`, `citationVerifier.ts`, `storage.service.ts`, `alert.service.ts`, `scheduler.service.ts`, `email.service.ts`, `emailTemplates.ts`.
- **CRM & Lead Lifecycle:** `lead.service.ts`, `leadConversion.service.ts`, `propertyMatch.service.ts`, `siteVisit.service.ts`, `leadTask.service.ts`, `campaignWorker.service.ts`.
- **Agentic AI (`services/agent/`):** `orchestrator.ts`, `agentRuntime.ts`, `agentTools.ts`, `buyerMemory.service.ts`.
- **Omnichannel, Outbox & Voice:** `channelRegistry.service.ts`, `conversation.service.ts`, `messaging/outboxDispatcher.ts`, `messaging/messagingProvider.ts`, `messaging/whatsapp.service.ts`, `messaging/whatsappOnboarding.service.ts`, `messaging/humanChatPhysics.ts`, `telegram.service.ts`, `telephony/plivo.service.ts`, `telephony/plivoProvisioning.service.ts`, `telephony/plivoStreamGateway.ts`, `voice/voiceNote.service.ts`, `voice/transcription.service.ts`.
- **Billing & COGS:** `billing.service.ts`, `razorpay.service.ts`, `billing/wallet.service.ts`, `costTracker.service.ts`.
