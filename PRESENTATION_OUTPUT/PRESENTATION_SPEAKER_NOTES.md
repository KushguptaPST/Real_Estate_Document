# Eigen Estate — Complete Presenter Speaker Notes (Slides 1–20)

> **Target Audience:** College Demo Day Panel, Technical Evaluators, & Startup Judges  
> **Deck:** `PRESENTATION_OUTPUT/PROJECT_PRESENTATION.pptx` (20 Slides)

---

## Slide 1 — Cover
- **What the slide communicates:** Introduces Eigen Estate (`eigenestate.com`) as a dual-pillar, multi-tenant B2B Real Estate Operating System combining deterministic escrow contingency surveillance with an autonomous omnichannel AI sales agent.
- **What to explain:** Real estate brokerages lose revenue at both ends of a transaction: pre-contract (inbound buyer leads go cold within minutes) and post-contract (contingency deadlines buried in 15–45+ page PDFs get missed). Eigen Estate unifies both in one tenant-isolated workspace.
- **Key technical details:** TypeScript monorepo (`eigen-estate-monorepo`) with `backend/` (Express 4, Prisma 5.22, PostgreSQL 16, `@google/genai`, `ws`, `node-cron`) and `frontend/` (React 18, Vite 8, Tailwind CSS, `pdfjs-dist`).
- **Speaking script:** *"Good afternoon, judges. I'm presenting Eigen Estate—an Autonomous Real Estate Operating System and Escrow Surveillance Platform. Real estate brokerages face two costly operational failures: inbound buyer leads go cold in minutes, and post-contract contingency deadlines buried in 40-page PDFs get missed, risking earnest money forfeiture. Eigen Estate solves both using deterministic date engineering, citation-verified RAG, and a bounded multi-agent sales runtime."*
- **Transition:** *"Let's look closely at the real-world problem and why existing tools fall short."*
- **Likely judge questions:** *Why combine Sales CRM with Escrow Contingency tracking?* Both belong to the same brokerage transaction lifecycle—our atomic Lead-to-Deal conversion links pre-contract qualification directly to post-contract escrow compliance.

## Slide 2 — The Problem
- **What the slide communicates:** Defines the two real-world operational failures (Pillar A: Escrow Contingency Forfeiture; Pillar B: Inbound Lead Leakage) and explains why legacy CRMs, generic LLM wrappers, and calendar tools are insufficient.
- **What to explain:** Post-contract, coordinators manually transcribe deadlines mixing calendar and business days (which exclude weekends and state holidays) into fragile spreadsheets. Pre-contract, buyers message across WhatsApp, Telegram, web chat, and phone; generic bots hallucinate prices/discounts or collide with human advisors.
- **Key technical details:** Purchase agreements (`PURCHASE_AGREEMENT`, `COUNTER_OFFER`, `ADDENDUM`) often override earlier dates across pages.
- **Speaking script:** *"Real estate brokerages operate across two high-stakes phases. Post-contract, a single purchase agreement contains overlapping inspection, financing, and appraisal deadlines—mixing calendar and business days. One spreadsheet typo can forfeit a buyer's deposit. Pre-contract, inbound buyers message on WhatsApp, Telegram, web chat, or phone; if advisors are in showings, leads go cold. Existing CRMs are passive, and generic LLM chatbots hallucinate prices or contract clauses."*
- **Transition:** *"Let's examine why solving this problem reliably requires deterministic engineering, not just another chatbot."*
- **Likely judge questions:** *Who experiences this problem?* Brokerage owners (`OWNER`), transaction coordinators and advisors (`AGENT`), and prospective buyers.

