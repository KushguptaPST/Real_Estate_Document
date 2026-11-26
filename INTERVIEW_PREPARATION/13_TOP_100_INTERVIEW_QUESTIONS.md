# 13 — Top 100 Code-Grounded Technical Interview Questions

> Distribution: Architecture (10) · Programming Fundamentals (10) · Backend & APIs (10) · Auth & AuthZ (10) · Database (10) · LLM & GenAI (10) · RAG (10) · Agentic AI & LangGraph (15) · Frontend (10) · Production & System Design (5).

---

## 1. Project Architecture (Q1–Q10)

**Q1. What problem does Eigen Estate solve, and how are its two pillars connected?**
- **Answer:** It solves inbound lead leakage (24/7 autonomous omnichannel AI sales agent) and escrow contingency forfeiture (AI contract extraction + deterministic deadline tracking + hourly alerts).
- **Project Application:** A qualified buyer `Lead` (Pillar B) converts via `leadConversion.service.ts` into a `Deal` (Pillar A) linked by `Lead.deal`.
- **Source:** `backend/prisma/schema.prisma`, `backend/src/services/leadConversion.service.ts`
- **Follow-up:** Why not build two separate microservices? **Ans:** Shared `Organization` boundary, shared `User` RBAC, and atomic `prisma.$transaction()` across leads, deals, and wallets without distributed transaction overhead.

**Q2. Walk through the exact startup sequence of the backend.**
- **Answer:** Loads env → `assertSecurityConfig()` fail-fast check → `createApp()` → `app.listen(PORT)` → `initAlertCron()` → `attachPlivoStreamGateway(server)` → `initTelegramBot()` → `SIGTERM`/`SIGINT` handlers.
- **Project Application:** Guarantees insecure configs crash before opening a port and tests (`NODE_ENV=test`) don't bind ports.
- **Source:** `backend/src/index.ts`
- **Follow-up:** What happens if `initTelegramBot()` fails? **Ans:** Caught via `.catch()` so HTTP API and escrow alerts keep running.

**Q3. Why is Eigen Estate structured as a Modular Monolith?**
- **Answer:** Co-locates REST routes, AI orchestrator, cron, and WebSockets in one Node process with clear domain folders (`services/agent`, `services/messaging`, `services/telephony`).
- **Project Application:** Fast iteration and ACID transactions via single `PrismaClient`.
- **Source:** `backend/src/app.ts`
- **Follow-up:** What's the first module you'd extract to a separate service? **Ans:** `plivoStreamGateway.ts` (stateful WebSocket audio) and `alert.service.ts`/`outboxDispatcher.ts` (background workers).

**Q4. How are external services integrated without blocking core DB transactions?**
- **Answer:** External API calls (Plivo subaccount provisioning, outbox HTTP dispatch) run asynchronously outside `prisma.$transaction()`.
- **Project Application:** `registerOrganization()` commits the org/user/wallet first, then calls `provisionSubaccountForOrg().catch(() => {})`.
- **Source:** `backend/src/services/auth.service.ts`
- **Follow-up:** What if Plivo provisioning fails? **Ans:** Workspace creation still succeeds; provisioning can be retried later.

**Q5. How does the backend handle graceful shutdown?**
- **Answer:** `gracefulShutdown()` uses an `isShuttingDown` guard, stops cron & Telegram, calls `server.close()`, disconnects Prisma, and sets a 10s `.unref()` emergency timer.
- **Project Application:** Prevents dropped in-flight requests or leaked Postgres connections during Render redeploys.
- **Source:** `backend/src/index.ts`
- **Follow-up:** Why `.unref()` on the emergency timer? **Ans:** So Node doesn't wait 10s to exit if cleanup finishes in 200ms.

**Q6. Why is `req.rawBody` captured in `express.json()`?**
- **Answer:** Stores the exact unparsed byte buffer before `JSON.parse`.
- **Project Application:** Required for HMAC signature verification on Meta WhatsApp, Resend/Svix, Stripe, and Razorpay webhooks.
- **Source:** `backend/src/app.ts`
- **Follow-up:** What happens if you verify HMAC over `JSON.stringify(req.body)` instead? **Ans:** Whitespace/key-order differences cause valid webhooks to fail signature checks.

**Q7. How is CORS configured?**
- **Answer:** Explicit `allowedOrigins` Set from `CORS_ORIGIN`, localhost dev origins (non-prod only), plus `.vercel.app` and `.onrender.com`, with `credentials: true`.
- **Project Application:** Blocks arbitrary origins in production while allowing Vercel→Render calls.
- **Source:** `backend/src/app.ts`
- **Follow-up:** Why allow requests with no `Origin` header? **Ans:** Server-to-server webhooks and `curl` don't send `Origin`.

**Q8. Which technologies in `package.json` or `docker-compose.yml` are unused or partially used?**
- **Answer:** `@anthropic-ai/sdk` is in `package.json` but unused in `src/`; LangChain/LangGraph/Redis are not used; `pgvector` is in Docker but similarity runs in Node memory.
- **Project Application:** Knowing exact boundaries prevents overclaiming in interviews.
- **Source:** `backend/package.json`, `backend/src/services/retrieval.service.ts`
- **Follow-up:** Why is `@anthropic-ai/sdk` still in `package.json`? **Ans:** Planned multi-provider option; Gemini (`@google/genai`) is the active provider.

**Q9. How does `vercel.json` support React Router SPA navigation?**
- **Answer:** Rewrites `/(.*)` to `/index.html`.
- **Project Application:** Refreshing `/deals/123` on Vercel serves `index.html` instead of a 404.
- **Source:** `vercel.json`
- **Follow-up:** What happens to API calls? **Ans:** Frontend uses `VITE_API_URL` pointing directly to the Express backend.

**Q10. What discrepancy exists between `README.md` and `render.yaml`?**
- **Answer:** `README.md` warns to never use `prisma db push` in production, while `render.yaml` `startCommand` uses `npx prisma db push --accept-data-loss`.
- **Project Application:** Should be switched to `npx prisma migrate deploy` for safe production migrations.
- **Source:** `README.md`, `render.yaml`
- **Follow-up:** Why is `db push --accept-data-loss` risky? **Ans:** It can silently drop columns/data on schema changes without a migration history.

---

## 2. Programming Fundamentals (Q11–Q20)

