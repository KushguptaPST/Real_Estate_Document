# Eigen Estate — Technical & Product Judge Q&A (42 Questions)

> **Grounded strictly in verified source code (`backend/src/`, `backend/prisma/schema.prisma`, `frontend/src/`, `backend/tests/`).**

---

## Category 1: Product & Problem Space

### 1. What problem does Eigen Estate solve?
Eigen Estate solves two operational failures for residential real estate brokerages: (1) **Escrow Contingency Forfeiture**, where missed inspection, financing, or appraisal deadlines in 15–45+ page PDFs risk deposit loss or E&O liability; and (2) **Inbound Lead Leakage**, where prospective buyers go cold when advisors are unavailable across WhatsApp, Telegram, web chat, or phone.

### 2. Who are the target users?
Four personas exist in the codebase: **Brokerage Owners (`OWNER`)**, **Transaction Coordinators & Advisors (`AGENT`)**, **Platform Super-Admins (`isPlatformAdmin`)**, and **Prospective Buyers** interacting externally via Web Widget, WhatsApp, Telegram, or Plivo Voice.

### 3. Why combine pre-contract Sales CRM with post-contract Escrow Surveillance?
Both belong to the same brokerage transaction lifecycle. When a buyer lead is won, Eigen Estate atomically converts the `Lead` into an active `Deal` inside `prisma.$transaction`, locking the matched `Property` to `UNDER_CONTRACT` and carrying buyer context straight into contract ingestion.

### 4. Can a brokerage use only the Escrow module without the AI Sales Agent?
Yes. `dealsRouter` (`/api/deals`) and `leadsRouter` (`/api/leads`) operate independently. A coordinator can upload a purchase agreement PDF directly to a deal without originating from a lead.

### 5. What differentiates Eigen Estate from generic AI chatbots or legacy CRMs?
Three deterministic guarantees: (1) LLMs never compute dates (`dateEngine.service.ts` uses `date-fns` + `date-holidays`), (2) LLMs never return unverified quotes (`citationVerifier.ts` checks every quote verbatim against PDF chunks), and (3) AI tools never mutate authoritative CRM tables directly (Proposal Pattern).

---

## Category 2: System Architecture & Tech Stack

### 6. Why did you choose a TypeScript monorepo?
Sharing TypeScript across `backend/` (Node 22+, Express 4.19, Prisma 5.22) and `frontend/` (React 18, Vite 8) ensures consistent data contracts, Zod schema validation, and rapid full-stack iteration.

### 7. Why is `@anthropic-ai/sdk` in `backend/package.json` if you use Google Gemini?
`@anthropic-ai/sdk` is listed in `backend/package.json` as a planned multi-provider dependency, but it is not currently imported in `backend/src/`. All active LLM extraction, embeddings, RAG Q&A, and agent tool-calling use `@google/genai` (`2.23.0`).

### 8. Why did you build a Transactional Outbox in PostgreSQL instead of using Redis/RabbitMQ?
Using an `OutboxJob` table in PostgreSQL lets us atomically update a `ConversationMessage` and enqueue its dispatch job inside a single `prisma.$transaction`. This eliminates dual-write failures without operating a separate message broker.

### 9. How does `outboxDispatcher.ts` prevent duplicate message sends?
Each `OutboxJob` has a unique `messageId` and `idempotencyKey` (`dispatch-${messageId}`). Workers claim jobs using optimistic locking (`lockedAt`) and retry transient failures with bounded exponential backoff.

### 10. How does the server handle graceful shutdown?
`gracefulShutdown()` in `backend/src/index.ts` is idempotent: it stops `node-cron` alert jobs and the Telegram bot, closes the HTTP server to drain in-flight requests, disconnects Prisma (`prisma.$disconnect()`), and enforces a 10-second emergency timeout.

---

## Category 3: Database & Data Integrity

### 11. Why row-level multi-tenancy instead of database-per-tenant?
Row-level scoping via `organizationId` foreign keys avoids PostgreSQL connection-pool exhaustion and migration sprawl across hundreds of brokerages, while enforcing isolation via `requireOrgId()` and automated tenant-isolation tests.

### 12. How do you prevent race conditions when two webhooks create the same lead simultaneously?
`Lead` has database-level composite unique constraints `@@unique([organizationId, normalizedEmail])` and `@@unique([organizationId, normalizedPhone])`. `concurrency.test.ts` verifies that simultaneous identical requests yield exactly one lead.

### 13. How do you prevent double-converting a Lead into a Deal?
`Deal.leadId` has a `@unique` constraint in `schema.prisma`. Lead-to-Deal conversion runs inside `prisma.$transaction`, verifies lead eligibility, updates the property to `UNDER_CONTRACT`, and fails closed with HTTP `409 Conflict` on concurrent conversion races.