## Slide 3 — Why This Problem Matters
- **What the slide communicates:** Maps the four high-stakes pain points—Deposit/Contract Risk, Legal & E&O Auditability, Speed-to-Lead Conversion, and Multi-Tenant Isolation—directly to implemented safeguards in the codebase.
- **What to explain:** Emphasize that we don't rely on generic estimates—every risk maps to concrete code: hourly alert cron (`alert.service.ts`), immutable `AuditLog` + `citationVerifier.ts`, 4-channel agent routing, and `requireOrgId()`.
- **Key technical details:** `alert.service.ts` checks `3d`, `1d`, `dayOf`, and `missed` windows with `EmailLog` deduplication.
- **Speaking script:** *"Why does this matter? First, missing a contingency cutoff by 24 hours can trigger contract cancellation or deposit loss. Second, brokerages face Errors & Omissions liability if they can't prove when notices were sent. Third, buyers expect instant responses across WhatsApp and voice. Finally, in a B2B SaaS serving competing brokerages, data isolation is existential. Every quadrant here maps directly to an implemented safeguard in our codebase."*
- **Transition:** *"Now let's look at how Eigen Estate solves all four problems in one unified architecture."*
- **Likely judge questions:** *How do you prevent duplicate alert emails?* `alert.service.ts` checks `prisma.emailLog.findFirst` for `(deadlineId, template)` before dispatching.

## Slide 4 — Our Solution
- **What the slide communicates:** Presents Eigen Estate's core architecture thesis: **"AI for Understanding. Deterministic Code for Legal & Math."** alongside the 4-stage lifecycle.
- **What to explain:** Walk through the dark left panel (4 engineering principles) and the 4 stages on the right: Omnichannel Inbound -> Qualify/Match/Book -> Atomic Convert & PDF Ingest -> Citation-Verified Surveillance.
- **Key technical details:** `dateEngine.service.ts`, `citationVerifier.ts`, Proposal models (`LeadRequirementProposal`, `TaskProposal`), and `prisma.$transaction` Lead-to-Deal conversion.
- **Speaking script:** *"Our core thesis at Eigen Estate is simple: use AI for language understanding, and deterministic code for math, legal citations, and state mutations. Gemini never calculates a deadline date—our TypeScript date engine does. Gemini never invents a quote—our citation verifier checks it verbatim against the PDF chunk. And our sales agent never overwrites CRM data directly—it writes structured proposals."*
- **Transition:** *"Let's look at the main product modules and how users navigate the platform."*
- **Likely judge questions:** *What happens if Gemini is unavailable?* Extraction retries across candidate models and fails gracefully without corrupting deal state; deterministic matching and date math continue operating.

## Slide 5 — Product Overview
- **What the slide communicates:** Maps the 5 core product modules (Escrow & Deals, Deal RAG Assistant, Omnichannel CRM, Inventory & Visits, SaaS & Ops) and the end-to-end user journey.
- **What to explain:** All 5 modules live inside a single Organization workspace with role-based access (`OWNER`, `AGENT`, and `isPlatformAdmin`).
- **Key technical details:** 24 React pages (`frontend/src/pages/`) and 24 Express route modules (`backend/src/api/routes/`) backed by one PostgreSQL schema.
- **Speaking script:** *"Eigen Estate is organized into five cohesive modules inside a single workspace. On the escrow side, we have Contract Ingestion and the Grounded Deal RAG Assistant. On the sales side, we have Omnichannel CRM with persistent buyer memory and Property Matching with site-visit booking. Underpinning both is our SaaS Operations layer with Stripe/Razorpay billing, COGS tracking, and super-admin controls."*
- **Transition:** *"Let's see how these capabilities appear in the actual application UI."*
- **Likely judge questions:** *Can a brokerage use only Escrow or only Sales?* Yes—Deals and Leads operate independently, and Leads can also convert atomically into Deals.

