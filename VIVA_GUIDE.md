# Viva Defense & Comprehensive Project Explanation Guide
# Real Estate AI Sales Agent & Contingency Copilot

---

## 1. 30-Second Elevator Pitch
> *"My project is a **B2B Multi-Tenant Real Estate Platform** that unifies two mission-critical workflows for brokerage teams: **lead conversion** and **contract risk surveillance**. On the sales front, an **Agentic Sales Copilot** engages buyers across Web, Email, and Telegram (with neural voice notes), qualifies budgets into a provenance-tracked memory model, matches live property inventory, and books showings without calendar conflicts. On the transaction front, a **Legal Document Engine** ingests purchase contracts, extracts both binding contingency clauses and milestone obligations via Google Gemini, and calculates exact deadlines using a jurisdiction-aware date engine (skipping weekends and state holidays), dispatching automated alerts through a transactional outbox so earnest money deposits are never forfeited."*

---

## 2. 2-Minute Comprehensive Pitch (For "Tell Me About Your Project")

1. **The Industry Problems Solved:**
   - **The Lead Leakage Problem:** Real estate leads go cold within minutes. Brokerage advisors cannot respond 24/7, leading to a 50%+ drop in lead conversion.
   - **The Contract Risk Problem:** Residential purchase agreements (15–40 pages) contain strict legal deadlines (Inspection, Appraisal, Loan Financing, Earnest Money Deposits). Missing a deadline by a single day legally forfeits buyer escrow deposits ($10k–$50k+) or causes deal cancellations and costly E&O insurance claims.

2. **The Dual-Engine Solution:**
   - **Engine 1: Multi-Channel Sales Copilot:**
     - Ingests leads from web forms, portal webhooks, and live Telegram chats.
     - Runs an autonomous 5-round agent loop with 11 domain tools (searching catalog, checking showing availability, proposing buyer requirements).
     - Maintains a **Provenance-Tracked Buyer Memory** (`BUYER_STATED`, `CONFIRMED_VISIT`, `INFERRED_UNCONFIRMED`).
     - Performs two-stage property matching (hard SQL filters + soft compatibility scoring).
     - Schedules site visits with conflict prevention, buffer times, and no-show tracking.
     - Supports **Voice Notes & Audio**: Speech-to-text transcription + Microsoft Edge Neural TTS voice audio replies.
     - Supports instant **Human Takeover**: If the buyer asks for a person or the advisor types in the cockpit, the AI immediately yields control.
   - **Engine 2: Transaction & Contingency Surveillance:**
     - Validates uploaded PDFs against magic bytes (`%PDF`) to prevent file-tampering.
     - AI Document Classifier detects contract types (`PURCHASE_AGREEMENT`, `ADDENDUM`, `COUNTER_OFFER`, etc.) and effective dates.
     - Extracts both **Contingency Clauses** and **Transaction Milestone Tasks** (e.g., wiring earnest money within 3 business days).
     - **Jurisdiction-Aware Date Engine:** Differentiates calendar days from business days, automatically skipping weekends and official jurisdiction holidays (e.g., California or Karnataka).
     - **Hourly Alert Daemon & Transactional Outbox:** Monitors deadlines at T-3, T-1, and day-of expiration, sending emails via an idempotent outbox table with exponential backoff.
     - **Anti-Hallucination RAG Assistant:** Answers contract queries with dual-mode retrieval and a server-side **Citation Verifier** that ensures every quoted clause exists verbatim in the document.

3. **Core Architectural Highlights:**
   - **Atomic Lead-to-Deal Conversion:** Single `prisma.$transaction` converts a qualified lead into a deal, locks the property to `UNDER_CONTRACT`, and prevents race conditions via a schema `@unique` constraint.
   - **Court-Ready Audit Trail:** 37 distinct audit actions tracking all state mutations with immutable before/after diffs and PII masking.

---

## 3. High-Level Architecture (At a Glance)