### 14. How do you prevent webhook replay attacks?
`WebhookEvent` enforces `@@unique([provider, externalEventId])`. Duplicate deliveries from WhatsApp, Resend, or SendGrid hit the unique constraint and are safely ignored without reprocessing.

### 15. What happens when a revised contract PDF is re-uploaded to an existing deal?
Instead of deleting existing human-reviewed tasks, reprocessing creates `TaskProposal` records. Human-edited or completed `TransactionTask` rows are never overwritten without explicit approval.

---

## Category 4: Authentication & Security

### 16. How does authentication work without passwords?
Eigen Estate uses Google Identity Services (`google-auth-library`) to verify Google ID tokens. New organizations and members are invite-only, using single-use SHA-256 hashed invitation tokens (`hashToken`).

### 17. How do you instantly revoke a terminated agent's JWT before its 7-day expiry?
Every JWT embeds a `sv` (`sessionVersion`) claim. On every protected request, `verifySessionToken()` checks `claims.sv === user.sessionVersion` in PostgreSQL. Removing or demoting an agent increments `sessionVersion`, immediately invalidating all their active tokens.

### 18. How does `assertSecurityConfig()` protect production deployments?
Called at startup in `backend/src/index.ts`, it refuses to boot if `JWT_SECRET` is missing, shorter than 32 characters, matches known weak secrets, or if `ENABLE_DEMO_LOGIN=true` in `NODE_ENV=production`.

### 19. How are webhook signatures verified without JSON re-serialization bugs?
In `backend/src/app.ts`, `express.json({ verify })` captures the exact raw bytes onto `req.rawBody`. Webhook handlers compute timing-safe HMAC-SHA256 digests over `req.rawBody` rather than `JSON.stringify(req.body)`.

### 20. How do you defend against prompt injection in uploaded PDFs or buyer messages?
Untrusted user messages and PDF text are wrapped in `<UNTRUSTED_CONTENT>` boundary tags, system instructions forbid overriding tenant/business rules, tools receive `TrustedAgentContext` from the server, and `tests/security/promptInjection.test.ts` tests injection resistance.

### 21. How are programmatic API keys stored?
`OrganizationApiKey` hashes keys using Node's `crypto.scrypt` rather than storing plaintext keys.

### 22. What happens if Org A requests a Deal or Lead belonging to Org B?
Every query is scoped by `organizationId` from `req.user` (enforced via `requireOrgId()`). Cross-tenant lookups return `404 Not Found`, leaking neither data nor resource existence.

---

## Category 5: AI Integration & Deterministic Date Engine

### 23. How does PDF clause extraction work for both digital and scanned PDFs?
`ai.service.ts` first runs `pdf-parse` locally. If the extracted text layer has >50 characters, it sends the text (fast path). Otherwise, it reads the PDF as base64 `inlineData` for Gemini multimodal vision OCR.

### 24. How do you ensure Gemini returns valid structured JSON for clauses?
`extractClausesFromPdf()` passes `responseMimeType: 'application/json'`, a strict `responseJsonSchema`, and `temperature: 0`, then parses the output through Zod (`GeminiResponseSchema` / `ExtractedClauseSchema`).

### 25. Why not let Gemini calculate the due date directly?
LLMs frequently miscount calendar vs. business days across month boundaries, leap years, and state-specific statutory holidays. Gemini only extracts `numberOfDays` and `dayType`; `dateEngine.service.ts` computes the exact date deterministically.

### 26. How does `dateEngine.service.ts` handle business days?
When `dayType === 'business'`, `computeDeadline()` uses `date-holidays(country, state)` to build a set of statutory holiday dates and loops day-by-day with `date-fns`, incrementing only when `!isWeekend(current) && !holidayDates.has(dateStr)`.

### 27. How do you handle Daylight-Saving Time (DST) edge cases for site visits?
`parseLocalDateTimeToUtc()` in `backend/src/utils/timezone.ts` detects nonexistent spring-forward times (e.g., 02:30 EDT) and ambiguous fall-back times, throwing explicit validation errors rather than silently shifting appointments.

---

## Category 6: Hybrid RAG & Citation Verification

### 28. Why not use standard chunk-only vector RAG for contracts?
Purchase agreements frequently include `COUNTER_OFFER` and `ADDENDUM` documents that override clauses on earlier pages. Top-K chunk retrieval alone can miss an overriding addendum.