## Slide 6 — Key Features
- **What the slide communicates:** Showcases live screenshots of `/docs` (4-Stage Autonomous Escrow Lifecycle) and `/security` (Security & E&O Defense) alongside 4 core feature cards.
- **What to explain:** Point out the real screenshots captured from the running Vite + React 18 frontend (`localhost:3000`). Walk through the 4 stages shown in the UI and the 4 feature callouts below.
- **Key technical details:** Real rendered screenshots; `dateEngine.service.ts`, `citationVerifier.ts`, `agentRuntime.ts`, `AuditLog`.
- **Speaking script:** *"Here you can see screenshots from the live Eigen Estate application. On the left is our 4-stage Autonomous Escrow Lifecycle view, guiding coordinators from PDF ingestion to citation review and automated countdown alerts. On the right is our Security & E&O Defense overview. Below are the four pillars powering it: deterministic holiday-aware date math, citation-verified RAG, our 6-specialist omnichannel sales agent, and deterministic human takeover."*
- **Transition:** *"Now let's dive under the hood into the full System Architecture."*
- **Likely judge questions:** *Are those real screenshots?* Yes, captured directly from the running React 18 + Vite frontend.

## Slide 7 — System Architecture
- **What the slide communicates:** Visualizes the complete 5-layer system architecture: Clients & Channels -> Express Gateway -> Domain & AI Layer -> PostgreSQL/Storage -> External APIs.
- **What to explain:** Trace data flow left to right. Explicitly note that queuing uses PostgreSQL `OutboxJob` (no Redis/RabbitMQ) and agent orchestration is custom TypeScript (no LangGraph).
- **Key technical details:** `app.ts`, `index.ts`, `/ws/plivo/:sessionId`, `node-cron`, `pgvector:pg16`, ImageKit/local disk.
- **Speaking script:** *"Here is our complete system architecture. On the left, buyers and agents interact through our React 18 SPA, embeddable web widget, WhatsApp, Telegram, or live Plivo phone calls. Every request enters our Express gateway where Helmet, strict CORS, rawBody capture, and JWT sessionVersion checks run. Inside the Domain and AI layer, our deterministic date engine, hybrid RAG verifier, and bounded 6-specialist agent runtime execute against PostgreSQL 16 via Prisma."*
- **Transition:** *"Let's inspect the exact technology stack and why each component was chosen."*
- **Likely judge questions:** *Why use PostgreSQL for the outbox queue?* Transactional Outbox in Postgres guarantees atomic commit with business state changes without extra queue infrastructure.

## Slide 8 — Technology Stack
- **What the slide communicates:** Lists exact verified packages and versions from `package.json` across 8 layers, plus engineering rationale.
- **What to explain:** Highlight TypeScript end-to-end, Prisma 5.22 + PostgreSQL 16, `@google/genai 2.23.0` + Zod, `date-holidays`, Plivo + `ws` + `msedge-tts`, React 18 + Vite 8, and Jest 30.5 + Supertest.
- **Key technical details:** `@anthropic-ai/sdk` is in `package.json` but unused in `src/`—so it is intentionally excluded from active stack claims.
- **Speaking script:** *"Every technology in our stack was chosen for a specific engineering constraint. TypeScript across backend and frontend gives us shared type safety. PostgreSQL 16 with Prisma gives us ACID transactions for atomic lead conversion and our transactional outbox. Google Gemini provides structured JSON schema enforcement and a 120k+ token window for long contracts, while `date-holidays` ensures deterministic statutory holiday math."*
- **Transition:** *"Let's zoom into the Backend Engineering layer and see how requests flow through Express."*
- **Likely judge questions:** *Why Gemini instead of another LLM?* Native `responseJsonSchema` enforcement, multimodal PDF fallback for scanned contracts, and a large context window for full-contract RAG.