```
[ Inbound Channels: Web Chat | Email Webhooks | Telegram Bot (Audio & Text) ]
                                    │
                                    ▼
[ Security Layer: Helmet, CORS, Rate Limiters, JWT Auth, Fail-Closed Tenant Scoping ]
                                    │
                                    ▼
┌──────────────────────────────────────────────────────────────────────────────────┐
│                             MODULAR EXPRESS BACKEND                              │
│                                                                                  │
│  [ SALES COPILOT ENGINE ]                     [ TRANSACTION & CONTINGENCY ENGINE ]│
│  • Agent Runtime (5-Round Bounded Loop)      • Magic-Byte PDF Validator          │
│  • 11 Tool Declarations (Inventory/Tours)    • Gemini Document Classifier        │
│  • Fact-Provenance Buyer Memory               • Dual Clause & Task Extractor      │
│  • Two-Stage Property Matcher (₹ / $)        • Jurisdiction Legal Date Engine    │
│  • Site Visit Scheduler (Conflict Check)     • Hourly Countdown Alert Daemon     │
│  • Telegram Bot (Whisper STT / Edge TTS)     • Anti-Hallucination Citation RAG   │
│  • Lead Action Queue & Advisor Tasks         • Transactional Outbox Worker       │
└──────────────────────────────────────────────────────────────────────────────────┘
                                    │
        ┌───────────────────────────┼───────────────────────────┐
        ▼                           ▼                           ▼
[ PostgreSQL 16 ]           [ Google Gemini ]           [ Resend / SendGrid ]
  • Multi-Tenant Tables       • Gemini 2.5 Flash / Pro    • Transactional Emails
  • pgvector (HNSW Indexes)   • Vision OCR Fallback       • Svix HMAC Signatures
  • Transactional Outbox      • Structured JSON Output    • Outbox Retry Queue
```

---

## 4. The 10 Standout Features (Everything We Built)

| # | Feature | What It Does | Deep Technical Implementation |
|---|:---|:---|:---|
| **1** | **Multi-Tenant Isolation** | Fences data between brokerages completely. | `requireOrgId()` utility fails closed on every query; JWT includes `organizationId`; instant token revocation via database `sessionVersion`; returns `404` instead of `403` to prevent ID enumeration. |
| **2** | **Legal Date Engine** | Computes contingency expiration dates accurately. | Handles `calendar` vs `business` days; skips weekends and official state/federal holidays using `date-holidays`; handles year-end rollovers and local timezone math. |
| **3** | **Anti-Hallucination RAG Assistant** | Answers contract questions with proof. | Dual-mode retrieval (full context for small contracts; `pgvector` hybrid cosine + keyword search for large files); server-side `citationVerifier.ts` normalizes quotes (NFKC, straight quotes) and strips hallucinated citations. |
| **4** | **Dual Contract Extraction** | Extracts both contingencies and non-contingency obligations. | Extracts `contingency_clauses` (loan, inspection, appraisal) AND `transaction_tasks` (earnest money deposit wiring deadlines, title commitments) with assigned roles and dollar amounts. |
| **5** | **Agentic Sales Loop with 11 Tools** | Conducts intelligent, natural sales conversations. | ReAct pattern bounded to `MAX_AGENT_ROUNDS = 5`; calls 11 tools (`search_properties`, `check_site_visit_availability`, `book_site_visit`, `propose_buyer_requirements`, etc.); wraps untrusted customer text in `<UNTRUSTED_CONTENT>`. |
| **6** | **Fact-Provenance Buyer Memory** | Remembers customer preferences across conversations. | Tracks origin for every fact via `FactProvenance` (`AUTHORITATIVE_DB`, `BUYER_STATED`, `CONFIRMED_VISIT`, `ADVISOR_COMMITMENT`, `INFERRED_UNCONFIRMED`); supports human-in-the-loop review of AI requirement proposals. |
| **7** | **Atomic Lead-to-Deal Conversion** | Converts qualified buyers into active contracts. | Runs inside `prisma.$transaction`: sets Lead to `WON`, creates `Deal`, locks Property to `UNDER_CONTRACT`; `@unique` index on `Deal.leadId` prevents double-conversion race conditions. |
| **8** | **Multimodal Telegram Integration** | Live messaging with voice notes. | Supports live Telegram chats; receives voice notes and transcribes them; synthesizes AI replies into natural speech using Microsoft Edge Neural TTS (`msedge-tts`). |
| **9** | **Site Visit Engine & Conflict Prevention** | Books property tours without double-booking. | Validates advisor availability against existing visits and buffer windows; tracks reschedule histories, visit outcomes, and customer no-shows. |
| **10** | **Transactional Outbox & Alert Daemon** | Guaranteed delivery of deadline countdowns. | In-transaction write to `outbox_jobs`; background polling worker claims jobs using optimistic locks (`lockedAt`, `lockedBy`); dispatches via Resend with exponential backoff (up to 3 retries). |

---

## 5. Top 12 Viva Questions & High-Scoring Answers

### Q1: "Why did you choose a Modular Monolith instead of Microservices?"
> **Answer:** *"Real estate transactions require strict ACID consistency. For instance, converting a lead into a deal requires atomically updating the lead status to WON, creating the deal, locking the property status to UNDER_CONTRACT, and recording audit logs. In microservices, this would require complex distributed sagas, 2-phase commits, and eventual consistency risks. A modular monolith gives us clean TypeScript domain boundaries while keeping all mutations atomic within single database transactions."*

