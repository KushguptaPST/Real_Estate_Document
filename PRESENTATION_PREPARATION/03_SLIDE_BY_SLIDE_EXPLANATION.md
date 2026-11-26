# 03 — Slide-by-Slide Explanation & Coaching Guide

> **How to use this guide:** Each section maps 1-to-1 to the 23-part presentation sequence. Use it to build your slide deck and rehearse answers, terminology, and transitions.

---

### Slide 1: Title & Opening
- **On Slide:** Project name (**Eigen Estate**), tagline (*Autonomous Real Estate OS & Escrow Surveillance Platform*), presenter name, demo URL / QR (if applicable).
- **What to Say:** Introduce yourself and state the two-part value proposition clearly in under 30 seconds.
- **Key Terms (Simple Explanation):** *Escrow Surveillance* = automatically watching every legal deadline between signing a contract and closing the deal.
- **Do NOT Say:** "We built an AI chatbot for real estate" (undersells the deterministic engine and multi-agent architecture).
- **Likely Question:** *Is this for US real estate or Indian real estate?*
  - **Answer:** "The architecture supports both—the date engine uses `date-holidays` with state jurisdictions like `CA` by default, while our lead currency formatter, RERA knowledge prompts, and Razorpay integration also support Indian brokerages."
- **Transition:** *"Let's look at why brokerages need this in the first place."*

---

### Slide 2: Problem Statement
- **On Slide:** Two-column visual: Left = *Lead Chaos (WhatsApp, Web, Calls)*; Right = *Contract Chaos (50-page PDFs, Missed Deadlines)*.
- **What to Say:** Explain the daily reality of a solo agent or transaction coordinator juggling fragmented leads and complex PDFs.
- **Key Terms:** *Contingency Clause* = a condition in a purchase contract (like inspection or loan approval) that must be met by a specific deadline to protect the buyer's deposit.
- **Do NOT Say:** Fabricated statistics like "80% of deals fail" unless citing a verified external source. Stick to structural facts.
- **Likely Question:** *Who feels this pain more—solo agents or large brokerages?*
  - **Answer:** "Solo agents feel it through lost time and liability; brokerages feel it at scale across dozens of active deals and advisors."
- **Transition:** *"So why does missing one of these moments matter so much?"*

---

### Slide 3: Why This Problem Matters
- **On Slide:** Financial & legal stakes: *Lost Earnest Money Deposit*, *Breach of Contract*, *Cold Leads*.
- **What to Say:** Connect technical failures (slow replies, miscalculated dates) to real business consequences (lost deposits, legal disputes, lost commissions).
- **Key Terms:** *Earnest Money Deposit (EMD)* = good-faith money a buyer puts into escrow that can be forfeited if a contingency deadline is missed.
- **Do NOT Say:** "Our software guarantees zero lawsuits." Say "reduces human error and creates an auditable trail."
- **Likely Question:** *Isn't this already solved by DocuSign?*
  - **Answer:** "DocuSign handles e-signatures, not post-signature deadline tracking, business-day math, or clause-level Q&A."
- **Transition:** *"Let's examine how teams try to solve this today and where those tools break."*

---

### Slide 4: Existing Solutions & Limitations
- **On Slide:** Comparison table: *Generic CRMs*, *Spreadsheets/Calendars*, *Generic AI Chatbots* vs. *3 Gaps (No Legal Date Math, Hallucinated Quotes, No Omnichannel Grounding)*.
- **What to Say:** Highlight why stitching together a CRM + Google Calendar + ChatGPT fails in production.
- **Key Terms:** *Hallucination* = an AI model inventing a plausible-sounding but false date, clause, or property price.
- **Do NOT Say:** "Competitors are useless." Be objective about architectural gaps.
- **Likely Question:** *Couldn't someone just paste the PDF into ChatGPT?*
  - **Answer:** "ChatGPT has no multi-tenant database, no deterministic holiday calendar, no persistent audit log, and no server-side quote verification."
- **Transition:** *"That gap is exactly why we designed Eigen Estate."*

---

