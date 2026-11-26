# 04 — Live Demo Script (Eigen Estate)

> **Golden Rule:** Demo the **strongest, fastest, and most reliable** implemented flows first (Contract Upload → AI Extraction → Date Engine → HITL Review → Grounded RAG Assistant with Citation Verification → Lead Pipeline & Agentic Chat). Keep telephony/live-call demos to pre-configured or simulated/recorded verification unless your Plivo + Deepgram + ElevenLabs keys are live and tested on that exact Wi-Fi.

---

## Pre-Demo Checklist (15 Minutes Before Presenting)

1. **Database & Servers Running:**
   - PostgreSQL Docker container up (`docker compose up -d`).
   - Backend running on `http://localhost:3001` (`npm run dev:backend`) with valid `DATABASE_URL`, `JWT_SECRET`, `GEMINI_API_KEY`, and `GOOGLE_CLIENT_ID`.
   - Frontend running on `http://localhost:3000` (`npm run dev:frontend`).
2. **Pre-Auth & Seed Data:**
   - Sign in ahead of time (or have an active session in your browser tab) so you don't waste 30 seconds on Google OAuth 2FA during the demo.
   - Have `frontend/public/sample-contract.pdf` (415 KB sample purchase agreement already in the repo!) ready on your Desktop for instant drag-and-drop.
   - Have at least 2–3 seeded properties (`/properties`) and 1 sample lead (`/leads`) ready.
3. **Browser Tabs Pre-Opened:**
   - Tab 1: `http://localhost:3000/deals` (Deals & Escrows dashboard)
   - Tab 2: `http://localhost:3000/leads` (Lead Pipeline)
   - Tab 3: Terminal running backend logs (optional, great for showing real-time `Gemini`, `Retrieval`, and `CitationVerifier` logs if judges ask).

---

## Step-by-Step Live Demo Sequence (3–4 Minutes)

### Step 1: Deals Dashboard & Navigation (`/deals`)
- **Open:** `http://localhost:3000/deals`
- **Action:** Point out the clean workspace layout (fixed sidebar, active escrows, status badges, and `⌘K` Command Palette).
- **What to Say:** *"Here is the Eigen Estate workspace. Every deal here is strictly scoped to this brokerage organization."*

### Step 2: Upload a Real Purchase Agreement (`/upload`)
- **Click:** **"New Deal / Upload"** (or press `⌘I` / navigate to `/upload`).
- **Input:**
  - Property Address: `742 Evergreen Terrace, Austin, TX 78701` (or your prepared address)
  - Acceptance Date: Pick a recent date (e.g., today or 2 days ago)
  - State Jurisdiction: `CA` or `TX`
  - File: Drag and drop `frontend/public/sample-contract.pdf`
- **Click:** **Upload & Analyze Contract**
- **Backend Processing (Narrate while it runs):**
  *"Right now, `documents.ts` is storing the PDF, logging `DOCUMENT_UPLOADED` in `AuditLog`, and running two Gemini pipelines in parallel: `extractClausesFromPdf()` with a strict JSON schema, and `extractTransactionTasksFromPdf()`. Then `dateEngine.service.ts` takes the extracted `numberOfDays` and `dayType` and computes exact expiration dates skipping weekends and state holidays."*
- **Expected Output:** Redirects to the Deal / Review view showing extracted contingency clauses (e.g., Inspection, Financing, Appraisal) with confidence scores, raw verbatim text, and computed deadlines in `PENDING` status.

### Step 3: Human-in-the-Loop (HITL) Deadline Review (`/deals/:id/review`)
- **Action:** Open the **Review** tab/page for the newly created deal.
- **Click:** Inspect one extracted deadline, optionally show the edit modal (`EditDeadlineModal`), and click **Confirm** on the deadlines.
- **What to Say:** *"Notice that AI-extracted dates start as `PENDING`. We never auto-arm legal alerts without human sign-off. Once the agent confirms a deadline, its status updates to `CONFIRMED`/`ACTIVE`, and our `node-cron` alert engine (`alert.service.ts`) will automatically dispatch 3-day, 1-day, day-of, and missed-deadline reminders."*

### Step 4: Grounded AI Knowledge Assistant & Citation Verification (`/deals/:id/assistant`)
- **Click:** Navigate to the **Assistant** tab (`/deals/:id/assistant`).
- **Input:** Type a specific contract question, such as:
  - *"What is the inspection contingency period and what happens if we miss it?"*
  - Follow-up (to test anti-hallucination): *"What does the contract say about cryptocurrency escrow?"* (or another topic not in the PDF).
- **Expected Output:**
  1. For the valid question: A grounded answer with inline footnotes (`[^1]`, `[^2]`). Click a citation chip to open the **Document Inspector** (`DocumentInspectorModal`), showing the exact page and quote.
  2. For the out-of-scope question: The assistant states clearly that the uploaded documents do not specify that topic (`found: false`, `citations: []`).
- **What to Say:** *"Before this answer reaches the browser, `retrieval.service.ts` checks the 120k-token budget, and `citationVerifier.ts` verifies every single quote verbatim against the stored `DocumentChunk` text. If the LLM ever invents a quote or page number, the server strips it out."*

### Step 5: Multi-Agent Lead Pipeline (`/leads` → `/leads/:id`)
- **Click:** Navigate to `/leads` and open a lead (`/leads/:id`).
- **Action:** Show the **Lead Detail** workspace: buyer requirements, matched properties (`PropertyMatch`), and the conversation thread. If configured, send a simulated inbound buyer message (e.g., *"Looking for a 3BHK under 2 Cr, can we visit this Saturday morning?"*) or show an existing agent trace.
- **What to Say:** *"On the top of the funnel, our `orchestrator.ts` routes this message to the `CLOSER` or `MATCHER` specialist. `agentRuntime.ts` runs a bounded 5-round tool loop—calling `search_properties` and `check_site_visit_availability`—and `humanChatPhysics.ts` formats the reply into natural micro-bubbles with a single follow-up question."*

### Step 6: Audit Trail (`/audit`) & Billing/Admin (`/billing`)
- **Click:** Briefly open `/audit` (or `/deals/:id` Activity History) to show immutable `AuditLog` entries (`DOCUMENT_UPLOADED`, `EXTRACTION_COMPLETED`, `DEADLINE_CONFIRMED`).
- **What to Say:** *"Every upload, extraction, confirmation, and AI action is recorded in `AuditLog` and `AgentRunTrace` for brokerage compliance."*

---

## Handling Unexpected Errors During the Live Demo

| Error Scenario | Immediate Recovery Action | What to Say to Judges |
| :--- | :--- | :--- |
| **Gemini API is slow or returns 429/500** | Point out the backend's automatic candidate-model fallback; if all fail, switch to an already-uploaded Deal in `/deals` to show Review, Assistant, and Audit. | *"Our extraction pipeline automatically cycles through candidate Gemini Flash models; while that retries, let me show you an already-indexed deal so we don't lose time."* |
| **Sample PDF upload fails** | Check file size/network tab; use an existing deal in `/deals` with pre-extracted clauses and chunks. | *"Let's open a pre-indexed deal in the workspace to walk through the Review and Citation Verifier."* |
| **Wi-Fi drops completely** | Switch immediately to `08_BACKUP_DEMO_PLAN.md` (local Docker Postgres + pre-recorded/cached data or local Jest test suite run). | *"Since the venue Wi-Fi dropped, let's switch to our offline local verification and pre-captured walkthrough."* |
