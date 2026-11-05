# Project Resume Dossier & ATS Portfolio Guide
## Real Estate AI Sales Copilot & Multi-Tenant Contingency Contract Surveillance Platform

---

## 1. Project Overview & Elevator Pitches

* **Domain:** PropTech / LegalTech / B2B Enterprise SaaS
* **Core Value Proposition:** A high-availability B2B multi-tenant platform unifying an autonomous sales agent (Web, Email, Telegram with neural voice notes) with a legally compliant contract surveillance engine to eliminate escrow deposit forfeitures and lead drop-offs.
* **Key Numbers:** 427 automated tests (100% pass rate), 37 audit log actions, 11 agent domain tools, 5-round bounded ReAct loop, 0 cross-tenant data leaks across 14 security suites.

### 30-Second Interview Pitch
> *"I designed and built a B2B multi-tenant real estate platform that solves two critical bottlenecks for brokerages: lead drop-off and contract deadline risk. On the sales front, an autonomous agent engages buyer leads across Web and Telegram with voice notes, qualifies budgets into structured memory, and books showings without calendar conflicts. On the transaction front, a legal document engine ingests 30+ page purchase agreements, extracts binding contingency clauses using Google Gemini, calculates exact statutory expiration dates skipping weekends and jurisdiction holidays, and monitors countdowns through a transactional outbox so earnest money deposits ($10k–$50k+) are never forfeited."*

### 2-Minute Deep-Dive Pitch
> *"Residential real estate transactions are fraught with high stakes: a single missed inspection or loan deadline forfeits buyer deposits and triggers costly Errors & Omissions claims. Meanwhile, inbound buyer leads go cold within minutes if not contacted 24/7.
>
> To solve this, I architected a dual-engine platform in Express, TypeScript, React, and PostgreSQL:
> 1. **Autonomous Sales Copilot:** Implements a 5-round bounded ReAct loop with 11 custom domain tools. It maintains a Fact-Provenance Memory Model (`BUYER_STATED`, `CONFIRMED_VISIT`, `INFERRED`), performs two-stage property matching (hard SQL filters + soft scoring), books conflict-free showings, and supports Telegram voice notes via Whisper STT and Microsoft Edge Neural TTS. It features instant Human Takeover overrides whenever an advisor steps in.
> 2. **Legal Contingency Surveillance Engine:** Uploaded PDFs are validated against raw magic bytes (`%PDF`). Gemini extracts both contingency clauses and non-contingency milestone tasks. A custom statutory date engine computes exact expiration dates, skipping state and national holidays. Deadlines are monitored by an hourly countdown daemon dispatching alerts through an idempotent Transactional Outbox with exponential backoff.
> 3. **Enterprise Defense & Anti-Hallucination:** Includes a server-side Unicode NFKC Citation Verifier that ensures every quoted contract clause exists verbatim in the raw document before displaying citations to users, and enforces fail-closed multi-tenancy and atomic lead-to-deal conversion with zero race conditions."*

---

## 2. Copy-Paste Resume Bullet Points (Role-Specific)

### Option A: Full-Stack / Product Software Engineer Focus
* **Architected and delivered an enterprise B2B multi-tenant PropTech platform** unifying an autonomous AI sales agent with a legal contract surveillance engine, verified by **427 automated unit/integration tests across 33 suites (100% pass rate)**.
* **Engineered a reactive cockpit frontend** using **React 18, TypeScript, Vite, and Tailwind CSS**, featuring real-time transaction timelines, dual-mode document inspection, dynamic lead action queues, and interactive property matching.
* **Implemented a 5-round bounded ReAct sales agent** with 11 custom domain tools for catalog discovery, showing availability checks, and provenance-tracked buyer preference memory.
* **Built an anti-hallucination RAG contract assistant** using **Google Gemini and PostgreSQL `pgvector`** with a server-side Unicode NFKC citation verifier that validates contract clauses verbatim against raw document text.
* **Designed atomic lead-to-deal conversion** in PostgreSQL via **Prisma `$transaction`**, enforcing unique database constraints and optimistic locks to eliminate concurrent double-conversion race conditions.

---

### Option B: Backend / Systems / Cloud Engineer Focus
* **Architected an enterprise Express/TypeScript backend** with strict multi-tenant isolation, fail-closed organization scoping (`requireOrgId`), and instant JWT invalidation via database session versioning.
* **Engineered a resilient Transactional Outbox pattern** with optimistic concurrency locking (`lockedAt`, `lockedBy`) and bounded exponential backoff (3 retries) for automated countdown alert notifications (T-3, T-1, Day-Of).
* **Developed a jurisdiction-aware statutory date engine** using `date-holidays` to compute calendar vs. business day contingency expirations across state and federal holidays with leap-year and year-end rollovers.
* **Secured inbound and outbound webhooks** using constant-time **Svix HMAC-SHA256 signature verification** with 5-minute replay-attack tolerance and terminal delivery status protection.
* **Constructed a tamper-evident audit logging subsystem** recording 37 discrete mutation actions with automated PII masking (email/phone redacting) and immutable before/after JSON diffs.

---