### Q2: "What happens if the Gemini LLM hallucinates a contract clause or page citation?"
> **Answer:** *"We use a multi-tiered defense: First, during clause extraction, we enforce Gemini structured output with a strict JSON schema validated via Zod. Second, in our conversational contract assistant, we built a server-side **Citation Verifier** (`citationVerifier.ts`). It performs Unicode NFKC normalization, straight-quote normalization, and whitespace collapse on the candidate quote, checking if it appears verbatim in the raw document text. If the quote cannot be verified verbatim against the page chunk, the citation is stripped before returning the response to the user."*

### Q3: "How does the Legal Date Engine calculate business days versus calendar days?"
> **Answer:** *"Calendar days simply add standard days using `addDays`. For business days, the engine initializes a jurisdiction-aware calendar (e.g., US California or Indian Karnataka) using `date-holidays`. It advances day-by-day in a loop: if a candidate date falls on a Saturday, Sunday, or an official statutory jurisdiction holiday, the counter does not increment. It also handles month and year rollovers automatically."*

### Q4: "How do you enforce Multi-Tenancy and prevent data leaks between brokerages?"
> **Answer:** *"We implement multi-tenancy at three levels: First, session JWT tokens encode the user's `organizationId`. Second, every service query uses `requireOrgId()`, which fails closed—if an organization ID is missing, the query immediately throws an exception. Third, cross-tenant resource lookups return `404 Not Found` rather than `403 Forbidden` to prevent attacker ID enumeration. We also have a security test suite asserting 100% tenant isolation across 14 distinct API endpoints."*

### Q5: "How do you prevent race conditions when two agents try to convert the same lead?"
> **Answer:** *"We enforce a `@unique` constraint on `Deal.leadId` at the database schema level. The entire conversion mutation executes inside `prisma.$transaction`. If two advisors submit conversions simultaneously, the database unique index halts the second write, throwing Prisma error `P2002`. Our service intercepts this and responds with a clean HTTP `409 Conflict` ('Lead has already been converted to a deal')."*

### Q6: "Why did you use PostgreSQL with `pgvector` instead of Pinecone or Milvus?"
> **Answer:** *"Using `pgvector` colocates relational transaction data and vector embeddings in the same database engine. This prevents data drift, eliminates external dual-write synchronization bugs, and cuts hosting overhead. Crucially, it allows us to perform relational pre-filtering in SQL (`WHERE organization_id = :orgId AND deal_id = :dealId`) before running HNSW cosine distance calculations, guaranteeing high performance and zero cross-tenant vector leakage."*

### Q7: "What is the Transactional Outbox pattern and why is it used here?"
> **Answer:** *"If an email API like Resend or SendGrid is called directly inside an HTTP handler, a network glitch leaves the database and email out of sync. With the Outbox pattern, the notification is saved to the `outbox_jobs` table in the same atomic database transaction as the business event. A dedicated background worker continuously polls for pending jobs, claims them with optimistic locking (`lockedAt`, `lockedBy`), and dispatches them with exponential backoff (up to 3 retries). Duplicate webhooks are deduplicated via unique idempotency keys."*

### Q8: "How does your system prevent Prompt Injection and runaway agent costs?"
> **Answer:** *"First, we wrap all untrusted customer input inside `<UNTRUSTED_CONTENT>` tags within the system prompt so the LLM treats it strictly as data, not instruction. Second, the autonomous execution loop in `agentRuntime.ts` enforces a hard cap of `MAX_AGENT_ROUNDS = 5`. Third, any explicit request from a customer (e.g., 'I want to speak with a human') or an advisor typing in the cockpit triggers the `HUMAN_TAKEOVER` flag, instantly disabling the AI loop on that thread."*

### Q9: "How does the Property Matching algorithm work?"
> **Answer:** *"It runs in two stages: First, a mandatory SQL hard-filter eliminates unavailable properties, properties exceeding the buyer's maximum budget, or mismatched property types. Second, a soft-scoring algorithm evaluates location preferences, bedroom counts, and budget proximity to assign a match score between 0.0 and 1.0. Matches are saved to `property_matches` along with clear human-readable explanations and any failed criteria."*

### Q10: "What happens if an uploaded PDF is scanned and has no readable text layer?"
> **Answer:** *"In `pdf.service.ts`, we first attempt fast text extraction using `pdf-parse`. If a page contains fewer than 30 characters, the system flags it as a scanned image and automatically triggers an OCR fallback using Gemini Vision (`gemini-2.5-flash`), generating high-fidelity page text without needing bulky native dependencies like Tesseract."*

