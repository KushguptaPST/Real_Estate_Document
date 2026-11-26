# 01 — Project Presentation Overview: Eigen Estate

> **Use this document as your master briefing sheet before Demo Day.** Every fact below is verified directly against the repository codebase.

---

## 1. Project Identity

- **Project Name:** **Eigen Estate** (`eigenestate.com`, monorepo `eigen-estate-monorepo`; evolved from **Contingency Deadline Copilot**).
- **One-Line Pitch:** An **Autonomous Real Estate OS & Escrow Surveillance Platform** that qualifies inbound buyer leads across Voice, WhatsApp, Telegram, and Web Chat, and extracts binding contingency deadlines from purchase-agreement PDFs with citation-verified AI Q&A and deterministic legal date math.
- **Target Audience:**
  - Solo real-estate agents and channel partners.
  - Brokerage teams and Transaction Coordinators (TCs).
  - Property advisors managing high-volume inbound leads and active escrow timelines.

---

## 2. Problem Statement & Market Gap

Real estate brokerages lose revenue and face legal exposure at two critical bottlenecks:

1. **Slow, Unstructured Lead Response ("Speed-to-Lead" Gap):**
   - Buyer inquiries arrive fragmented across websites, WhatsApp, Telegram, portals, and phone calls.
   - Generic chatbots dump robotic paragraphs, hallucinate property prices or RERA/legal details, and fail to book site visits or hand off cleanly to human advisors.
2. **Manual Escrow & Contingency Tracking (Compliance & Liability Gap):**
   - Purchase agreements, counter-offers, and addenda are 20–50+ page PDFs containing interdependent contingency clauses (inspection, financing, appraisal, HOA, title review).
   - Calculating exact expiration dates requires distinguishing **calendar days vs. business days**, **state-specific statutory holidays**, and **addendum overrides** (where an addendum overrides the base purchase agreement).
   - Standard CRMs do not read contracts; generic AI chat tools hallucinate dates or quotes without page-level verification.

---

## 3. Proposed Solution

**Eigen Estate** unifies both halves of the real estate transaction lifecycle into one multi-tenant platform:

1. **Contract & Contingency Surveillance Engine:**
   - Uploads purchase-agreement PDFs, extracts text (`pdf-parse`) with Gemini Vision OCR fallback for scanned pages.
   - Uses Gemini structured JSON output (`responseJsonSchema` + Zod validation) to extract contingency clauses and transaction tasks in parallel.
   - Computes exact deadlines using a **deterministic Date Engine** (`date-fns` + `date-holidays`) that accounts for calendar vs. business days and state holidays—never relying on an LLM for date arithmetic.
   - Enforces **Human-in-the-Loop (HITL) Review** (`PENDING` → `CONFIRMED`/`ACTIVE`) and dispatches deduplicated email alerts (3-day, 1-day, day-of, missed) via `node-cron` + Resend/SendGrid/SMTP.
2. **Grounded Deal Knowledge Assistant (Hybrid RAG + Citation Verifier):**
   - Chunks documents along page and section boundaries (`chunkDocumentPages`) and generates Gemini embeddings (`gemini-embedding-001`).
   - Uses **Two-Mode Retrieval**: `full_context` when a deal fits within the 120,000-token budget, or `hybrid_retrieval` (core contracts in full + `0.7 * cosineSimilarity + 0.3 * keywordScore` + neighbor-page expansion for bulky disclosures).
   - Runs a **deterministic server-side Citation Verifier** (`verifyCitations`) that normalizes quotes, un-hyphenates line breaks, checks verbatim presence in source chunks and valid `deadlineId`s, and strips any hallucinated citations before returning the answer.
3. **Multi-Agent Omnichannel Sales & Voice AI:**
   - A Supervisor/Specialist Orchestrator (`orchestrator.ts`) routes buyer messages to 5 specialized personas (`QUALIFIER`, `MATCHER`, `CLOSER`, `DOCS_RAG`, `ESCALATION`).
   - Executes a bounded 5-round Gemini tool-calling loop (`MAX_AGENT_ROUNDS = 5`) across 13 typed, Zod-validated tools (`agentTools.ts`).
   - Enforces **Human Chat Physics** (micro-bubbles, single-question Tennis Volley rule, Night-Owl etiquette) and durable **Transactional Outbox** (`OutboxJob`) delivery.
   - Supports live bidirectional phone calls over **Plivo `<Stream>` WebSockets** (`/ws/plivo/:sessionId`) with 8kHz mu-law audio, barge-in cancellation, Deepgram/Gemini STT, and automatic TTS failover (`ElevenLabs Flash v2.5` → `Cartesia Sonic` → `Microsoft Edge Neural`).