### 29. How does Dual-Mode Retrieval in `retrieval.service.ts` work?
After strict tenant pre-filtering (`WHERE dealId AND organizationId`), if total deal tokens are `<= 120,000` (`ASSISTANT_FULL_CONTEXT_TOKENS`), Mode 1 injects all chunks in full. Above 120k tokens, Mode 2 keeps core contracts in full and retrieves Top-K bulky chunks using `0.7 * cosineSimilarity + 0.3 * keywordScore` plus ±1 adjacent neighbor pages.

### 30. Does `retrieval.service.ts` use `pgvector` SQL queries?
Not yet—while `docker-compose.yml` runs `pgvector/pgvector:pg16`, `retrieval.service.ts` currently fetches tenant-scoped `DocumentChunk` rows and computes `cosineSimilarity()` in Node.js memory.

### 31. How does `citationVerifier.ts` guarantee zero hallucinated citations?
`verifyCitations()` normalizes both the LLM's cited quote and the database page chunk (`NFKC`, straight quotes, un-hyphenation, collapsed whitespace) and checks verbatim substring presence (with an 80% continuous-window tolerance for quotes >60 chars). Unverified quotes are dropped and footnotes `[^n]` are renumbered.

---

## Category 7: Agentic AI & Omnichannel Voice/Messaging

### 32. Do you use LangChain or LangGraph?
No. We built a custom TypeScript supervisor and bounded execution loop in `orchestrator.ts` and `agentRuntime.ts` for strict type safety, zero framework overhead, and direct control over channel constraints.

### 33. What are the 6 specialists in `orchestrator.ts`?
`SUPERVISOR`, `QUALIFIER` (discovery), `MATCHER` (verified inventory + collateral), `CLOSER` (site visit availability & booking), `DOCS_RAG` (project RERA/legal knowledge), and `ESCALATION` (opt-out/DND or human handoff).

### 34. How do you prevent infinite agent tool-calling loops?
`agentRuntime.ts` enforces a hard cap of `MAX_AGENT_ROUNDS = 5` and sets `exhaustedLimit = true` if reached.

### 35. How do you stop the AI from pitching over-budget properties?
`propertyMatch.service.ts` applies mandatory SQL hard filters (`status = 'AVAILABLE'`, `price <= maxBudget`, `bedrooms >= minBedrooms`, `propertyType`) **before** any soft ranking or LLM response generation.

### 36. How does `HUMAN_TAKEOVER` work when an advisor replies on WhatsApp?
`ConversationThread` tracks an explicit state machine (`AUTOPILOT`, `DRAFT_ONLY`, `HUMAN_TAKEOVER`, `PAUSED`, `CLOSED`). When a human advisor replies or takeover is triggered, `agentRuntime.ts` deterministically suppresses AI replies (`suppressed: true`).

### 37. How does live voice calling work?
`plivoStreamGateway.ts` attaches a WebSocket server at `/ws/plivo/:sessionId` handling 8kHz mono mu-law audio (`ffmpeg` transcode), Deepgram/Gemini STT, the `VOICE_CALL`-constrained agent (`<35 words`, no markdown), and TTS failover (ElevenLabs Flash v2.5 -> Cartesia Sonic -> Microsoft Edge Neural).

---

## Category 8: Testing, Billing, & Future Scaling

### 38. How is AI and telephony cost tracked per tenant?
`costTracker.service.ts` records per-turn Gemini token costs, STT, TTS, and Plivo voice usage. Tenants top up metered wallets via Razorpay (INR) or subscribe via Stripe.

### 39. What automated tests exist in the repository?
`backend/tests/` contains unit, concurrency, E2E, and security suites—including `tenantIsolation.test.ts`, `tenantIsolationAdversarial.test.ts`, `promptInjection.test.ts`, `webhookSecurity.test.ts`, `concurrency.test.ts`, `dateEngine.service.test.ts`, and `agenticOmnichannel.test.ts`.

### 40. What are the main current limitations of the codebase?
Four verified gaps: (1) `rateLimit.ts` uses an in-memory `Map` (single-instance); (2) `retrieval.service.ts` runs cosine similarity in Node.js memory rather than SQL `pgvector` HNSW; (3) `@anthropic-ai/sdk` is installed but unused; and (4) file uploads default to local disk unless ImageKit is configured.

### 41. How would you scale this to 10,000+ concurrent brokerages?
Move `rateLimit.ts` and WebSocket session state to Redis, index `DocumentChunk.embedding` with SQL `pgvector` HNSW, run `outboxDispatcher` and `campaignWorker` as dedicated worker processes, and enforce ImageKit/S3 object storage.

### 42. What is the single most important takeaway for judges?
Eigen Estate proves that AI in high-stakes domains (real estate law & sales) must be **bounded by deterministic engineering**: deterministic holiday math, verbatim citation verification, SQL-hard-filtered matching, and Proposal-Pattern human oversight.