### Slide 5: Proposed Solution
- **On Slide:** Three-pillar diagram: *1. Deterministic Escrow Engine*, *2. Grounded RAG + Citation Verifier*, *3. Multi-Agent Omnichannel Sales & Voice AI*.
- **What to Say:** Explain how the three pillars work together from first buyer touchpoint to closing.
- **Key Terms:** *Human-in-the-Loop (HITL)* = AI proposes extracted dates/tasks, and a human agent confirms them before alerts go live.
- **Do NOT Say:** "100% autonomous with no human oversight." Emphasize HITL safety for legal deadlines.
- **Likely Question:** *Why combine lead qualification and escrow tracking in one app?*
  - **Answer:** "Because a qualified lead converts directly into a `Deal` (`leadConversion.service.ts`), preserving all buyer context into closing."
- **Transition:** *"Here are the core engineering objectives we set for ourselves."*

---

### Slide 6: Project Objectives
- **On Slide:** 4 bulleted objectives: *Zero-Hallucination Grounding*, *Deterministic Date Math*, *Strict Tenant Isolation*, *Omnichannel Reliability*.
- **What to Say:** Frame these as measurable architectural constraints, not vague wishes.
- **Key Terms:** *Multi-Tenancy* = multiple brokerages share the platform while their data remains strictly isolated by `organizationId`.
- **Do NOT Say:** "Infinite scalability." Focus on correctness, isolation, and reliability.
- **Likely Question:** *Which objective was hardest to achieve?*
  - **Answer:** "Preventing AI hallucinations in both RAG citations and outbound sales promises—which we solved with server-side verification."
- **Transition:** *"Let's look at the actual implemented features in our codebase."*

---

### Slide 7: Main Features & Functionality
- **On Slide:** Feature grid with `Implemented` badges: *PDF Clause & Task Extraction*, *Date Engine & HITL Review*, *Cron Alerts*, *Grounded Q&A*, *Multi-Agent Chat & Voice*, *Billing & Admin*.
- **What to Say:** Walk through the implemented modules concisely, distinguishing them from future upgrades.
- **Key Terms:** *Transactional Outbox* = saving outbound messages in a database queue (`OutboxJob`) before sending so retries are safe and idempotent.
- **Do NOT Say:** Do not claim `pgvector` HNSW or Redis rate limiting are live—keep them clearly in Future Scope.
- **Likely Question:** *Are all 24 frontend pages wired to real backend APIs?*
  - **Answer:** "Yes, all workspace routes in `App.tsx` communicate with Express routes backed by PostgreSQL via Prisma."
- **Transition:** *"Let's look at the technology stack powering these features."*

---

### Slide 8: Technology Stack & Rationale
- **On Slide:** Layered stack diagram: React 18 + Vite + Tailwind | Node 22 + Express + TS + Zod | PostgreSQL 16 + Prisma | Gemini (`@google/genai`) | Plivo + Deepgram + ElevenLabs.
- **What to Say:** Explain *why* each choice was made (e.g., TypeScript + Zod for end-to-end type safety; Prisma for versioned migrations; `date-holidays` for statutory calendars).
- **Key Terms:** *Zod* = runtime schema validation library ensuring API payloads and AI JSON outputs match strict types.
- **Do NOT Say:** "We used React because it's popular." Say "for component modularity, route-level lazy loading, and `pdfjs-dist` PDF rendering."
- **Likely Question:** *Why Gemini instead of OpenAI?*
  - **Answer:** "Gemini Flash gives us fast structured JSON output (`responseJsonSchema`), native multimodal PDF OCR fallback, and a 120k+ token window for full-contract context."
- **Transition:** *"Now let's see how these components connect in our system architecture."*

---

### Slide 9: System Architecture
- **On Slide:** High-level architecture diagram: Browser SPA + Public Widget + Webhooks (WhatsApp/Telegram/Plivo/Stripe/Razorpay) → Express API + WS Gateway → Services + AI/RAG → PostgreSQL + Storage.
- **What to Say:** Trace the two main traffic paths: synchronous REST APIs for the dashboard and asynchronous webhooks/WebSockets for live leads and voice.
- **Key Terms:** *Bidirectional WebSocket Stream* = an open persistent connection (`/ws/plivo/:sessionId`) carrying live 8kHz audio both ways.
- **Do NOT Say:** "Microservices." Be clear it's a modular TypeScript monorepo (`backend/` + `frontend/`).
- **Likely Question:** *Why a modular monolith instead of microservices?*
  - **Answer:** "Shared Prisma transactions (like Outbox + AuditLog), zero inter-service network latency, and simpler deployment on Render/Vercel."
