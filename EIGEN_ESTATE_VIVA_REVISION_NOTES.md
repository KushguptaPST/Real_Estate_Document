# Eigen Estate – Quick-Revision Viva Notes & Cheat Sheet

> **Purpose:** Last-minute high-yield revision for college viva, technical evaluations, and project defense.  
> **Target System:** Eigen Estate (Real Estate AI Sales & Escrow Contingency Copilot)

---

## 1. Golden 30-Second Elevator Pitch
> *"Eigen Estate is a B2B multi-tenant real estate operating system that bridges lead conversion and escrow contract surveillance. For sales, an Agentic AI Copilot engages buyers over Web, WhatsApp, and Telegram (with neural voice notes), matches active property inventory, and books showings without advisor calendar conflicts. For escrow, a legal document engine extracts contract contingencies using Google Gemini, calculates exact statutory deadlines skipping weekends and state holidays via a jurisdiction date engine, and dispatches automated alerts so buyer deposits ($10k–$50k+) are never forfeited."*

---

## 2. Core Architecture Cheat Sheet

| Component | Technology | File Path | Crucial Detail |
|---|---|---|---|
| **Backend Runtime** | Node.js + Express + TypeScript | `backend/src/app.ts` | Modular Monolith, ES Modules (`"type": "module"`). |
| **Database** | PostgreSQL 16 + Prisma ORM | `backend/prisma/schema.prisma` | 28 tables, `pgvector` enabled for contract embeddings. |
| **Frontend** | React 18 + Vite 8 + Tailwind | `frontend/src/App.tsx` | ProtectedLayout, permanent sidebar, command palette (⌘K). |
| **AI Frontier** | Google Gemini (`gemini-3.6-flash`) | `backend/src/services/ai.service.ts` | Structured JSON outputs validated with Zod schemas. |
| **Agentic Loop** | Custom ReAct Framework | `backend/src/services/agent/agentRuntime.ts` | Bounded to `MAX_AGENT_ROUNDS = 5`, 11 domain tools. |
| **Date Engine** | `date-holidays` + `date-fns` | `backend/src/services/dateEngine.service.ts` | Skips Saturdays, Sundays & official jurisdiction holidays. |
| **Citation Verifier** | Custom Regex / NFKC Normalizer | `backend/src/services/citationVerifier.ts` | Verbatim quote check, strips hallucinated citations. |
| **Voice Synthesis** | Microsoft Edge Neural TTS | `backend/src/services/telegram.service.ts` | `en-IN-NeerjaExpressiveNeural` generates natural voice notes. |
| **PDF Rendering** | `pdfjs-dist` | `frontend/src/components/pdf/PdfViewer.tsx` | Client-side canvas rendering with bounding box highlights. |

---

## 3. High-Yield Technical Concepts

### 1. Fail-Closed Multi-Tenancy (`requireOrgId`)
- **What it is:** Every query requires an `organizationId`. If it's missing, the backend throws an internal error immediately (`isOperational = false`) instead of accidentally querying across tenants.
- **File:** `backend/src/utils/tenant.ts`.

### 2. Instant Token Revocation via `sessionVersion`
- **What it is:** JWTs store `sv: sessionVersion`. If an agent is revoked or changes roles, `User.sessionVersion` is incremented in PostgreSQL. All previously issued tokens are rejected on their next request.
- **File:** `backend/src/services/auth.service.ts`.

### 3. Anti-ID Enumeration (404 instead of 403)
- **What it is:** When looking up an entity that does not exist or belongs to another brokerage, the API returns `404 Not Found`. Returning `403 Forbidden` would reveal to attackers that the resource ID exists.

### 4. Magic-Byte PDF Validation (`0x25 0x50 0x44 0x46`)
- **What it is:** Checking file extensions (`.pdf`) or MIME headers is unsafe because they can be spoofed. The backend reads the first 4 binary bytes from disk and asserts they equal `%PDF`.
- **File:** `backend/src/api/routes/inbound.ts`.

### 5. Prompt Injection Defense (`<UNTRUSTED_CONTENT>`)
- **What it is:** All user messages are wrapped in `<UNTRUSTED_CONTENT>` XML blocks in the prompt, instructing the model to treat the content purely as conversational data, never as system instructions.
- **File:** `backend/src/services/agent/agentRuntime.ts`.

### 6. Atomic Lead-to-Deal Conversion
- **What it is:** Executed in a single `prisma.$transaction`:
  1. Sets `Lead.status = 'WON'`.
  2. Creates `Deal` with status `'ACTIVE'`.
  3. Sets `Property.status = 'UNDER_CONTRACT'`.
  4. Creates default `NotificationSetting`.
- **Concurrency Guard:** `Deal.leadId` is `@unique`. Concurrent double-conversions trigger Prisma `P2002`, caught and returned as HTTP `409 Conflict`.
- **File:** `backend/src/services/leadConversion.service.ts`.