## Slide 9 — Backend Engineering
- **What the slide communicates:** Explains the Express request lifecycle (`app.ts`), 24 modular route files, background daemons, and idempotent graceful shutdown (`index.ts`).
- **What to explain:** Walk through the 5-step pipeline, highlighting `req.rawBody` capture for HMAC signature verification and `assertSecurityConfig()` startup guards.
- **Key technical details:** `helmet()`, `cors()`, `express.json({ limit: '1mb', verify })`, `requireAuth`, `requireRole`, `outboxDispatcher.ts`, `gracefulShutdown()`.
- **Speaking script:** *"Our backend is a modular Express + TypeScript API with 24 route files. Every incoming HTTP request passes through Helmet, strict CORS, and a JSON parser that preserves `req.rawBody` so webhook HMAC signatures are verified over exact bytes. Protected routes enforce `requireAuth`, `requireRole`, and `requireOrgId`. At startup, `assertSecurityConfig()` refuses to boot with weak secrets, and `gracefulShutdown()` cleanly drains connections and stops background crons."*
- **Transition:** *"Next, let's look at how all this data is modeled and isolated in PostgreSQL."*
- **Likely judge questions:** *Why capture `rawBody` in `express.json`?* Re-serializing parsed JSON changes whitespace/key ordering and breaks HMAC-SHA256 verification for Meta WhatsApp, Svix/Resend, and Stripe.

## Slide 10 — Database Architecture
- **What the slide communicates:** Shows the PostgreSQL 16 + Prisma ER structure under `Organization` (tenant root), split into Escrow & RAG vs. Omnichannel Sales clusters, plus composite unique constraints.
- **What to explain:** Highlight how `Deal.leadId @unique` enforces 1-to-1 Lead-to-Deal conversion inside `prisma.$transaction`, and how `WebhookEvent` and `Lead` unique constraints stop replays and race conditions.
- **Key technical details:** `backend/prisma/schema.prisma` (30+ models, `P2002` handling, composite `[organizationId, ...]` indexes).
- **Speaking script:** *"Our PostgreSQL 16 database models 30+ entities under a single Organization tenant root. Notice the bridge between our two clusters: `Deal.leadId` has a `@unique` constraint, so converting a won lead into an escrow deal executes inside a `prisma.$transaction` and guarantees no lead can ever be double-converted. Similarly, composite unique constraints on `Lead` and `WebhookEvent` prevent race conditions and replay attacks at the database level."*
- **Transition:** *"Let's look at how authentication, authorization, and tenant security protect every query."*
- **Likely judge questions:** *Why row-level tenancy instead of separate DBs per tenant?* Avoids connection pool exhaustion and migration sprawl while keeping isolation enforced via `requireOrgId()` and automated security tests.

## Slide 11 — Authentication & Security
- **What the slide communicates:** Covers Dual-Model Auth (Google OAuth 2.0 + invite SHA-256 hashes + JWT `sv` check), RBAC, HMAC webhook defense, prompt-injection boundaries, and security test suites.
- **What to explain:** Emphasize instant revocation via `sessionVersion` (`sv`): removing an agent increments `sv` in Postgres, immediately invalidating their JWTs across all devices.
- **Key technical details:** `auth.service.ts`, `middleware/auth.ts`, `utils/tenant.ts`, `tests/security/` (`tenantIsolationAdversarial.test.ts`, `promptInjection.test.ts`, `webhookSecurity.test.ts`).
- **Speaking script:** *"Security in Eigen Estate is built around zero-trust multi-tenancy. Users sign in via passwordless Google OAuth, and every JWT embeds a `sessionVersion` claim checked against PostgreSQL on each request—giving us instant revocation if an agent leaves. Every service calls `requireOrgId()` fail-closed, webhooks verify timing-safe HMAC-SHA256 over `rawBody`, and we back this with dedicated adversarial tenant-isolation and prompt-injection test suites."*
- **Transition:** *"Now let's examine how we integrate Google Gemini for contract extraction and deterministic deadline math."*
- **Likely judge questions:** *Doesn't checking `sessionVersion` on every request add latency?* It's a single indexed primary-key lookup on `User.id` in PostgreSQL, taking sub-millisecond time while eliminating the 7-day revocation gap.