- **Transition:** *"Let's zoom into the backend layer."*

---

### Slide 10: Backend Architecture
- **On Slide:** Folder/layer breakdown: `api/routes/` → `middleware/` → `services/` → `utils/prisma.ts`.
- **What to Say:** Explain separation of concerns: routes validate and authorize, services execute domain logic, and `index.ts` manages cron jobs and graceful shutdown.
- **Key Terms:** *Graceful Shutdown* = stopping cron jobs, draining active HTTP requests, and closing Prisma connections cleanly on `SIGTERM`/`SIGINT`.
- **Do NOT Say:** "Everything is in one controller." Point to the dedicated service modules.
- **Likely Question:** *How do you handle long-running or unreliable external APIs?*
  - **Answer:** "Candidate model fallback in `ai.service.ts`, TTS failover in `plivoStreamGateway.ts`, and exponential-backoff retries in `outboxDispatcher.ts`."
- **Transition:** *"All of that state is anchored in our database design."*

---

### Slide 11: Database Design
- **On Slide:** Simplified ERD showing `Organization` at the root, branching to `Deal`/`Document`/`DocumentChunk`/`Deadline` and `Lead`/`ConversationThread`/`OutboxJob`/`AgentRunTrace`.
- **What to Say:** Highlight the 40+ Prisma models and how `organizationId` is indexed across tenant tables.
- **Key Terms:** *Unique Deduplication Constraint* = e.g., `@@unique([deadlineId, template])` on `EmailLog` so the cron job can never email the same reminder twice.
- **Do NOT Say:** "We use NoSQL." It's strictly relational PostgreSQL 16.
- **Likely Question:** *How do you prevent duplicate leads from multiple channels?*
  - **Answer:** "`Lead` has composite unique constraints `@@unique([organizationId, email])` and `@@unique([organizationId, phone])`."
- **Transition:** *"Next, let's cover how we authenticate users and isolate tenants."*

---

### Slide 12: Authentication & Authorization
- **On Slide:** Auth flow: Google OAuth2 → `HS256` JWT (`sub`, `org`, `role`, `sv`) → `requireAuth` & `requireRole` middleware.
- **What to Say:** Explain Google OAuth verification, `sessionVersion` (`sv`) token revocation, invite-only + self-serve org creation, and SHA-256 hashed API keys.
- **Key Terms:** *Session Version (`sv`)* = an integer on `User` embedded in the JWT; incrementing it instantly invalidates stolen or old tokens without needing a token blacklist.
- **Do NOT Say:** "We store plaintext invite tokens or API keys." Both are SHA-256 hashed (`tokenHash`, `keyHash`).
- **Likely Question:** *What happens if an agent is removed from a brokerage?*
  - **Answer:** "Their `sessionVersion` is bumped, so their existing JWT immediately fails verification on the next API request."
- **Transition:** *"Now let's dive into the AI and LLM integration."*

---

### Slide 13: AI & LLM Integration
- **On Slide:** Dual AI pipeline: *1. Contract Extraction (`ai.service.ts`)* with `responseJsonSchema` + Zod; *2. Date Engine (`dateEngine.service.ts`)* deterministic calculation.
- **What to Say:** Emphasize the golden rule: **LLMs extract; deterministic code calculates.** Show how scanned PDFs fall back to Gemini multimodal vision.
- **Key Terms:** *Structured Output (`responseJsonSchema`)* = constraining the LLM to return valid JSON matching a strict schema at `temperature: 0`.
- **Do NOT Say:** "Gemini calculates the deadline dates." It only extracts `numberOfDays` and `dayType`.
- **Likely Question:** *What if the primary Gemini model hits a rate limit or fails?*
  - **Answer:** "`ai.service.ts` iterates through a deduplicated list of candidate Gemini Flash models automatically."
- **Transition:** *"Once a contract is indexed, how do agents query it safely? That's our RAG pipeline."*

---