### Q11: "How do you secure file uploads against malicious files disguised as PDFs?"
> **Answer:** *"We do not rely on file extensions or HTTP `Content-Type` headers because they can be trivially spoofed. Instead, our upload middleware reads the file's first 4 magic bytes directly from disk. It strictly requires the binary signature `0x25 0x50 0x44 0x46` (ASCII `%PDF`). Any file lacking this magic byte sequence is rejected immediately with an HTTP 400 error."*

### Q12: "How does the Telegram bot handle voice notes?"
> **Answer:** *"When a customer sends a Telegram voice note (`.oga` audio), the bot downloads the audio buffer, routes it to Gemini audio processing for speech-to-text transcription, passes the transcript through our Agent Sales loop, and converts the resulting text response into a natural voice note using Microsoft Edge Neural TTS (`msedge-tts`), sending both text and audio back to the user."*

---

## 6. Complete Database Schema Overview (Key Tables)

| Domain | Table Name | Purpose |
|---|---|---|
| **Multi-Tenancy** | `organizations` | Root tenant boundary. |
| **Access Control** | `users` | Roles (`OWNER`, `AGENT`) with `sessionVersion` for instant JWT revocation. |
| **Security** | `invitations` & `organization_api_keys` | SHA-256 hashed one-time tokens and API keys. |
| **CRM Leads** | `leads` | Customer records (`NEW`, `CONTACTED`, `QUALIFIED`, `WON`, `LOST`). |
| **Memory** | `lead_requirements` & `proposals` | Provenance-tracked buyer preferences with approval workflow. |
| **Omnichannel** | `conversation_threads` & `messages` | Unified threads for Web Chat, Email, and Telegram. |
| **Inventory** | `properties` & `property_matches` | Listing catalog and deterministic match scores (0.0 to 1.0). |
| **Showings** | `site_visits` | Tour bookings with calendar conflict and no-show checks. |
| **Action Queue** | `lead_tasks` & `lead_call_logs` | Advisor tasks (Calls, Tours, Follow-ups) linked to call records. |
| **Contracts** | `deals` | Active escrow transactions (`leadId` has 1-to-1 unique constraint). |
| **Documents** | `documents` & `document_chunks` | Ingested contract PDFs and page chunks with `pgvector` embeddings. |
| **Contingencies** | `contingency_clauses` | Extracted legal contingency terms (days, day type, citations). |
| **Milestones** | `transaction_tasks` & `task_proposals` | Non-contingency obligations (earnest money deposits, title commitments). |
| **Deadlines** | `deadlines` | Calculated calendar/business expiration dates. |
| **Reliability** | `outbox_jobs` & `webhook_events` | Idempotent transactional message queue and deduplication. |
| **Compliance** | `audit_logs` | 37 discrete audit actions with before/after diffs and PII masking. |

---

## 7. Master Walkthrough Script (If Asked to "Give a Live Demo")

1. **Step 1 — Lead Intake & AI Conversation (Sales Engine):**
   - *"Watch: a lead arrives via Web or Telegram inquiry asking for a 3-bedroom property in Miami under $1.5M."*
   - *"The AI Sales Copilot autonomously queries our database using `search_properties`, matches available listings, updates the buyer's requirement memory, and suggests an available tour time."*
2. **Step 2 — Human Takeover & Showing Confirmation:**
   - *"As an advisor, I open the Lead Cockpit. I can see the conversation thread and buyer preferences. If I want to intervene, I flip 'Human Takeover' or reply directly, and the AI immediately pauses."*
   - *"I click 'Schedule Site Visit'—the system checks advisor availability, blocks the calendar slot, and creates an automated reminder task in my Action Queue."*
3. **Step 3 — 1-Click Atomic Deal Conversion:**
   - *"Once the buyer is ready, I click 'Convert to Deal'. In a single atomic database transaction, the lead status changes to WON, the deal is initialized, and the property status automatically flips to UNDER_CONTRACT."*
4. **Step 4 — PDF Contract Ingestion & Clause Extraction:**
   - *"Now in the Deal Cockpit, I upload a standard Purchase Agreement PDF. The system validates magic bytes, classifies the document, and runs Gemini extraction."*
   - *"In seconds, it extracts all financing, appraisal, and inspection contingencies, as well as the earnest money wiring task."*
5. **Step 5 — Jurisdiction Date Math & Countdown Surveillance:**
   - *"The Date Engine computes the exact expiration dates, skipping statutory holidays like Memorial Day or state holidays."*
   - *"The hourly Alert Daemon monitors the countdown and queues automated alerts at T-3, T-1, and Day-Of to safeguard the buyer's deposit."*
6. **Step 6 — Anti-Hallucination Verification:**
   - *"Finally, I can ask the AI Contract Assistant any question about the contract. It provides the exact answer and highlights the citation, verified verbatim against the document text."*