## Slide 12 — AI Integration & Deterministic Date Engine
- **What the slide communicates:** Details the 5-step PDF-to-Deadline pipeline (`ai.service.ts` + `dateEngine.service.ts` + `timezone.ts`).
- **What to explain:** Highlight the fast `pdf-parse` text-layer path vs. scanned PDF base64 multimodal fallback, `responseJsonSchema` + Zod validation, and `date-holidays` business-day math.
- **Key technical details:** `temperature: 0`, `ExtractedClauseSchema`, `computeContractDeadline()`, `parseLocalDateTimeToUtc()`.
- **Speaking script:** *"When a purchase agreement PDF is uploaded, `pdf-parse` extracts the text layer in milliseconds—or falls back to Gemini's multimodal PDF vision if it's a scanned image. Gemini outputs structured JSON constrained by `responseJsonSchema` and validated with Zod. Crucially, Gemini only extracts the integer day count and whether it's calendar or business days. Our TypeScript `dateEngine` then computes the exact legal due date, skipping weekends and state-specific holidays via `date-holidays`."*
- **Transition:** *"Once a contract is ingested, how do agents ask complex questions across multiple addenda without hallucinations? Let's look at our Hybrid RAG architecture."*
- **Likely judge questions:** *What if an addendum overrides an earlier deadline?* Core contracts (`PURCHASE_AGREEMENT`, `COUNTER_OFFER`, `ADDENDUM`) are injected in full in RAG, and `AssistantResponseSchema` explicitly detects `overrides`.

## Slide 13 — RAG Architecture
- **What the slide communicates:** Explains the Dual-Mode Hybrid RAG pipeline (`retrieval.service.ts`) and server-side Verbatim Citation Verifier (`citationVerifier.ts`).
- **What to explain:** Under 120,000 tokens, full-context mode injects all chunks so cross-document overrides are never missed. Over 120,000 tokens, core contracts stay in full while bulky docs use `0.7 * cosine + 0.3 * keyword` + neighbor pages. Then `citationVerifier.ts` normalizes (NFKC, un-hyphenation) and strips unverified quotes.
- **Key technical details:** Tenant pre-filtering (`WHERE dealId AND organizationId`), Node.js `cosineSimilarity()` in memory (honest note vs `pgvector:pg16` Docker image).
- **Speaking script:** *"Standard chunk-only RAG is risky for real estate contracts because a counter-offer can silently override an earlier clause. Our retrieval service uses a dual-mode approach: under 120,000 tokens, we inject the full deal packet; above that, we keep core contracts in full and run hybrid scoring—70% cosine similarity plus 30% keyword match—on bulky disclosures. Most importantly, `citationVerifier.ts` normalizes every quote and verifies it verbatim against the database chunk, dropping any hallucinated citation before the user ever sees it."*
- **Transition:** *"Now let's look at our second major AI system: the Autonomous Multi-Agent Sales OS."*
- **Likely judge questions:** *Why compute cosine similarity in Node.js instead of SQL pgvector?* Deal packets are already pre-filtered by `dealId` and `organizationId` (typically dozens to hundreds of chunks), making in-memory scoring fast and simple; migrating to SQL HNSW indexes is a clear future scaling step.

## Slide 14 — Agentic AI Architecture
- **What the slide communicates:** Details the custom TypeScript bounded multi-agent runtime (`orchestrator.ts`, `agentRuntime.ts`, `agentTools.ts`).
- **What to explain:** Clarify that we do NOT use LangChain/LangGraph—our custom TypeScript supervisor routes to 6 specialists (`QUALIFIER`, `MATCHER`, `CLOSER`, `DOCS_RAG`, `ESCALATION`, `SUPERVISOR`), executes a bounded loop (`MAX_AGENT_ROUNDS = 5`) across 13 tools with `TrustedAgentContext`, and verifies output via `verifyAgentOutput()`.
- **Key technical details:** Proposal-Pattern tools (`propose_buyer_requirements`, `propose_follow_up_task`, `propose_site_visit`), channel constraints (`<35 words` for `VOICE_CALL`).
- **Speaking script:** *"For our autonomous sales agent, we intentionally built a custom TypeScript runtime rather than a heavy framework like LangGraph. Every buyer turn enters `orchestrator.ts`, which checks for opt-out or human takeover first, then routes to one of six specialists—Qualifier, Matcher, Closer, Docs RAG, Escalation, or Supervisor. The runtime executes a bounded loop capped at 5 rounds across 13 Zod-validated tools, injects server-side `TrustedAgentContext` so the LLM can never spoof tenant IDs, and runs `verifyAgentOutput()` before sending."*
- **Transition:** *"Let's trace an end-to-end workflow across all these layers in a sequence diagram."*
- **Likely judge questions:** *Why custom TypeScript instead of LangGraph?* Zero framework overhead, strict compile-time Prisma/Zod types, deterministic 5-round bounds, and seamless integration with our Plivo WebSocket audio loop.