### Slide 14: RAG Pipeline
- **On Slide:** 4-step pipeline: *Page-Aware Chunking* → *Tenant Pre-Filter* → *Two-Mode Retrieval (Full Context <=120k vs. Hybrid `0.7*vec + 0.3*kw`)* → *Citation Verifier*.
- **What to Say:** Explain why we don't blindly use top-K vector search for a 15-page contract—full context avoids missing cross-references, while hybrid retrieval handles 100-page HOA disclosures.
- **Key Terms:** *Citation Verifier* = server-side check (`citationVerifier.ts`) that normalizes quotes and drops any footnote `[^n]` not found verbatim in the retrieved chunks.
- **Do NOT Say:** "We use pgvector in production right now." State accurately that embeddings are stored as `Json?` and scored in-memory with `cosineSimilarity`.
- **Likely Question:** *How do you stop prompt injection hidden inside an uploaded PDF?*
  - **Answer:** "Document text is wrapped in `<<DOC_DATA>>...<</DOC_DATA>>` delimiters, and the system prompt explicitly treats it as untrusted data."
- **Transition:** *"Beyond static documents, let's look at our Agentic AI for live buyer conversations."*

---

### Slide 15: Agentic AI Architecture
- **On Slide:** Supervisor (`orchestrator.ts`) → 5 Specialists (`QUALIFIER`, `MATCHER`, `CLOSER`, `DOCS_RAG`, `ESCALATION`) → Bounded 5-Round Loop (`agentRuntime.ts`) → 13 Typed Tools (`agentTools.ts`) → Guardrails & `AgentRunTrace`.
- **What to Say:** Explain intent routing, why the loop is capped at 5 rounds, and how `verifyAgentOutput()` prevents unauthorized discounts or invented properties.
- **Key Terms:** *Bounded Execution Loop* = limiting the AI to at most `MAX_AGENT_ROUNDS = 5` tool-calling turns so it can never infinite-loop or blow up API costs.
- **Do NOT Say:** "The agent can do anything it wants." It can only call the 13 Zod-validated tools scoped to `organizationId`.
- **Likely Question:** *What happens if a buyer asks for a human or says 'STOP'?*
  - **Answer:** "`isOptOutOrDnd()` and `isExplicitHumanRequest()` intercept the turn immediately, route to `ESCALATION`, set `doNotCall`, or hand off to an advisor."
- **Transition:** *"Let's trace how all of these pieces connect in one complete end-to-end workflow."*

---

### Slide 16: Complete Workflow
- **On Slide:** Horizontal flow: *Lead Inbound (Web/WhatsApp/Voice)* → *AI Qualification & Property Match* → *Site Visit Booked* → *Lead Converted to Deal* → *PDF Uploaded* → *HITL Deadline Review* → *Cron Alerts & RAG Q&A*.
- **What to Say:** Walk through the lifecycle as a cohesive story—from first inquiry to closing table.
- **Key Terms:** *Lead-to-Deal Conversion* = `leadConversion.service.ts` promotes a qualified lead into a `Deal` record.
- **Do NOT Say:** Skip the human review step—highlight it as a deliberate safety gate.
- **Likely Question:** *Can a user skip the Lead pipeline and just upload a contract directly?*
  - **Answer:** "Yes! Users can create a Deal directly from `/upload` or `/deals` without going through the Lead CRM."
- **Transition:** *"Let's look at how we designed the frontend experience to make this complex workflow feel effortless."*

---

### Slide 17: Frontend & User Experience
- **On Slide:** Screenshot/overview of key UI surfaces: *Deals Dashboard*, *Review Page*, *Assistant + PDF Inspector*, *Lead Detail*, *Command Palette (`⌘K`)*.
- **What to Say:** Mention React 18 route-level lazy loading (`React.lazy`), keyboard shortcuts (`⌘K`, `⌘I`), and the `pdfjs-dist` citation-highlighting workflow.
- **Key Terms:** *Code-Splitting* = loading each page's JavaScript bundle only when the user navigates to it, keeping initial load fast.
- **Do NOT Say:** "We built custom UI components for everything from scratch without libraries" (we use Tailwind, Lucide, Recharts, Framer Motion, etc.).
- **Likely Question:** *How does the frontend show which part of the PDF a citation came from?*
  - **Answer:** "Each verified citation carries `documentId`, `pageNumber`, and verbatim `quote`, which `quoteMatcher.ts` and `DocumentInspectorModal.tsx` use to jump to and highlight the passage."
