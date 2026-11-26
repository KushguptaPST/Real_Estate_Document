# 02 — Complete Speaking Script (Eigen Estate)

> **Delivery Note:** Read this aloud twice before Demo Day to internalize the flow, then speak naturally from the key beats. Total target runtime: **10–12 minutes** (including a 2–3 minute live demo).

---

### 1. Opening and Introduction
"Good morning, everyone. I'm [Your Name], and today I'm presenting **Eigen Estate**—an Autonomous Real Estate OS and Escrow Surveillance Platform.

In real estate, deals rarely fail because of a lack of demand. They fail in two operational blind spots: **slow, uncoordinated lead response** at the top of the funnel, and **missed contingency deadlines** once a property goes under contract. Eigen Estate solves both in a single, multi-tenant platform."

### 2. Problem Statement
"Let's look at what a real estate brokerage or transaction coordinator deals with every day.
First, buyer inquiries come in from everywhere—website forms, WhatsApp, Telegram, and phone calls. If an agent takes hours to reply, or sends a generic wall of text, the buyer moves on.
Second, once a buyer and seller sign a purchase agreement, the real legal clock starts ticking. A typical contract package—with counter-offers and addenda—is 20 to 50 pages long, packed with deadlines for inspection, financing, appraisal, and title review."

### 3. Why This Problem Matters
"Missing a single contingency deadline isn't a minor clerical error—it can cost a buyer their earnest money deposit, trigger breach-of-contract disputes, or collapse the entire closing. Meanwhile, on the sales side, every unreturned call or ungrounded chatbot answer directly costs the brokerage commissions."

### 4. Existing Solutions and Their Limitations
"Today, teams stitch together disconnected tools: a basic CRM for leads, spreadsheets or calendar reminders for escrow dates, and generic AI chat tools to read PDFs.
Those existing tools have three major flaws:
1. Generic LLMs are terrible at **calendar vs. business-day legal math** and state holidays.
2. Generic AI chat tools **hallucinate quotes and page numbers** with no verification layer.
3. Standard chatbots don't respect **human conversational cadence** or **WhatsApp coexistence**—they talk over human advisors or invent property inventory."

### 5. Our Proposed Solution
"That's why we built **Eigen Estate**. It combines three tightly integrated engines:
1. A **Deterministic Escrow & Contingency Engine** that extracts clauses from PDFs using Gemini, computes exact legal dates with a deterministic Date Engine, and routes them through human-in-the-loop review before arming automated email alerts.
2. A **Grounded Deal Knowledge Assistant** using Hybrid RAG and a strict server-side **Citation Verifier** so every answer is backed by a verified, highlightable verbatim quote.
3. A **Multi-Agent Omnichannel Sales & Voice AI** that qualifies buyers across Voice, WhatsApp, Telegram, and Web Chat using verified brokerage inventory and books site visits."

### 6. Project Objectives
"Our core engineering objectives were:
- **Zero hallucinated dates or citations:** Separate LLM extraction from deterministic date arithmetic and server-side quote verification.
- **Strict multi-tenant isolation:** Every database query, RAG retrieval, and AI tool call is scoped to the authenticated organization.
- **Production-grade omnichannel reliability:** Support real-time voice streaming, transactional outbox messaging, and human advisor handoff."

### 7. Main Features and Functionality
"In our live codebase, we have implemented:
- **Deal & Document Pipeline:** PDF upload, text extraction with Gemini Vision OCR fallback, parallel extraction of contingency clauses and transaction tasks, and a Human-in-the-Loop Review page.
- **Automated Alert Scheduler:** A `node-cron` job dispatching 3-day, 1-day, day-of, and missed-deadline alerts with database-level deduplication.
- **Deal AI Assistant:** Two-mode RAG (full-context up to 120k tokens, or hybrid vector + keyword retrieval) with verified inline citations.
- **Multi-Agent Lead Pipeline:** Supervisor/Specialist orchestration across 5 AI personas and 13 typed tools, plus Plivo bidirectional WebSocket voice calling, WhatsApp/Telegram webhooks, and an embeddable web widget.
- **SaaS Operations:** Role-based access control, invite-only + self-serve onboarding, Stripe/Razorpay billing, a metered usage wallet, and a super-admin COGS dashboard."