### 7. Fact-Provenance Buyer Memory
- **What it is:** Tracks where each customer requirement came from:
  - `AUTHORITATIVE_DB`: CRM record.
  - `BUYER_STATED`: Stated by customer.
  - `CONFIRMED_VISIT`: Learned during tour.
  - `INFERRED_UNCONFIRMED`: AI guess (requires human advisor approval).
- **File:** `backend/src/services/agent/buyerMemory.service.ts`.

### 8. Two-Stage Property Matching
- **Stage 1 (Hard Filters):** SQL query checks `status = 'AVAILABLE'`, `price <= maxBudget`, `bedrooms >= minBedrooms`.
- **Stage 2 (Soft Scoring):** Base `0.50`, +0.15 for budget savings $\ge 5\%$, +0.25 for preferred location, +0.10 for bedroom fit. Scores clamped between `0.0` and `1.0`.
- **File:** `backend/src/services/propertyMatch.service.ts`.

### 9. Jurisdiction Legal Date Math
- **Calendar Days:** Simple addition using `addDays(startDate, days)`.
- **Business Days:** Iterates day-by-day in a loop. Checks date against `date-holidays` for jurisdiction (e.g. California). Skips Saturdays, Sundays, and official statutory holidays.
- **File:** `backend/src/services/dateEngine.service.ts`.

### 10. Server-Side Citation Verifier
- **What it is:** Normalizes cited text (NFKC, straight quotes, un-hyphenating line wraps) and verifies that quotes appear verbatim in the extracted contract page text. Drops hallucinated citations and renumbers markdown footnotes (`[^1]`).
- **File:** `backend/src/services/citationVerifier.ts`.

---

## 4. Top 10 Quick-Fire Viva Questions & Answers

#### Q1: "Why Modular Monolith instead of Microservices?"
> *"To maintain strict ACID consistency during critical mutations like lead-to-deal conversion—which updates the lead, creates the deal, and locks property inventory atomically in a single database transaction without distributed sagas."*

#### Q2: "How do you stop cross-tenant data leaks?"
> *"Session JWTs encode `organizationId`. Every query is guarded by `requireOrgId()`, which fails closed if the ID is missing. Cross-tenant lookups return 404 to stop ID enumeration."*

#### Q3: "What if the LLM hallucinates a contract clause?"
> *"We use Gemini structured JSON schemas with Zod, and verify all citations on the server using `citationVerifier.ts`. If the quote cannot be matched verbatim against the document text, the citation is stripped."*

#### Q4: "How does the date engine skip holidays?"
> *"It loads state statutory holidays via `date-holidays` and advances day-by-day in a loop, skipping Saturdays, Sundays, and official holidays."*

#### Q5: "How do you handle concurrent lead conversions?"
> *"The schema enforces `@unique` on `Deal.leadId`. If two advisors click Convert simultaneously, the database halts the second write with error P2002, which we catch and return as HTTP 409 Conflict."*

#### Q6: "Why pgvector instead of Pinecone?"
> *"Colocating vectors with relational data in PostgreSQL eliminates dual-write synchronization bugs and allows relational SQL filtering by tenant ID before vector similarity scoring."*

#### Q7: "How do you prevent prompt injection?"
> *"We wrap untrusted customer messages in `<UNTRUSTED_CONTENT>` tags, constrain agent tools to domain actions only, cap the loop at 5 rounds, and provide an instant human takeover switch."*

#### Q8: "What happens if a contract PDF is a scanned image?"
> *"If `pdf-parse` extracts fewer than 30 characters on a page, the system flags it as scanned and triggers an OCR fallback using Gemini Vision (`gemini-2.5-flash`)."*

#### Q9: "How do you validate uploaded PDF files?"
> *"We verify the binary magic bytes `0x25 0x50 0x44 0x46` (`%PDF`) directly from disk rather than relying on spoofable MIME headers or file extensions."*

#### Q10: "How do you prevent duplicate alert emails?"
> *"Before dispatching an alert, the daemon queries `email_logs` for that specific deadline ID and alert window (3d, 1d, dayOf), skipping delivery if a log already exists."*

---

## 5. What to Say vs What NOT to Say

| DO SAY (Code-Backed Truth) | DO NOT SAY (Red Flags) |
|---|---|
| *"We used Google Gemini via the `@google/genai` SDK with structured outputs."* | *"We trained our own custom LLM from scratch."* |
| *"This is an intentional Modular Monolith for transactional integrity."* | *"This is a microservices architecture running on Kubernetes."* |
| *"WhatsApp and Telegram voice notes are fully functional via Microsoft Edge Neural TTS."* | *"The system places live phone calls dialing real cellular phones right now."* |
| *"We use PostgreSQL 16 with pgvector for relational vector pre-filtering."* | *"We use Pinecone, Milvus, and Redis clusters in production."* |