---

## 4. Complete Technology Stack (Verified)

| Layer | Technologies Used |
| :--- | :--- |
| **Frontend** | React 18, TypeScript, Vite 8, Tailwind CSS, React Router v7, Framer Motion, GSAP, Three.js (`@react-three/fiber`, `@react-three/drei`), Recharts, `pdfjs-dist`, Lucide Icons |
| **Backend** | Node.js ≥ 22, Express 4, TypeScript 5.6, Zod, `ws` (WebSockets), `multer`, `node-cron`, `helmet`, `cors` |
| **Database & ORM** | PostgreSQL 16 (Docker), Prisma ORM 5.22 (40+ models, versioned migrations) |
| **AI & RAG** | `@google/genai` (Gemini Flash models with candidate fallback, `gemini-embedding-001`), custom `chunk.service.ts`, `retrieval.service.ts`, `citationVerifier.ts` |
| **PDF & Date Math** | `pdf-parse` + Gemini Vision OCR fallback, `date-fns`, `date-holidays` |
| **Voice & Messaging** | Plivo Voice (`<Stream>` WebSocket, `ffmpeg` 8kHz mulaw transcoding), Deepgram/Gemini STT, ElevenLabs Flash v2.5 / Cartesia Sonic / `msedge-tts`, Meta WhatsApp Cloud API, Telegram Bot API, Resend / SendGrid / Nodemailer |
| **Auth & Security** | Google OAuth (`google-auth-library`), JWT (`HS256`, `sessionVersion` revocation), SHA-256 hashed invites & API keys, HMAC webhook verification |
| **Billing** | Stripe (`stripe`) & Razorpay, plus internal `OrganizationWallet`, `WalletLedgerEntry`, and `ProviderCostEvent` COGS sub-ledger |
| **Testing & Deploy** | Jest 30 + Supertest (37 test files in `backend/tests/`), Vercel (frontend), Render (backend) |

---

## 5. Implemented vs. Planned Features (Honesty Matrix)

| Capability | Status | Notes from Codebase |
| :--- | :--- | :--- |
| **Multi-tenant Auth, RBAC, Invites, API Keys** | **Implemented** | `auth.service.ts`, `auth.ts` middleware, `Organization`, `Invitation`, `OrganizationApiKey` |
| **PDF Upload, Clause & Task Extraction** | **Implemented** | `documents.ts`, `ai.service.ts`, `transactionTask.service.ts`, `pdf.service.ts` |
| **Deterministic Date Engine & HITL Review** | **Implemented** | `dateEngine.service.ts`, `deadline.service.ts`, `ReviewPage.tsx` |
| **Automated Deadline Email Alerts (Cron)** | **Implemented** | `alert.service.ts` (`3d`, `1d`, `dayOf`, `missed`), `EmailLog` deduplication |
| **Hybrid RAG & Citation Verifier** | **Implemented** | `retrieval.service.ts`, `citationVerifier.ts`, `assistant.service.ts` |
| **Multi-Agent Orchestrator & 13 Tools** | **Implemented** | `orchestrator.ts`, `agentRuntime.ts`, `agentTools.ts` |
| **Plivo Bidirectional Voice Stream & TTS Failover** | **Implemented** | `plivoStreamGateway.ts` (requires Plivo/Deepgram/ElevenLabs keys at runtime) |
| **WhatsApp, Telegram, Web Widget & Outbox** | **Implemented** | `webhooks/whatsapp.ts`, `webhooks/telegram.ts`, `publicWidget.ts`, `outboxDispatcher.ts` |
| **Metered Wallet, COGS Ledger & Admin Panel** | **Implemented** | `wallet.service.ts`, `costTracker.service.ts`, `AdminPage.tsx` |
| **Native `pgvector` HNSW Index in DB** | **Planned / Upgrade** | Embeddings are currently stored as `Json?` on `DocumentChunk` and scored in-memory via `cosineSimilarity()` |
| **Distributed Redis Rate Limiter** | **Planned / Upgrade** | `rateLimit.ts` is currently in-memory per-process |
| **Anthropic Claude Multi-Provider Routing** | **Planned / Stub** | `@anthropic-ai/sdk` is in `package.json`, while active LLM calls use `@google/genai` |