### 8. Technology Stack & Why We Selected Each
"We chose a unified TypeScript stack end-to-end:
- **Frontend:** React 18, Vite, and Tailwind CSS for a fast, code-split workspace, paired with `pdfjs-dist` so users can inspect contracts and jump straight to cited pages.
- **Backend:** Node.js 22 and Express with TypeScript and Zod, giving us strict runtime schema validation for both API inputs and LLM tool arguments.
- **Database:** PostgreSQL 16 with Prisma ORM—managing over 40 relational models with versioned migrations and strong foreign-key tenant boundaries.
- **AI:** Google's `@google/genai` SDK using Gemini Flash models with automatic model fallback, plus `gemini-embedding-001` for semantic retrieval.
- **Voice & Messaging:** Plivo `<Stream>` WebSockets with `ffmpeg` 8kHz mu-law transcoding, Deepgram/Gemini STT, and a multi-engine TTS failover chain from ElevenLabs Flash v2.5 to Cartesia Sonic to Microsoft Edge Neural."

### 9. System Architecture
"At a high level, the React SPA communicates over HTTPS and JWT-authenticated REST endpoints with our Express API, while Plivo voice streams connect over a dedicated WebSocket gateway at `/ws/plivo/:sessionId`. All persistent state—deals, leads, chunks, outbox jobs, wallet ledgers, and agent traces—lives in PostgreSQL via Prisma."

### 10. Backend Architecture
"The backend follows a clean modular architecture:
- **Routes (`src/api/routes/`)** handle HTTP validation with Zod and delegate to domain services.
- **Middleware (`src/middleware/`)** enforces JWT auth, RBAC, Multer file upload limits, and centralized error handling.
- **Services (`src/services/`)** encapsulate business logic—like `dateEngine.service.ts`, `retrieval.service.ts`, `citationVerifier.ts`, `outboxDispatcher.ts`, and our `agent/` directory."

### 11. Database Design
"Our Prisma schema models the entire brokerage domain around `Organization` as the top-level tenant boundary.
- On the **Escrow side**: `Deal` → `Document` → `DocumentChunk` (storing page number, section title, token count, and embedding JSON) and `ContingencyClause` → `Deadline` → `EmailLog`.
- On the **Sales side**: `Lead` → `LeadRequirement`, `PropertyMatch`, `SiteVisit`, `ConversationThread` → `ConversationMessage` → `OutboxJob`.
- For **Observability & Billing**: `AgentRunTrace`, `AuditLog`, `OrganizationWallet`, `WalletLedgerEntry`, and `ProviderCostEvent`."

### 12. Authentication and Authorization
"Security starts at the identity layer. We use Google OAuth2 verified via `google-auth-library` and issue `HS256` JWTs with a 7-day TTL. Every user record has a `sessionVersion` integer—if an owner changes a member's role or removes them, bumping `sessionVersion` immediately invalidates all prior tokens. We also enforce RBAC (`OWNER`, `AGENT`, and `isPlatformAdmin`) and SHA-256 hashed server-to-server API keys."

### 13. AI and LLM Integration
"We use Gemini in two disciplined ways:
1. **Structured Extraction:** When a contract is uploaded, we pass either the local `pdf-parse` text layer (fast path) or base64 PDF binary (scanned fallback) with a strict `responseJsonSchema` and temperature `0`, then validate with Zod.
2. **Tool-Calling Agents:** Our sales agent never answers from memory—it uses Gemini function calling to query verified Postgres inventory, propose buyer requirements, and book site visits."

### 14. RAG Pipeline
"Let's zoom into our RAG pipeline in `retrieval.service.ts`.
First, **tenant pre-filtering**: we verify the `dealId` belongs to the caller's `organizationId` before touching any chunks.
Second, **adaptive context mode**: if the deal's chunks fit under 120,000 tokens, we inject the full contract context so nothing is missed across pages. If bulky disclosures push it over budget, we switch to **Hybrid Retrieval**: core contracts (`PURCHASE_AGREEMENT`, `COUNTER_OFFER`, `ADDENDUM`) stay in full, while bulky docs are scored using `0.7 * cosineSimilarity + 0.3 * keywordScore`, plus neighbor-page expansion (`page ± 1`).
Finally, our **Citation Verifier** normalizes whitespace and line-break hyphenations, confirms every quoted string actually exists on that page, and drops any unverified citation."