### Option C: AI / Generative AI / LLM Engineer Focus
* **Developed an autonomous omnichannel sales agent** integrated with Web, Email, and **Telegram Bot** featuring multimodal audio capabilities (speech-to-text audio ingestion and natural voice synthesis via Microsoft Edge Neural TTS).
* **Designed a Fact-Provenance Memory Model** categorizing preferences (`BUYER_STATED`, `CONFIRMED_VISIT`, `ADVISOR_COMMITMENT`, `INFERRED`) with human-in-the-loop proposal workflows to prevent uncontrolled LLM state mutations.
* **Engineered prompt injection defense mechanisms** using system rule fencing and `<UNTRUSTED_CONTENT>` tag containment, coupled with instant human-takeover override triggers.
* **Implemented automated document ingestion & classification** with magic-byte (`%PDF`) validation, `pdf-parse` extraction, and Gemini Vision OCR fallback for scanned contracts lacking readable text layers.
* **Constructed hybrid semantic search & retrieval** over multi-page purchase agreements using `pgvector` HNSW cosine distance indexes with relational tenant pre-filtering to guarantee zero cross-tenant leakage.

---

## 3. Technical Stack & ATS Keyword Matrix

| Category | Technologies / Libraries |
| :--- | :--- |
| **Frontend** | React 18, TypeScript, Vite, Tailwind CSS, Framer Motion, Lucide Icons, Recharts, PDF.js, React Router v7 |
| **Backend & Runtime** | Node.js (≥ 22), Express.js, TypeScript, tsx, Node-Cron, Multer |
| **Database & ORM** | PostgreSQL 16, Prisma ORM (v5), `pgvector` (Vector Embeddings, HNSW indexes) |
| **AI & LLM Stack** | Google Gemini 2.5 (Flash / Pro, Gemini Vision OCR), Structured Output (JSON Schema + Zod), Prompt Engineering, ReAct Agent Loop |
| **Audio & Multimodal** | Speech-to-Text (STT), Microsoft Edge Neural TTS (`msedge-tts`), Telegram Bot API |
| **Communications & Delivery** | Resend, SendGrid, Twilio, Transactional Outbox Worker, Svix HMAC-SHA256 Signatures |
| **Security & Auth** | Google OAuth 2.0, JWT with DB Session Revocation, Helmet, CORS, Constant-time HMAC, PII Masking |
| **Date & Legal Math** | `date-holidays`, `date-fns`, Custom Jurisdiction Calendar Engine |
| **Testing & Quality** | Jest, Supertest, TS-Jest, Automated Security Regression Suites (427 tests, 33 suites) |
| **DevOps & Infrastructure** | Docker, Docker Compose, Git |

---

## 4. Key Metrics & Quantifiable Achievements

* **427 Automated Tests:** 33 test suites covering unit, integration, multi-tenant isolation, and adversarial race conditions with a **100% pass rate**.
* **Zero Cross-Tenant Leakage:** Validated tenant isolation across 14 distinct API endpoints and all vector similarity queries.
* **37 Discrete Audit Log Actions:** Full tamper-evident legal audit log with before/after state diffs and automated PII masking.
* **5-Round Bounded ReAct Execution:** Eliminates infinite execution loops and caps token expenditures.
* **11 Domain Agent Tools:** Custom tool ecosystem spanning listing searches, calendar availability checks, preference proposals, and task logging.
* **Sub-Second Statutory Date Calculation:** Computes calendar vs. business day expirations across federal and state holidays (e.g. California, Karnataka).

---

## 5. Top 5 System Design & Behavioral Interview Questions

### Q1: "Why did you choose a Modular Monolith instead of Microservices?"
> **Answer:** *"Real estate transactions require strict ACID consistency. Converting a lead into a deal requires atomically updating the lead status to WON, creating the deal, locking the property status to UNDER_CONTRACT, and recording audit logs in a single transaction. In microservices, this would require complex distributed sagas, 2-phase commits, and eventual consistency risks. A modular monolith gives us clean TypeScript domain boundaries while keeping all mutations atomic within single database transactions."*

### Q2: "How do you guarantee that the LLM doesn't hallucinate legal contract clauses?"
> **Answer:** *"We use a two-tiered defense: First, during clause extraction, we enforce Gemini structured output with a strict JSON schema validated via Zod. Second, in our conversational contract assistant, we built a server-side Citation Verifier (`citationVerifier.ts`). It performs Unicode NFKC normalization, straight-quote normalization, and whitespace collapse on the candidate quote, checking if it appears verbatim in the raw document text. If the quote cannot be verified verbatim against the page chunk, the citation is stripped before returning the response to the user."*

### Q3: "How do you prevent race conditions when two agents try to convert the same lead?"
> **Answer:** *"We enforce a `@unique` constraint on `Deal.leadId` at the database schema level. The entire conversion mutation executes inside `prisma.$transaction`. If two advisors submit conversions simultaneously, the database unique index halts the second write, throwing Prisma error `P2002`. Our service intercepts this and responds with a clean HTTP `409 Conflict` ('Lead has already been converted to a deal')."*

### Q4: "Why use PostgreSQL with `pgvector` instead of Pinecone or Milvus?"
> **Answer:** *"Using `pgvector` colocates relational transaction data and vector embeddings in the same database engine. This prevents data drift, eliminates external dual-write synchronization bugs, and cuts hosting overhead. Crucially, it allows us to perform relational pre-filtering in SQL (`WHERE organization_id = :orgId AND deal_id = :dealId`) before running HNSW cosine distance calculations, guaranteeing high performance and zero cross-tenant vector leakage."*

### Q5: "What is the Transactional Outbox pattern and why is it used here?"
> **Answer:** *"If an email API like Resend or SendGrid is called directly inside an HTTP handler, a network glitch leaves the database and email out of sync. With the Outbox pattern, the notification is saved to the `outbox_jobs` table in the same atomic database transaction as the business event. A dedicated background worker continuously polls for pending jobs, claims them with optimistic locking (`lockedAt`, `lockedBy`), and dispatches them with exponential backoff (up to 3 retries). Duplicate webhooks are deduplicated via unique idempotency keys."*