- **Transition:** *"Before we run the live demo, let's summarize our security and reliability posture."*

---

### Slide 18: Security & Reliability
- **On Slide:** 4-quadrant shield: *Tenant Isolation*, *Webhook HMAC Verification*, *Prompt Injection & Guardrails*, *Outbox & Failover*.
- **What to Say:** Reassure technical judges that security isn't an afterthought—point to our 37 Jest test files including `tenantIsolationAdversarial.test.ts`, `promptInjection.test.ts`, and `webhookSecurity.test.ts`.
- **Key Terms:** *HMAC Signature Verification* = verifying cryptographic signatures over `rawBody` bytes before processing any WhatsApp, Plivo, Resend, or payment webhook.
- **Do NOT Say:** "It's unhackable." Say "We enforce defense-in-depth and test adversarial tenant isolation in CI."
- **Likely Question:** *What if the server crashes while sending an email or WhatsApp message?*
  - **Answer:** "The `OutboxJob` record remains in PostgreSQL with retry tracking and idempotency keys, so it won't be lost or duplicated."
- **Transition:** *"Now, let's see Eigen Estate in action with a live demonstration."*

---

### Slide 19: Live Demonstration
- **On Slide:** Minimal placeholder slide: *"Live Demo: Eigen Estate Workspace"*.
- **What to Say:** Follow `04_LIVE_DEMO_SCRIPT.md` step by step. Narrate what the backend is doing while each action runs.
- **Transition:** *"That wraps up the live demo. Now let's look at the toughest engineering challenges we solved."*

---

### Slide 20: Challenges Faced & Solutions
- **On Slide:** 3-row table (*Challenge* → *Root Cause* → *Implemented Solution*): 1. Business-day/holiday math; 2. PDF line-break hyphenation in citations; 3. Voice TTS latency & outages.
- **What to Say:** Be specific and technical—judges love hearing about real bugs you diagnosed and fixed.
- **Key Terms:** *Barge-In Cancellation* = aborting active TTS audio playback the moment the caller starts speaking over the AI.
- **Do NOT Say:** "Everything worked on the first try."
- **Likely Question:** *How did you test concurrency and race conditions?*
  - **Answer:** "We have dedicated Jest tests like `concurrency.test.ts` and `p0Regression.test.ts` testing parallel requests and idempotency."
- **Transition:** *"So what truly differentiates Eigen Estate from other projects?"*

---

### Slide 21: Unique Selling Points & Differentiation
- **On Slide:** 4 USPs: *1. Deterministic Legal Date Engine*, *2. Server-Side Citation Verifier*, *3. Bounded Multi-Agent + Human Chat Physics*, *4. Real-Time Voice + COGS Sub-Ledger*.
- **What to Say:** Emphasize that Eigen Estate is engineered for production correctness, not just a hackathon prompt wrapper.
- **Do NOT Say:** "No one else is using AI in real estate." Focus on *how* we engineer trust and determinism.
- **Transition:** *"Every strong engineering project also knows its current limits—let's cover those."*

---

### Slide 22: Limitations & Future Scope
- **On Slide:** Two columns: *Current Boundaries* (In-memory JSON embeddings, single-instance in-memory rate limiter, Gemini primary) → *Next Roadmap* (`pgvector` HNSW index, Redis rate limiting & queues, multi-provider Claude routing).
- **What to Say:** Be candid and confident—owning your architectural trade-offs builds huge credibility with senior engineers.
- **Do NOT Say:** "There are no limitations."
- **Likely Question:** *When would you need to migrate embeddings to pgvector?*
  - **Answer:** "Once an organization's knowledge base grows beyond a few thousand chunks per query, moving from in-memory cosine similarity to a `pgvector` HNSW index keeps latency under 20ms."
- **Transition:** *"To wrap up..."*

---

### Slide 23: Conclusion & Thank You
- **On Slide:** Summary tagline + Tech Stack badges + Contact / GitHub link (`badal484/Real_Estate_Document`).
- **What to Say:** Restate the core impact in one sentence and invite questions.
- **Transition:** *"Thank you! I'm happy to answer any questions."*