### 15. Agentic AI Architecture
"For inbound leads, `orchestrator.ts` acts as a Supervisor Router. It inspects the message for opt-out/DND signals, explicit human requests, scheduling intent, collateral requests, or legal/RERA questions, and dispatches the right specialist (`QUALIFIER`, `MATCHER`, `CLOSER`, `DOCS_RAG`, or `ESCALATION`).
`agentRuntime.ts` runs a bounded loop—capped at `MAX_AGENT_ROUNDS = 5`—across 13 Zod-validated tools. Afterward, `verifyAgentOutput` runs deterministic post-LLM guardrails, and `humanChatPhysics.ts` formats the reply into 2–3 natural micro-bubbles with strictly one question per turn."

### 16. Complete Workflow
"End-to-end, a brokerage can capture a lead via WhatsApp or Web Widget, let the AI qualify their budget and location, match verified properties, book a site visit, convert that lead into an active Deal, upload the signed Purchase Agreement PDF, review and confirm the extracted contingency deadlines, and rely on automated alerts and citation-backed Q&A all the way to closing."

### 17. Frontend and User Experience
"On the frontend, we built 24 lazy-loaded pages in React 18 with a clean, Stripe/Linear-inspired workspace layout, a `⌘K` Command Palette, `⌘I` quick-upload shortcut, and an integrated `pdfjs-dist` document inspector that highlights verified citations."

### 18. Security and Reliability
"Beyond tenant isolation and `sessionVersion` revocation, we verify HMAC signatures on inbound webhooks (WhatsApp, Telegram, Plivo, Resend/Svix, Razorpay, Stripe), wrap untrusted contract text in `<<DOC_DATA>>` delimiters to guard against prompt injection, use a transactional `OutboxJob` pattern for idempotent message delivery, and enforce graceful shutdown draining HTTP servers, cron jobs, and Prisma pools."

### 19. Live Demonstration
"Now let's switch to the live application and walk through the core workflows in real time..." *(Transition to `04_LIVE_DEMO_SCRIPT.md`)*

### 20. Challenges Faced and Solutions
"We ran into three key engineering challenges:
1. **LLM Date Math Errors:** LLMs frequently miscount business days and skip/include holidays inconsistently. *Solution:* LLMs only extract `numberOfDays` and `dayType`; `dateEngine.service.ts` computes the actual date deterministically.
2. **Hallucinated Citations & Line-Break Hyphenation:** PDF text often breaks words across lines (e.g., `inspec-\ntion`), causing naive string matching to fail. *Solution:* `normalizeTextForMatching()` in `citationVerifier.ts` normalizes Unicode, un-hyphenates line breaks, and checks an 80% sliding window for long quotes.
3. **Voice Latency & TTS Outages:** Single-provider TTS can stall a live phone call. *Solution:* Native 8kHz mu-law streaming with barge-in cancellation and automatic consecutive-failure failover across ElevenLabs, Cartesia, and Edge Neural."

### 21. Unique Selling Points and Differentiation
"What makes Eigen Estate stand out is **end-to-end deterministic grounding**: we don't wrap a raw LLM prompt in a UI. We pair Gemini with a deterministic legal Date Engine, a server-side Citation Verifier, a bounded 13-tool multi-agent runtime, and real-time telephony."

### 22. Limitations and Future Scope
"To be transparent about our current engineering boundaries and roadmap:
- Today, `DocumentChunk` embeddings are stored as JSON and scored in-memory; moving to native **pgvector HNSW indexes** in PostgreSQL will scale retrieval to tens of thousands of documents per org.
- Our rate limiter (`rateLimit.ts`) is currently in-memory per process; moving it to **Redis** is next for horizontal multi-instance scaling.
- We also have `@anthropic-ai/sdk` in our dependencies to support multi-provider LLM routing alongside Gemini."

### 23. Conclusion and Thank You
"To summarize: Eigen Estate turns messy, high-stakes real estate conversations and 50-page contracts into a reliable, verifiable, and automated operating system. Thank you for your time—I'd love to take your questions."