**Q11. How does Node.js handle concurrency if it's single-threaded?**
- **Answer:** Event loop + non-blocking libuv I/O delegates network/DB/file I/O asynchronously.
- **Project Application:** Express serves concurrent HTTP requests while awaiting Prisma/Gemini promises.
- **Source:** `backend/src/index.ts`
- **Follow-up:** What in this codebase blocks the event loop? **Ans:** Synchronous `crypto.scryptSync` and large in-memory `cosineSimilarity` loops.

**Q12. Why does the backend use `"type": "module"` (ESM) with `.js` extensions in `.ts` imports?**
- **Answer:** TypeScript ESM resolution requires `.js` specifiers matching the compiled output in `dist/`.
- **Project Application:** Every relative import in `backend/src/` uses `.js`.
- **Source:** `backend/package.json`, `backend/tsconfig.json`
- **Follow-up:** How does Jest run ESM tests? **Ans:** Via `node --experimental-vm-modules` in `backend/package.json`.

**Q13. Explain `crypto.timingSafeEqual` and where it's used.**
- **Answer:** Compares two buffers in constant time regardless of where the first mismatch occurs.
- **Project Application:** Used in `verifyPassword()` to prevent timing side-channel attacks.
- **Source:** `backend/src/services/auth.service.ts`
- **Follow-up:** Why can't you pass strings directly to `timingSafeEqual`? **Ans:** It requires equal-length `Buffer`/`TypedArray` inputs.

**Q14. Why use `globalThis` for the PrismaClient singleton?**
- **Answer:** Prevents `tsx watch` hot-reloads from creating a new `PrismaClient` connection pool on every save.
- **Project Application:** Reuses `globalForPrisma.prisma`.
- **Source:** `backend/src/utils/prisma.ts`
- **Follow-up:** What happens without it in dev? **Ans:** Exhausts PostgreSQL `max_connections`.

**Q15. Explain `asyncHandler` in Express 4.**
- **Answer:** Express 4 doesn't automatically catch rejected promises in `async` route handlers; `asyncHandler` appends `.catch(next)` so errors reach `errorHandler`.
- **Project Application:** Wraps async controllers across routes.
- **Source:** `backend/src/middleware/errorHandler.ts`
- **Follow-up:** How does Express 5 differ? **Ans:** Express 5 natively forwards rejected async handlers.

**Q16. How does `dateEngine.service.ts` avoid timezone/DST bugs in business-day counting?**
- **Answer:** Uses `date-fns` (`addDays`, `isWeekend`, `format(..., 'yyyy-MM-dd')`) and a `Set<string>` of holiday dates from `date-holidays`.
- **Project Application:** Preloads `startDate.getFullYear()` and `startYear + 1` so December→January contracts don't miss New Year's Day.
- **Source:** `backend/src/services/dateEngine.service.ts`
- **Follow-up:** Why preload `startYear + 1`? **Ans:** A 15-business-day contingency signed Dec 20 crosses into January.

**Q17. Explain Zod `.catch()` vs `.default()` in AI response parsing.**
- **Answer:** `.default()` only applies when `undefined`; `.catch()` recovers when the LLM returns a wrong type or invalid enum.
- **Project Application:** `ExtractedClauseSchema` and `AssistantResponseSchema` use `.catch()` so minor LLM schema drift doesn't crash the pipeline.
- **Source:** `backend/src/services/ai.service.ts`, `backend/src/services/assistant.service.ts`
- **Follow-up:** When should you NOT use `.catch()`? **Ans:** On security/validation inputs (like `ProposeBuyerRequirementsArgsSchema` or auth) where invalid input must fail loudly.

**Q18. How does `normalizeTextForMatching()` handle PDF extraction quirks?**
- **Answer:** Applies `NFKC` normalization, converts smart quotes/dashes to ASCII, replaces `\u00A0`, un-hyphenates line breaks (`(\w+)-\s*\n\s*(\w+)`), and collapses whitespace.
- **Project Application:** Ensures verbatim quotes from Gemini match PDF text layers accurately.
- **Source:** `backend/src/services/citationVerifier.ts`, `frontend/src/utils/quoteMatcher.ts`
- **Follow-up:** Why is this duplicated on backend and frontend? **Ans:** Backend verifies citations before saving; frontend highlights matched text in `PdfViewer`.

**Q19. What is the difference between operational and programmer errors in `errorHandler.ts`?**
- **Answer:** Operational errors (`isOperational: true` via `createError()`) are expected client/business errors whose messages are safe to return; non-operational errors return `'Internal server error'` in prod.
- **Project Application:** Prevents leaking Prisma SQL or API keys to clients.
- **Source:** `backend/src/middleware/errorHandler.ts`
- **Follow-up:** What does `err.expose` handle? **Ans:** `body-parser` 400/413 errors (e.g., payload > 1MB).

**Q20. How does `rateLimit.ts` prevent unbounded memory growth?**
- **Answer:** Periodically sweeps the `hits` `Map` when `now - lastSweep > options.windowMs`, deleting expired entries.
- **Project Application:** Keeps in-memory rate limiting bounded per process.
- **Source:** `backend/src/utils/rateLimit.ts`
- **Follow-up:** What happens under a distributed attack across 4 instances? **Ans:** Each instance has its own `Map`, allowing 4x the limit—needs Redis.

---

## 3. Backend & APIs (Q21–Q30)

**Q21. How does `upload.ts` validate uploaded files?**
- **Answer:** `multer` checks `file.mimetype === 'application/pdf'` (returning `422` otherwise) and `fileSize <= 50MB`, writing to `UPLOAD_DIR`.
- **Project Application:** Prevents oversized or non-PDF uploads from hitting `pdf-parse`.
- **Source:** `backend/src/middleware/upload.ts`
- **Follow-up:** Is MIME type alone enough? **Ans:** MIME headers can be spoofed; magic-byte (`%PDF-`) verification is stronger.

**Q22. How does `storage.service.ts` switch between dev and prod storage?**
- **Answer:** `STORAGE_DRIVER=local` stores in `backend/uploads/`; `STORAGE_DRIVER=imagekit` uploads with `isPrivateFile: true`.
- **Project Application:** Contracts contain PII, so ImageKit files are private and require signed URLs.
- **Source:** `backend/src/services/storage.service.ts`
- **Follow-up:** Why not make uploaded PDFs public? **Ans:** Purchase agreements contain SSNs/financials/addresses.