## Slide 15 — End-to-End Workflow
- **What the slide communicates:** Traces a complete 8-step sequence across 6 lifelines from inbound buyer message to lead conversion, PDF extraction, RAG Q&A, and hourly alerts.
- **What to explain:** Walk chronologically down steps 1–8, highlighting verification gates at every boundary (HMAC-SHA256, `HUMAN_TAKEOVER`, `verifyAgentOutput()`, `prisma.$transaction`, `citationVerifier()`, `EmailLog` dedup).
- **Key technical details:** `OutboxJob`, `Deal.leadId @unique`, `alert.service.ts`.
- **Speaking script:** *"Let's trace an end-to-end transaction. Step 1: A buyer messages on WhatsApp; Express verifies the HMAC signature over rawBody. Steps 2–4: Our bounded agent qualifies the buyer, runs SQL-filtered property search, books a site visit, and dispatches the reply via the Transactional Outbox. Step 5: Once won, the advisor converts the lead atomically into a Deal. Steps 6–8: The purchase PDF is parsed, `dateEngine` computes legal deadlines, `citationVerifier` grounds Q&A, and the hourly cron dispatches T-3d and T-1d alerts."*
- **Transition:** *"Now let's look at the Frontend Engineering and User Experience."*
- **Likely judge questions:** *What happens if a human advisor replies on WhatsApp from their phone?* Meta's webhook echoes the outbound message and our state machine automatically pauses AI (`HUMAN_TAKEOVER`).

## Slide 16 — Frontend & User Experience
- **What the slide communicates:** Displays live screenshots of `/login` and `/pricing` alongside 3 frontend architecture cards.
- **What to explain:** Highlight the React 18 + Vite 8 SPA, 24 lazy-loaded routes, locked Sidebar + `⌘K` Command Palette, `pdfjs-dist` canvas viewer, and `AdminRouteGuard`.
- **Key technical details:** `frontend/src/App.tsx`, `AuthContext`, `ProtectedLayout`, `pdfjs-dist 4.7.76`, `three`, `recharts`.
- **Speaking script:** *"On the frontend, we built a React 18 and Vite 8 single-page application with 24 code-split routes. As you can see in these live screenshots, the interface pairs a crisp editorial aesthetic with enterprise ergonomics: a locked navigation sidebar, a global Command-K palette, `pdfjs-dist` canvas rendering for inspecting contract citations, and self-serve onboarding with Razorpay and Stripe billing."*
- **Transition:** *"Every complex system involves architectural trade-offs. Let's review our key engineering decisions and challenges."*
- **Likely judge questions:** *How do you protect admin routes on the frontend?* `AdminRouteGuard` checks `user.isPlatformAdmin`, and the backend independently enforces `requirePlatformAdmin` middleware.

