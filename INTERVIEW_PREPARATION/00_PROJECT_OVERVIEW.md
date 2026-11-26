# 00 — Project Overview (Eigen Estate / Contingency Deadline Copilot)

## 1. What Problem Does This Project Solve?
**Eigen Estate** is a multi-tenant B2B Real Estate Operating System that solves two high-cost operational failures in residential real estate brokerages:

1. **Escrow Contingency Forfeiture (Pillar A):**
   - Purchase agreements (15–45+ pages) contain strict statutory contingency deadlines (Inspection, Loan/Financing, Appraisal, Title Review, Earnest Money Deposit).
   - Missing a deadline by 24 hours can forfeit buyer deposits ($10,000–$50,000+) or trigger contract cancellation.
   - **Solution:** Upload contract PDFs → extract clauses with Gemini AI → deterministically compute legal due dates (skipping weekends and state statutory holidays) → answer deal questions with verbatim PDF citations → run an hourly alert daemon (`3d`, `1d`, `dayOf`, `missed`).

2. **Inbound Lead Leakage (Pillar B):**
   - Online buyer leads go cold within minutes if an advisor is unavailable.
   - **Solution:** Autonomous omnichannel AI Sales Agent across Web Chat Widget, Meta WhatsApp Cloud API, Telegram (with neural voice notes), and Plivo live voice calls—qualifying buyers, maintaining fact-provenance memory, matching verified inventory, and booking site visits.

---

## 2. Target Users & Use Cases
- **Brokerage Owners (`OWNER`):** Create organization workspaces, invite agents, manage API keys, billing/wallet, and monitor team-wide deals and leads.
- **Transaction Coordinators & Real Estate Agents (`AGENT`):** Upload contracts, confirm/override AI-extracted deadlines, ask grounded questions in the Deal Assistant, manage leads, and take over AI conversations when needed.
- **Platform Super-Admins (`isPlatformAdmin`):** Manage tenant suspensions, platform config, and cost/COGS observability via `/admin`.
- **Prospective Buyers (External End-Users):** Interact with the AI Sales Agent via Web Widget, WhatsApp, Telegram, or phone call.

---

## 3. Feature Reality Check (Code-Verified)

| Category | Status | Evidence in Codebase |
|---|---|---|
| **Escrow Deals, PDF Upload, Clause Extraction** | **Implemented** | `deals.ts`, `documents.ts`, `pdf.service.ts`, `ai.service.ts` |
| **Jurisdiction-Aware Business Day Date Engine** | **Implemented** | `dateEngine.service.ts` (`date-fns` + `date-holidays`) |
| **Hybrid RAG Deal Assistant + Citation Verification** | **Implemented** | `assistant.service.ts`, `retrieval.service.ts`, `citationVerifier.ts` |
| **Hourly Deadline Email Alerts** | **Implemented** | `alert.service.ts`, `email.service.ts`, `emailTemplates.ts` |
| **Multi-Tenant Auth (Google OAuth + scrypt + JWT `sv`)** | **Implemented** | `auth.service.ts`, `middleware/auth.ts`, `utils/tenant.ts` |
| **Autonomous Multi-Agent Sales OS (Custom TS)** | **Implemented** | `orchestrator.ts`, `agentRuntime.ts`, `agentTools.ts`, `buyerMemory.service.ts` |
| **Omnichannel (WhatsApp, Telegram, Web Widget, Plivo)** | **Implemented** | `whatsapp.service.ts`, `telegram.service.ts`, `publicWidget.ts`, `plivoStreamGateway.ts` |
| **Transactional Outbox (`OutboxJob`)** | **Implemented** | `outboxDispatcher.ts` |
| **Billing (Stripe + Razorpay + Metered Wallet)** | **Implemented** | `billing.service.ts`, `razorpay.service.ts`, `wallet.service.ts` |
| **Anthropic Claude (`@anthropic-ai/sdk`)** | **Imported, Unused** | Listed in `backend/package.json`; not imported in `backend/src/` |
| **LangChain / LangGraph** | **Not Implemented** | Custom TypeScript loop in `agentRuntime.ts` is used instead |
| **Redis / BullMQ** | **Not Implemented** | In-memory `Map` in `rateLimit.ts`; Postgres `OutboxJob` for queuing |
| **SQL-level `pgvector` HNSW Queries** | **Partial / Gap** | Docker uses `pgvector/pgvector:pg16`, but `retrieval.service.ts` computes `cosineSimilarity()` in Node.js memory |
| **SendGrid / Nodemailer / Resend** | **Implemented** | `email.service.ts` + webhook tracking in `messagingWebhooks.ts` |

---

## 4. Complete Technology Stack Table

| Layer | Technology | Version / Package | Actual Role |
|---|---|---|---|
| **Backend Runtime** | Node.js (ESM), TypeScript | Node 22+, TS `5.6.2` | API server, cron jobs, WebSocket gateway |
| **Web Framework** | Express | `4.19.2` | REST API, webhook endpoints, middleware |
| **ORM & Database** | Prisma + PostgreSQL 16 | `5.22.0` + `pgvector:pg16` | Relational storage, transactions, migrations |
| **AI / LLM** | Google Gemini (`@google/genai`) | `2.23.0` | Clause extraction, RAG Q&A, embeddings, agent tool-calling |
| **PDF Processing** | `pdf-parse` + `pdfjs-dist` | `1.1.1` / `4.7.76` | Server text extraction & client canvas rendering |
| **Date Math** | `date-fns` + `date-holidays` | `4.4.0` / `3.36.1` | Weekend & statutory holiday business-day math |
| **Validation** | Zod | `3.23.8` | Request, AI JSON output, and Agent Tool validation |
| **Auth & Security** | `jsonwebtoken`, `google-auth-library`, `helmet`, `node:crypto` | `9.0.3`, `11.1.0`, `8.0.0` | HS256 JWTs, Google ID token verification, `scrypt` |
| **Voice & Telephony** | Plivo + `ws` + `msedge-tts` | `ws 8.18.0`, `msedge-tts 2.0.9` | Live bidirectional audio stream & neural TTS voice notes |
| **Payments** | Stripe + Razorpay | `stripe 16.12.0` + REST | Subscriptions & INR wallet top-ups |
| **Storage** | Local disk / ImageKit | `imagekit 6.0.0` | Dev disk (`backend/uploads`) or private CDN URLs |
| **Frontend** | React 18, Vite 8, Tailwind, React Router 7 | `18.3.1`, `8.3.0`, `7.18.4` | SPA workspace, landing 3D/GSAP, PDF viewer |
| **Testing** | Jest + Supertest + `ts-jest` | `30.5.1`, `7.0.0` | Unit, concurrency, security, and E2E API tests |

---

## 5. High-Level Request Lifecycle

```
Browser / Webhook (WhatsApp, Telegram, Plivo, Stripe, Razorpay)
   │
   ▼
Express (backend/src/app.ts):
   helmet() → cors() → express.json(captures req.rawBody) → Router
   │
   ├── Public / Signed Webhooks: verify HMAC over req.rawBody → Service
   │
   └── Protected Routes: requireAuth (JWT + DB sessionVersion check) → requireRole()
         │
         ▼
       Service Layer (calls requireOrgId(organizationId) fail-closed)
         │
         ├── Prisma (PostgreSQL)
         ├── Gemini AI (@google/genai)
         └── Outbox / Email / Storage
```