**Q23. How does `alert.service.ts` prevent sending duplicate reminder emails?**
- **Answer:** Queries `prisma.emailLog.findFirst({ where: { deadlineId, template } })` before sending and skips if already logged.
- **Project Application:** Hourly cron can run 24 times a day without spamming agents.
- **Source:** `backend/src/services/alert.service.ts`
- **Follow-up:** How could a race condition still happen? **Ans:** Two concurrent cron workers could both pass `findFirst` before either writes `emailLog`; a DB unique constraint on `(deadlineId, template)` would make it strictly atomic.

**Q24. How does `alert.service.ts` protect email PII in logs?**
- **Answer:** Calls `maskEmail(recipient)` before `logger.info`.
- **Project Application:** Prevents raw customer emails from appearing in log aggregators.
- **Source:** `backend/src/services/alert.service.ts`, `backend/src/utils/audit.ts`
- **Follow-up:** Where else should PII masking apply? **Ans:** Phone numbers and JWTs in error logs.

**Q25. Explain the Transactional Outbox in `outboxDispatcher.ts`.**
- **Answer:** Atomically updates `ConversationMessage.deliveryStatus = 'QUEUED'` and creates `OutboxJob` inside `prisma.$transaction()`, then dispatches asynchronously with retries.
- **Project Application:** Prevents split-brain between DB state and WhatsApp/Email delivery.
- **Source:** `backend/src/services/messaging/outboxDispatcher.ts`
- **Follow-up:** How is idempotency enforced? **Ans:** Unique `OutboxJob.messageId` and `idempotencyKey = "dispatch-" + messageId`.

**Q26. What happens in `queueMessageDispatch` if a lead lacks a valid email or phone?**
- **Answer:** Marks `ConversationMessage.deliveryStatus = 'FAILED'`, records `deliveryError`, logs `MESSAGE_DISPATCH_FAILED` in `AuditLog`, and returns `{ queued: false }`.
- **Project Application:** Fails gracefully without throwing unhandled exceptions into the agent loop.
- **Source:** `backend/src/services/messaging/outboxDispatcher.ts`
- **Follow-up:** Why log to `AuditLog`? **Ans:** Advisors can see why an automated follow-up wasn't delivered.

**Q27. How does `app.ts` separate public webhooks from authenticated APIs?**
- **Answer:** Webhook routers (`/api/webhooks/*`, `/api/inbound`) verify provider signatures/secrets directly, while workspace routes (`/api/deals`, `/api/campaigns`, `/api/tasks`, `/api/site-visits`) mount `requireAuth`.
- **Project Application:** Meta/Plivo/Stripe don't have user JWTs.
- **Source:** `backend/src/app.ts`
- **Follow-up:** What if a route router forgets `requireAuth`? **Ans:** Mounting `requireAuth` at `app.use('/api/deals', requireAuth, dealsRouter)` enforces it for all sub-routes.

**Q28. How are Stripe and Razorpay both integrated?**
- **Answer:** `billing.service.ts` handles Stripe Checkout/Portal/Webhooks (`stripe.webhooks.constructEvent` with `rawBody`); `razorpay.service.ts` + `billing.ts` handle INR orders, HMAC-SHA256 verification, and wallet top-ups.
- **Project Application:** Supports global SaaS subscriptions (Stripe) and Indian brokerage INR wallet top-ups (Razorpay).
- **Source:** `backend/src/api/routes/billing.ts`, `backend/src/services/billing.service.ts`, `backend/src/services/razorpay.service.ts`
- **Follow-up:** How is duplicate wallet crediting prevented? **Ans:** `wallet.service.ts` checks `razorpayPaymentId` in existing entries.

**Q29. What is `helmet()` doing in `app.ts`?**
- **Answer:** Sets security HTTP headers (`X-Content-Type-Options`, `X-Frame-Options`, `Strict-Transport-Security`, etc.).
- **Project Application:** Hardens Express against clickjacking and MIME sniffing.
- **Source:** `backend/src/app.ts`
- **Follow-up:** Why also call `app.disable('x-powered-by')`? **Ans:** Removes Express version/framework fingerprinting.