## Slide 17 — Challenges & Engineering Decisions
- **What the slide communicates:** Summarizes 4 verified Architecture Decision Records (ADR-001, ADR-003, ADR-006, ADR-004/008).
- **What to explain:** Frame each as Challenge -> Decision -> Trade-off: Row-level tenancy vs DB-per-tenant, Proposal Pattern vs direct LLM mutation, Dual-mode RAG vs chunk-only vector search, and Postgres Outbox + DST defense.
- **Key technical details:** `TaskProposal`, `LeadRequirementProposal`, `OutboxJob`, `parseLocalDateTimeToUtc()`.
- **Speaking script:** *"Every architectural choice here reflects a deliberate trade-off. We chose row-level tenancy over database-per-tenant to avoid migration sprawl, enforced by `requireOrgId()`. We chose the Proposal Pattern over direct LLM writes so AI can never corrupt CRM data. We chose Dual-Mode RAG over chunk-only search so addenda are never missed. And we built a Postgres Transactional Outbox instead of adding RabbitMQ, guaranteeing zero lost outbound messages."*
- **Transition:** *"To be fully transparent, let's also look at our current limitations and future roadmap."*
- **Likely judge questions:** *What was the hardest edge case?* Preventing destructive overwrites when a revised contract PDF is re-uploaded (`TaskProposal`) and rejecting nonexistent/ambiguous DST local times (`timezone.ts`).

## Slide 18 — Limitations & Future Scope
- **What the slide communicates:** Presents an honest, code-verified list of 4 current limitations alongside the corresponding scalability roadmap.
- **What to explain:** Be transparent: `rateLimit.ts` uses an in-memory `Map`, `retrieval.service.ts` runs `cosineSimilarity()` in Node.js memory, `@anthropic-ai/sdk` is in `package.json` but unused, and uploads default to local disk unless ImageKit is configured. Map each to Redis, SQL `pgvector` HNSW, multi-model failover, and e-sign/calendar sync.
- **Key technical details:** `rateLimit.ts`, `retrieval.service.ts`, `backend/package.json`, `storage.service.ts`.
- **Speaking script:** *"In the spirit of engineering transparency, here are our current limitations and how we plan to scale. Today, rate limiting uses an in-memory Map, and vector similarity runs in Node.js memory after tenant pre-filtering. Also, `@anthropic-ai/sdk` is in `package.json` but not yet wired up. Moving rate limits to Redis, enabling native `pgvector` HNSW SQL queries, and activating multi-provider LLM failover are our immediate next steps for multi-replica scale."*
- **Transition:** *"Let's wrap up with a concise summary of what Eigen Estate achieves."*
- **Likely judge questions:** *Is this deployed in production?* Deployment specs (`render.yaml`, `vercel.json`, `docker-compose.yml`) are configured and tested locally; multi-replica horizontal scaling requires the Redis and object-storage steps noted here.

## Slide 19 — Conclusion
- **What the slide communicates:** Summarizes the 3 core technical achievements and the unified value proposition.
- **What to explain:** Reiterate Deterministic Escrow, Bounded Agentic Sales, and Enterprise Security.
- **Key technical details:** Grounded in verified modules (`dateEngine`, `citationVerifier`, `agentRuntime`, `requireOrgId`).
- **Speaking script:** *"To summarize: Eigen Estate delivers three core engineering achievements. First, deterministic escrow surveillance with holiday-aware date math and verbatim citation verification. Second, a bounded 6-specialist omnichannel sales runtime with Proposal-Pattern safety. Third, verified multi-tenant security with instant session revocation and a transactional outbox. Together, they protect buyer deposits and accelerate brokerage conversion."*
- **Transition:** *"Thank you for your attention. I'd be happy to take your questions or walk through a live demo."*
- **Likely judge questions:** *What is your biggest differentiator?* Combining deterministic legal date math + verbatim PDF citation verification + atomic Lead-to-Deal conversion in one tenant-isolated platform.

## Slide 20 — Thank You / Q&A
- **What the slide communicates:** Closing slide with Eigen Estate branding, GitHub repository (`badal484/Real_Estate_Document`), and local demo endpoints.
- **What to explain:** Thank the judges and invite questions or a live walkthrough.
- **Speaking script:** *"Thank you, judges. That concludes our presentation on Eigen Estate. I'm ready for your questions—and if you'd like, we can jump straight into a live demo."*
- **Transition:** Proceed to Q&A (`PRESENTATION_QA.md`) or Live Demo (`PRESENTATION_DEMO_GUIDE.md`).