**Q30. How does `POST /api/deals/:id/assistant` validate input?**
- **Answer:** Uses Zod schemas in the route handler and `requireOrgId(req.user.organizationId)` in `assistant.service.ts`.
- **Project Application:** Rejects empty/malformed questions with `400` before calling Gemini.
- **Source:** `backend/src/api/routes/assistant.ts`, `backend/src/services/assistant.service.ts`
- **Follow-up:** What status code is returned if `dealId` belongs to another org? **Ans:** `404` (doesn't leak existence).

---

## 4. Authentication & Authorization (Q31–Q40)

**Q31. Trace Registration → Login → Protected Request → Controller.**
- **Answer:** `registerOrganization()` hashes password with `scryptSync` → creates `Organization` + `User` + `Channel` + `Wallet` in `$transaction` → `signSessionToken()` issues `HS256` JWT → frontend stores in `localStorage` → sends `Authorization: Bearer` → `requireAuth` runs `verifySessionToken()` → sets `req.user` → controller executes.
- **Source:** `backend/src/services/auth.service.ts`, `backend/src/middleware/auth.ts`, `frontend/src/context/AuthContext.tsx`
- **Follow-up:** What is in the JWT payload? **Ans:** `{ sub, org, role, sv }` (`sessionVersion`).

**Q32. Why use `scryptSync` instead of `SHA-256` for passwords?**
- **Answer:** `SHA-256` is fast and GPU-crackable; `scrypt` is memory-hard and salted per user (`${salt}:${hash}`).
- **Source:** `backend/src/services/auth.service.ts`
- **Follow-up:** Why is `salt` stored alongside the hash? **Ans:** Each user needs a unique salt to defeat rainbow tables, and `verifyPassword` needs that same salt to re-derive the key.

**Q33. How does `sessionVersion` (`sv`) enable instant JWT revocation?**
- **Answer:** `verifySessionToken()` checks `user.sessionVersion === claims.sv` in PostgreSQL on every request. Bumping `sessionVersion` on role change/removal invalidates all active tokens immediately.
- **Source:** `backend/src/services/auth.service.ts`
- **Follow-up:** What's the performance cost? **Ans:** One indexed primary-key query per request; solvable at scale with a short-TTL Redis cache.

**Q34. Why validate `payload.email_verified` in `signInWithGoogle`?**
- **Answer:** Prevents an attacker with an unverified Google email from claiming an invited brokerage email.
- **Source:** `backend/src/services/auth.service.ts`
- **Follow-up:** What else is verified? **Ans:** `audience: GOOGLE_CLIENT_ID` and `payload.sub`.

**Q35. How does `acceptInvitation()` prevent two concurrent requests from using one invite link?**
- **Answer:** Inside `prisma.$transaction()`, `updateMany` filters `acceptedAt: null, revokedAt: null, expiresAt: { gt: now }` and asserts `claimed.count === 1`.
- **Source:** `backend/src/services/auth.service.ts`
- **Follow-up:** Why store `SHA-256(token)` instead of plaintext? **Ans:** A DB read leak won't expose usable invite links.

**Q36. What happens if `JWT_SECRET` is weak or `ENABLE_DEMO_LOGIN=true` in prod?**
- **Answer:** `assertSecurityConfig()` throws at startup and crashes the process before listening.
- **Source:** `backend/src/index.ts`, `backend/src/services/auth.service.ts`
- **Follow-up:** What is `MIN_JWT_SECRET_LENGTH`? **Ans:** `32` characters, plus `KNOWN_WEAK_SECRETS` blocklist.

**Q37. How is RBAC implemented?**
- **Answer:** `UserRole` (`OWNER`, `AGENT`) checked by `requireRole(...roles)`, plus `requirePlatformAdmin` checking `PLATFORM_ADMIN_EMAILS`.
- **Source:** `backend/src/middleware/auth.ts`
- **Follow-up:** What if `requireRole` runs without `requireAuth`? **Ans:** It checks `if (!req.user)` and returns `401`.

**Q38. How does `requireOrgId()` prevent accidental cross-tenant queries?**
- **Answer:** Throws a non-operational `500` if `organizationId` is null/empty, failing closed instead of omitting the `where` filter.
- **Source:** `backend/src/utils/tenant.ts`
- **Follow-up:** Why non-operational `500`? **Ans:** Missing org scope in a service is a server bug, not a client message to expose.

**Q39. What happens when a user's organization is suspended?**
- **Answer:** `toSessionUser()` checks `user.organization?.isSuspended && !platformAdmin` and throws `403`.
- **Source:** `backend/src/services/auth.service.ts`
- **Follow-up:** Why `!platformAdmin`? **Ans:** Platform admins still need access to inspect/unsuspend.

**Q40. What are the security trade-offs of storing JWT in `localStorage` vs `HttpOnly` cookies?**
- **Answer:** `localStorage` simplifies cross-origin SPA→API auth and avoids CSRF, but is readable by JS if XSS occurs.
- **Source:** `frontend/src/services/session.ts`
- **Follow-up:** How does `session.ts` handle `401`? **Ans:** `notifyUnauthorized()` clears `localStorage`, wipes `swrCache`, and fires `copilot:unauthorized`.

---

## 5. Database (Q41–Q50)

**Q41. How is multi-tenancy modeled in `schema.prisma`?**
- **Answer:** Shared database, shared schema with `organizationId` foreign key on tenant-owned tables (`Deal`, `Lead`, `Property`, `User`, `DocumentChunk`, etc.).
- **Source:** `backend/prisma/schema.prisma`
- **Follow-up:** Trade-off vs schema-per-tenant? **Ans:** Simpler migrations and connection pooling, but relies on strict application-level `organizationId` filtering.

**Q42. How do composite unique constraints protect `Lead` integrity?**
- **Answer:** `@@unique([organizationId, email])` and `@@unique([organizationId, phone])` prevent duplicate leads per org while allowing different brokerages to share a buyer email.
- **Source:** `backend/prisma/schema.prisma`
- **Follow-up:** What indexes exist on `Lead`? **Ans:** `@@index([organizationId, status])`, `@@index([organizationId, stage])`, `@@index([email, phone])`.

**Q43. Give 3 places where `prisma.$transaction()` is critical.**
- **Answer:** `registerOrganization()`, `acceptInvitation()`, and `queueMessageDispatch()`.
- **Source:** `auth.service.ts`, `outboxDispatcher.ts`
- **Follow-up:** What happens if an error is thrown inside `prisma.$transaction()`? **Ans:** PostgreSQL rolls back all writes in the transaction.

**Q44. How does `OutboxJob` enforce at-most-once queuing per message?**
- **Answer:** `OutboxJob.messageId` has a `@unique` constraint and `idempotencyKey` is `"dispatch-" + messageId`.
- **Source:** `backend/prisma/schema.prisma`, `backend/src/services/messaging/outboxDispatcher.ts`
- **Follow-up:** Does Outbox guarantee exactly-once external delivery? **Ans:** At-least-once delivery; downstream providers must handle idempotency if retries occur after network timeout.

**Q45. How are `DocumentChunk` embeddings stored and queried?**
- **Answer:** Stored in PostgreSQL (`DocumentChunk.embedding`); retrieved by `{ dealId, organizationId }` and scored in Node.js via `cosineSimilarity()`.
- **Source:** `backend/src/services/retrieval.service.ts`, `backend/src/services/embedding.service.ts`
- **Follow-up:** Why isn't SQL `pgvector` `<=>` used yet? **Ans:** Deal-scoped chunk counts are small enough for in-memory scoring, though cross-deal search would need `pgvector` HNSW indexes.

**Q46. What is the relationship between `Clause` and `Deadline`?**
- **Answer:** Extracted `Clause` records link to computed `Deadline` records, storing both `computedDate` (from `dateEngine`) and `confirmedDate` (human-verified).
- **Source:** `backend/prisma/schema.prisma`, `backend/src/services/alert.service.ts`
- **Follow-up:** Which date does `alert.service.ts` use? **Ans:** `deadline.confirmedDate ?? deadline.computedDate`.

**Q47. Why does `Invitation` store `tokenHash` instead of `token`?**
- **Answer:** Stores `SHA-256(token)` so database backups/logs never leak active invite URLs.
- **Source:** `backend/prisma/schema.prisma`, `backend/src/services/auth.service.ts`
- **Follow-up:** Can a lost invite token be recovered? **Ans:** No—must revoke and issue a new one.

**Q48. How does `Lead` connect to `ConversationThread` and `AgentRunTrace`?**
- **Answer:** `Lead` has 1:N `ConversationThread` (per channel) and 1:N `AgentRunTrace` (per AI turn).
- **Source:** `backend/prisma/schema.prisma`
- **Follow-up:** Why store `AgentRunTrace` in Postgres? **Ans:** Provides durable per-tenant auditability of specialist routing, tool calls, and guardrail flags.

**Q49. How are tests prevented from wiping the dev database?**
- **Answer:** Test setup enforces `TEST_DATABASE_URL` / `DATABASE_URL` ending in `_test`.
- **Source:** `README.md`, `backend/tests/setup/`
- **Follow-up:** How is concurrency tested? **Ans:** `backend/tests/concurrency.test.ts` fires parallel requests against Postgres.

**Q50. How is `OrganizationWallet` protected from negative/duplicate top-ups?**
- **Answer:** `wallet.service.ts` checks `razorpayPaymentId` idempotency and updates balance atomically.
- **Source:** `backend/src/services/billing/wallet.service.ts`
- **Follow-up:** What tracks per-API-call AI cost? **Ans:** `ProviderCostEvent` via `costTracker.service.ts`.

---

## 6. LLM & Generative AI (Q51–Q60)

**Q51. Which LLM SDK is actually used in production code?**
- **Answer:** `@google/genai` (Google Gemini). `@anthropic-ai/sdk` is in `package.json` but unused.
- **Source:** `backend/src/services/ai.service.ts`, `backend/src/services/assistant.service.ts`
- **Follow-up:** Which embedding model is used? **Ans:** `gemini-embedding-001` (env `GEMINI_EMBEDDING_MODEL`).

**Q52. Why set `temperature: 0` in `extractClausesFromPdf()`?**
- **Answer:** Legal clause extraction requires deterministic, reproducible output rather than creative variation.
- **Source:** `backend/src/services/ai.service.ts`
- **Follow-up:** What else constrains the output? **Ans:** `responseMimeType: 'application/json'` and `responseJsonSchema`.

**Q53. How does `ai.service.ts` handle scanned PDFs with no text layer?**
- **Answer:** If `pdfTextResult.text.trim().length <= 50`, it reads the PDF as base64 `inlineData` (`application/pdf`) and uses Gemini multimodal vision OCR.
- **Source:** `backend/src/services/ai.service.ts`
- **Follow-up:** Why not always send the binary PDF? **Ans:** Sending extracted text is much faster and cheaper in tokens.

**Q54. How does `ai.service.ts` handle Gemini model deprecation or rate limits?**
- **Answer:** Iterates through `candidateModels` (`GEMINI_MODEL`, `gemini-2.5-flash-lite`, `gemini-3.5-flash-lite`, `gemini-3.5-flash`, `gemini-3.8-flash`, `gemini-flash-latest`).
- **Source:** `backend/src/services/ai.service.ts`
- **Follow-up:** What if all models fail? **Ans:** Throws the last captured error to `errorHandler`.

**Q55. Why separate AI extraction from `dateEngine.service.ts`?**
- **Answer:** LLMs are bad at calendar/business-day arithmetic and state holidays; Gemini extracts `numberOfDays` + `dayType`, and TypeScript computes the exact legal date.
- **Source:** `backend/src/services/ai.service.ts`, `backend/src/services/dateEngine.service.ts`
- **Follow-up:** Can an agent override the computed date? **Ans:** Yes, via `confirmedDate`.

**Q56. How does `assistant.service.ts` defend against prompt injection in uploaded PDFs?**
- **Answer:** Wraps untrusted contract text in `<<DOC_DATA>>...<</DOC_DATA>>` and explicitly instructs Gemini in `SYSTEM_INSTRUCTION` never to obey instructions inside document text.
- **Source:** `backend/src/services/assistant.service.ts`
- **Follow-up:** Is delimiter prompting 100% foolproof? **Ans:** No; that's why post-generation `verifyCitations()` and Zod schemas also enforce structural and factual bounds.

**Q57. How does `assistant.service.ts` handle addenda overriding the base contract?**
- **Answer:** `SYSTEM_INSTRUCTION` enforces addenda/counter-offer precedence and outputs structured `overrides: [{ original, overriddenBy, reason }]`.
- **Source:** `backend/src/services/assistant.service.ts`
- **Follow-up:** How does retrieval guarantee addenda aren't missed? **Ans:** `hybrid_retrieval` always includes `ADDENDUM` and `COUNTER_OFFER` chunks in full.

**Q58. What happens if `GEMINI_API_KEY` is missing during embedding generation?**
- **Answer:** Logs a warning and returns a 768-dimension zero vector (`new Array(768).fill(0)`) so local dev/tests don't crash.
- **Source:** `backend/src/services/embedding.service.ts`
- **Follow-up:** What happens to cosine similarity with a zero vector? **Ans:** `cosineSimilarity()` checks `if (normA === 0 || normB === 0) return 0`.

**Q59. How is LLM token cost tracked?**
- **Answer:** `recordGeminiCost()` records token usage into `ProviderCostEvent` per `organizationId`.
- **Source:** `backend/src/services/costTracker.service.ts`, `backend/src/services/agent/agentRuntime.ts`
- **Follow-up:** Why track per org? **Ans:** Enables unit-economics (COGS vs SaaS tier) monitoring in `/admin`.

**Q60. How does `assistant.service.ts` handle questions whose answers aren't in the PDF?**
- **Answer:** Sets `found: false`, `citations: []`, and suggests which document to request (e.g., HOA Addendum).
- **Source:** `backend/src/services/assistant.service.ts`
- **Follow-up:** Why is this better than answering from general knowledge? **Ans:** General real-estate law varies by state and contract; guessing creates legal liability.

---

## 7. RAG (Q61–Q70)

**Q61. Why use RAG instead of fine-tuning for real estate contracts?**
- **Answer:** Every deal has unique, private PDFs that change constantly; RAG injects tenant-scoped chunks at query time with page citations.
- **Source:** `backend/src/services/retrieval.service.ts`
- **Follow-up:** Could fine-tuning leak another tenant's contract? **Ans:** Yes, weights can memorize training data; RAG enforces per-query `organizationId` filtering.

**Q62. How does `pdf.service.ts` preserve layout when extracting pages?**
- **Answer:** Custom page renderer inspects `item.transform[5]` (Y-coordinate) to insert newlines between lines, and triggers Gemini Vision OCR if a page has `< 30` chars.
- **Source:** `backend/src/services/pdf.service.ts`
- **Follow-up:** Why `< 30` chars? **Ans:** Scanned PDFs often have empty or watermarks-only text layers.

**Q63. How does `chunk.service.ts` avoid splitting clauses mid-sentence?**
- **Answer:** Splits on paragraph breaks (`\n\s*\n+`), detects section headings (`SECTION_HEADING_REGEX`), and flushes at section boundaries (`>= 150` tokens) or `maxChunkTokens = 600`.
- **Source:** `backend/src/services/chunk.service.ts`
- **Follow-up:** Does it use chunk overlap? **Ans:** No; it relies on paragraph/section boundaries plus `sectionTitle` metadata.

**Q64. Explain the two modes in `retrieveRelevantChunks()`.**
- **Answer:** `full_context` when `totalDealTokens <= 120000`; `hybrid_retrieval` above `120000` (core contract docs in full + top-K bulky chunks scored by cosine similarity + keyword hits).
- **Source:** `backend/src/services/retrieval.service.ts`
- **Follow-up:** Why `120000`? **Ans:** Fits comfortably inside Gemini's context window with room for system prompt and output.

**Q65. How is tenant isolation guaranteed in `retrieval.service.ts`?**
- **Answer:** Enforces `requireOrgId()`, verifies `deal.findFirst({ where: { id: dealId, organizationId } })`, and pre-filters `documentChunk.findMany({ where: { dealId, organizationId } })`.
- **Source:** `backend/src/services/retrieval.service.ts`
- **Follow-up:** Why pre-filter instead of post-filtering after vector search? **Ans:** Post-filtering can leak existence or starve Top-K results with other tenants' chunks.

**Q66. How does `citationVerifier.ts` stop hallucinated quotes?**
- **Answer:** Checks `isQuotePresentOnPage()` against actual retrieved chunk text (exact or 80% window for >60-char quotes) and `validDeadlineIds.has(id)`. Drops fake citations and renumbers `[^n]`.
- **Source:** `backend/src/services/citationVerifier.ts`
- **Follow-up:** Why an 80% window tolerance? **Ans:** Handles minor ellipses or line-wrap artifacts in long quotes.

**Q67. Why does `retrieval.service.ts` keep `PURCHASE_AGREEMENT`, `COUNTER_OFFER`, and `ADDENDUM` in full even in hybrid mode?**
- **Answer:** A 1-line addendum can override a contingency in the main contract; top-K similarity might miss it.
- **Source:** `backend/src/services/retrieval.service.ts`
- **Follow-up:** What gets filtered in hybrid mode? **Ans:** Bulky disclosures/inspection reports (`!coreDocTypes.has(c.docType)`).

**Q68. What RAG capabilities are currently missing?**
- **Answer:** No BM25/TF-IDF weighting, no cross-encoder reranker, and vector similarity runs in JS memory rather than `pgvector` SQL `<=>`.
- **Source:** `backend/src/services/retrieval.service.ts`
- **Follow-up:** When would you add `pgvector` HNSW? **Ans:** When searching across thousands of deals/KB docs per org.

**Q69. How does `StatusStream` improve UX during RAG queries?**
- **Answer:** `askDealAssistant` emits `onStatusUpdate('retrieving' | 'reasoning' | 'verifying', msg)` so the UI shows live progress.
- **Source:** `backend/src/services/assistant.service.ts`, `frontend/src/components/assistant/StatusStream.tsx`
- **Follow-up:** Why is this important? **Ans:** Multi-step RAG + verification takes 2–5 seconds.

**Q70. How are `CONFIRMED` vs `PENDING` deadlines communicated by the RAG assistant?**
- **Answer:** `SYSTEM_INSTRUCTION` requires labeling `PENDING` deadlines as `"unconfirmed, pending agent review"`.
- **Source:** `backend/src/services/assistant.service.ts`
- **Follow-up:** Why? **Ans:** Prevents agents from treating unreviewed AI extractions as legally binding.

---

## 8. Agentic AI & LangGraph (Q71–Q85)

**Q71. Does this project use LangChain or LangGraph?**
- **Answer:** No. Neither is installed or imported. It uses a custom TypeScript Supervisor (`orchestrator.ts`) + bounded tool loop (`agentRuntime.ts`) + Zod tool registry (`agentTools.ts`).
- **Source:** `backend/src/services/agent/`
- **Follow-up:** How does your custom architecture map to LangGraph concepts? **Ans:** `orchestrator.ts` acts like conditional routing edges; `agentRuntime.ts` is the `StateGraph` loop capped at `MAX_AGENT_ROUNDS = 5`; `buyerMemory.service.ts` + `AgentRunTrace` act like state & checkpointing.

**Q72. Why build a custom TypeScript agent runtime instead of LangGraph?**
- **Answer:** Zero framework overhead, strict compile-time TypeScript types, direct `TrustedAgentContext` injection, and custom DB-grounded fallbacks.
- **Source:** `backend/src/services/agent/agentRuntime.ts`
- **Follow-up:** When would LangGraph be useful? **Ans:** Complex cyclic graphs with built-in human-interrupt checkpointing across long-running multi-day workflows.

**Q73. How does `routeToSpecialist()` in `orchestrator.ts` work?**
- **Answer:** Deterministic regex/state classifier maps buyer message to `TurnIntent` and dispatches `QUALIFIER`, `MATCHER`, `CLOSER`, `DOCS_RAG`, or `ESCALATION` with channel constraints.
- **Source:** `backend/src/services/agent/orchestrator.ts`
- **Follow-up:** Why deterministic routing instead of an LLM router call? **Ans:** Zero extra latency/cost and 100% predictable handling of `OPTOUT_DND` and `HUMAN_REQUEST`.

**Q74. Why cap `MAX_AGENT_ROUNDS` at `5`?**
- **Answer:** Bounds latency, token cost, and prevents infinite tool-calling loops if Gemini keeps requesting tools.
- **Source:** `backend/src/services/agent/agentRuntime.ts`
- **Follow-up:** What happens if `exhaustedLimit` is true? **Ans:** Loop exits and returns a safe response/fallback with `exhaustedLimit: true` logged in `AgentRunTrace`.

**Q75. How do you prevent prompt injection from calling a tool on another brokerage's data?**
- **Answer:** `executeAgentTool()` injects `TrustedAgentContext` (`organizationId`, `leadId`, `threadId`) from the server; tools never accept `organizationId` from LLM arguments.
- **Source:** `backend/src/services/agent/agentTools.ts`
- **Follow-up:** What if the LLM passes a different `leadId`? **Ans:** Tools scope queries with `where: { id: leadId, organizationId: trustedCtx.organizationId }`.

**Q76. Explain Fact Provenance in `buyerMemory.service.ts`.**
- **Answer:** Tags memory facts (`AUTHORITATIVE_DB`, `PENDING_PROPOSAL`, `BUYER_STATED`, `CONFIRMED_VISIT`, `PROPOSED_VISIT`, `ADVISOR_COMMITMENT`, `INFERRED_UNCONFIRMED`).
- **Source:** `backend/src/services/agent/buyerMemory.service.ts`
- **Follow-up:** Why distinguish `PROPOSED_VISIT` from `CONFIRMED_VISIT`? **Ans:** So the AI doesn't tell a buyer their tour is confirmed before `book_site_visit` succeeds.

**Q77. Why does `propose_buyer_requirements` create a proposal instead of mutating `LeadRequirement` directly?**
- **Answer:** Preserves `sourceEvidence` and `reason` for auditability and human/system confirmation.
- **Source:** `backend/src/services/agent/agentTools.ts`
- **Follow-up:** What Zod validation guards it? **Ans:** `.refine()` ensuring `minBudget <= maxBudget`.

**Q78. How does `book_site_visit` handle timezones and past dates?**
- **Answer:** Rejects `isPastDate()`, resolves IANA timezone (`requestedTz` → `Deal.timezone` → `NotificationSetting.timezone` → `'America/New_York'`), and converts via `parseLocalDateTimeToUtc()`.
- **Source:** `backend/src/services/agent/agentTools.ts`
- **Follow-up:** Why check `isValidIanaTimezone()`? **Ans:** Prevents invalid strings from crashing `Intl.DateTimeFormat`.

**Q79. What happens if Gemini is down during a live WhatsApp/Web chat?**
- **Answer:** `generateConsultativeFallback()` queries `AVAILABLE` properties in PostgreSQL for that org and builds a strictly DB-grounded reply.
- **Source:** `backend/src/services/agent/agentRuntime.ts`
- **Follow-up:** Why is DB-grounding critical in the fallback? **Ans:** Never invents fake project names or prices.

**Q80. What does `verifyAgentOutput()` check?**
- **Answer:** Deterministic post-LLM guardrail checking draft text against `verifiedPropertyTitles`, `hasCollateralToolSuccess`, and unauthorized discount promises.
- **Source:** `backend/src/services/agent/orchestrator.ts`
- **Follow-up:** Where are flags recorded? **Ans:** Returned in `SalesAgentResult.guardrailFlags` and saved in `AgentRunTrace`.

**Q81. How do channel constraints differ for `VOICE_CALL` vs `WHATSAPP`?**
- **Answer:** `VOICE_CALL` enforces 1–2 spoken sentences (< 35 words, no markdown/emojis, natural currency words); `WHATSAPP` allows 2–4 sentences (< 60 words, 1 question).
- **Source:** `backend/src/services/agent/orchestrator.ts`
- **Follow-up:** Why no markdown on voice? **Ans:** TTS engines read asterisks literally.

**Q82. How does Human Takeover work?**
- **Answer:** Setting `ConversationThread.isHumanTakeover = true` suppresses autonomous AI replies (`suppressed: true`).
- **Source:** `backend/src/services/agent/agentRuntime.ts`, `backend/src/services/agent/buyerMemory.service.ts`
- **Follow-up:** How does an advisor trigger it? **Ans:** Via conversation UI or `escalate_to_human` tool.

**Q83. How does `search_properties` handle zero exact matches?**
- **Answer:** `searchPropertiesHybrid()` / `propertyMatch.service.ts` uses elastic matching and `MicroMarketAdjacency` to suggest nearby/stretch alternatives.
- **Source:** `backend/src/services/agent/agentTools.ts`, `backend/src/services/propertyMatch.service.ts`
- **Follow-up:** Why is this important in real estate? **Ans:** Prevents dead-end "no results" conversations.

**Q84. How does Plivo live voice streaming connect to the agent?**
- **Answer:** `/api/webhooks/plivo` handles call events and `plivoStreamGateway.ts` attaches a WebSocket at `/ws/plivo/:sessionId` for bidirectional audio.
- **Source:** `backend/src/index.ts`, `backend/src/services/telephony/plivoStreamGateway.ts`
- **Follow-up:** How is call cost billed? **Ans:** Metered against `OrganizationWallet` (`wallet.service.ts`).

**Q85. How does `computeNextStage()` progress CRM lifecycle?**
- **Answer:** Advances `LeadLifecycleStage` based on intent and successful tools (e.g., requirements → `QUALIFIED`, visit booked → `VISIT_SCHEDULED`).
- **Source:** `backend/src/services/agent/orchestrator.ts`
- **Follow-up:** Why automate stage updates? **Ans:** Eliminates manual CRM data entry for agents.

---

## 9. Frontend (Q86–Q95)

**Q86. How does `App.tsx` implement route protection and code splitting?**
- **Answer:** Uses `React.lazy()` + `Suspense` (`WorkspacePageSkeleton`), `ProtectedLayout` (checks `user` & `PENDING_PAYMENT`), and `AdminRouteGuard` (`isPlatformAdmin`).
- **Source:** `frontend/src/App.tsx`
- **Follow-up:** Why reset `mainRef.current.scrollTop = 0` in `useEffect`? **Ans:** The scrollable container is `<main>`, not `window`.

**Q87. How does `AuthContext` prevent a login-screen flash on page reload?**
- **Answer:** Initializes `loading` to `getToken() !== null` and renders a skeleton until `authApi.me()` resolves.
- **Source:** `frontend/src/context/AuthContext.tsx`
- **Follow-up:** What if `me()` fails? **Ans:** `.catch(() => setToken(null))` clears the stale token.

**Q88. How does `api.ts` handle `401` responses globally?**
- **Answer:** `send()` calls `notifyUnauthorized()`, which clears `localStorage` + `swrCache` and emits `copilot:unauthorized` to `AuthContext`.
- **Source:** `frontend/src/services/api.ts`, `frontend/src/services/session.ts`
- **Follow-up:** Why clear `swrCache` on logout/token change? **Ans:** Prevents User B from seeing User A's cached deals on a shared browser.

**Q89. How does `PdfViewer.tsx` highlight AI citations?**
- **Answer:** Renders PDF via `pdfjs-dist` and uses `findQuoteInText()` (`quoteMatcher.ts`) with NFKC normalization and 70% fallback slicing.
- **Source:** `frontend/src/components/pdf/PdfViewer.tsx`, `frontend/src/utils/quoteMatcher.ts`
- **Follow-up:** Why 70% fallback slicing? **Ans:** PDF text layers sometimes reorder multi-column text slightly.

**Q90. How does `api.ts` speed up navigation?**
- **Answer:** Uses `swrCache` (stale-while-revalidate) for list endpoints like `deals:list`.
- **Source:** `frontend/src/services/api.ts`, `frontend/src/utils/swrCache.ts`
- **Follow-up:** Trade-off? **Ans:** Brief stale data until background revalidation completes.

**Q91. What hooks encapsulate domain logic in `frontend/src/hooks/`?**
- **Answer:** `useAssistant.ts`, `useDeadlines.ts`, `useNotifications.ts`.
- **Source:** `frontend/src/hooks/`
- **Follow-up:** Why custom hooks? **Ans:** Keeps page components clean and separates data fetching/state from UI.

**Q92. How does `ProtectedLayout` prevent horizontal layout shift?**
- **Answer:** Applies `style={{ scrollbarGutter: 'stable' }}` on `<main>`.
- **Source:** `frontend/src/App.tsx`
- **Follow-up:** What's `h-dvh` for? **Ans:** Dynamic viewport height on mobile browsers.

**Q93. How does `api.ts` handle `204 No Content`?**
- **Answer:** Checks `if (res.status === 204)` and `if (!text)` before calling `JSON.parse(text)`.
- **Source:** `frontend/src/services/api.ts`
- **Follow-up:** What happens if you call `res.json()` on `204`? **Ans:** Throws `SyntaxError: Unexpected end of JSON input`.

**Q94. How is the landing page (`LandingPage.tsx`) built?**
- **Answer:** Combines `three`/`@react-three/fiber` (`Hero3DCanvas`), `gsap` (`PinnedWorkflowShowcase`), `framer-motion`, and `lenis`.
- **Source:** `frontend/src/pages/LandingPage.tsx`, `frontend/package.json`
- **Follow-up:** Does `LandingPage` bloat the workspace bundle? **Ans:** No—`React.lazy()` code-splits it into its own chunk.

**Q95. How does `CommandPalette` (`⌘K`) improve UX?**
- **Answer:** Global keyboard navigation modal inside `ProtectedLayout` for jumping between deals, leads, and settings.
- **Source:** `frontend/src/App.tsx`, `frontend/src/components/CommandPalette.tsx`
- **Follow-up:** Why mount it in `ProtectedLayout`? **Ans:** Only authenticated workspace users should navigate workspace routes.

---

## 10. Production & System Design (Q96–Q100)

**Q96. What are the top 3 scaling bottlenecks at 100x traffic, and how do you fix them?**
- **Answer:** (1) `verifySessionToken()` DB hit per request → Redis cache invalidated on `sessionVersion` bump; (2) In-memory `rateLimit.ts` → Redis sliding window; (3) In-memory `cosineSimilarity()` → SQL `pgvector` HNSW index.
- **Source:** `auth.service.ts`, `rateLimit.ts`, `retrieval.service.ts`
- **Follow-up:** What about `alertCron` on multiple replicas? **Ans:** Extract to a single worker or use distributed locking/BullMQ.

**Q97. How does the system handle concurrency races?**
- **Answer:** `acceptInvitation` uses atomic `updateMany` with `acceptedAt: null`; `OutboxJob` uses `@unique messageId`; `gracefulShutdown` uses `isShuttingDown`.
- **Source:** `auth.service.ts`, `outboxDispatcher.ts`, `index.ts`, `backend/tests/concurrency.test.ts`
- **Follow-up:** Where is a race still possible? **Ans:** `alert.service.ts` `emailLog` check-then-insert (fix: unique composite constraint on `(deadlineId, template)`).

**Q98. How do you optimize AI cost & latency?**
- **Answer:** Text-layer extraction before Vision OCR (`ai.service.ts`), `full_context` vs `hybrid_retrieval` token budgeting (`120k`), `MAX_AGENT_ROUNDS = 5`, deterministic `routeToSpecialist()`, and `ProviderCostEvent` tracking.
- **Source:** `ai.service.ts`, `retrieval.service.ts`, `agentRuntime.ts`, `costTracker.service.ts`
- **Follow-up:** What's the cheapest model in the fallback chain? **Ans:** `gemini-2.5-flash-lite` / `gemini-3.5-flash-lite`.

**Q99. How is multi-tenant security enforced end-to-end?**
- **Answer:** `requireAuth` (JWT + DB `org` & `sv` check) → `requireRole()` → `requireOrgId()` fail-closed → Prisma `where: { organizationId }` → `TrustedAgentContext` in AI tools → `organizationId` pre-filtering in RAG.
- **Source:** `middleware/auth.ts`, `utils/tenant.ts`, `agentTools.ts`, `retrieval.service.ts`
- **Follow-up:** How is this verified? **Ans:** `backend/tests/security/`.

**Q100. Give a 30-second executive pitch of the entire architecture.**
- **Answer:** "Eigen Estate is a multi-tenant B2B real estate OS built on React 18, Express, Prisma, and PostgreSQL. It pairs an **Escrow Contingency Copilot**—using Gemini for structured clause extraction, a deterministic holiday-aware date engine, hybrid RAG with prompt-injection delimiters and verified PDF quote highlighting, and an hourly alert cron—with an **Autonomous Omnichannel AI Sales Agent** across Web, WhatsApp, Telegram, and Plivo Voice, powered by a deterministic Supervisor router, Zod-validated tenant-scoped tools, fact-provenance buyer memory, and a transactional outbox."
- **Source:** `backend/src/index.ts`, `backend/src/app.ts`, `frontend/src/App.tsx`
- **Follow-up:** What's the #1 thing you'd harden before enterprise launch? **Ans:** Switch `render.yaml` from `db push` to `migrate deploy`, move `rateLimit` + session cache to Redis, and push vector search into `pgvector` SQL.
