# Eigen Estate — Live Demo Guide (Judge Walkthrough)

> **Purpose:** Step-by-step instructions to run and demonstrate Eigen Estate live during the Demo Day / Technical Evaluation without relying on mocked slides.

---

## 1. Pre-Demo Environment Checklist

Verify all three local services are up before stepping up to present:

1. **PostgreSQL 16 (`pgvector:pg16`):**
   ```bash
   docker compose up -d
   # Verify port 5432 is listening
   lsof -i :5432
   ```
2. **Backend API (`http://localhost:3001`):**
   ```bash
   cd backend
   npx prisma migrate status
   npm run dev
   ```
   Confirm health check:
   ```bash
   curl http://localhost:3001/health
   # Expected: {"status":"ok","timestamp":"..."}
   ```
3. **Frontend SPA (`http://localhost:3000`):**
   ```bash
   cd frontend
   npm run dev
   ```

---

## 2. Live Demo Flow (5–7 Minutes)

### Step 1: Public Product & Security Posture (1 min)
1. Open `http://localhost:3000/docs` in the browser.
   - **Point out:** The **4-Stage Autonomous Escrow Lifecycle** SOP (Ingestion & OCR -> Verifiable Line Citation Review -> Deterministic Countdown & Outbox Alerts -> Contingency Removal & Audit Seal).
2. Open `http://localhost:3000/security`.
   - **Point out:** Verifiable Page Citation Engine, Role-Based Access Control (`OWNER` / `AGENT`), and Deterministic 50-State Statutory Engine.
3. Open `http://localhost:3000/pricing`.
   - **Point out:** Transparent SaaS tiers and metered AI calling minutes billed via Razorpay / Stripe.

### Step 2: Authentication & Tenant Isolation Proof (1 min)
1. Open `http://localhost:3000/login` and sign in via **Google OAuth** (or show the invite-only workspace login).
2. In a terminal, demonstrate fail-closed API protection:
   ```bash
   curl -i http://localhost:3001/api/deals
   # Expected: HTTP 401 {"error":{"message":"Authentication required"}}
   ```

### Step 3: Pillar A — Contract PDF Upload, Clause Extraction & RAG Q&A (2 min)
1. Navigate to **Upload** (`/upload`) or **Deals** (`/deals`) inside the authenticated workspace.
2. Upload `frontend/public/sample-contract.pdf` (a real sample purchase agreement included in the repo).
3. **Explain what happens live:**
   - `pdf-parse` extracts the text layer locally.
   - Gemini (`@google/genai`) extracts structured `ContingencyClause` JSON (`responseJsonSchema` + Zod).
   - `dateEngine.service.ts` computes deterministic business/calendar due dates using `date-holidays`.
4. Open the **Deal Detail** & **Assistant** view:
   - Confirm an extracted deadline and show how `AuditLog` records the action.
   - Ask a question in the **Deal Assistant** (e.g., *"What is the inspection contingency period and which page states it?"*).
   - **Point out:** Clickable page citations verified server-side by `citationVerifier.ts`.

### Step 4: Pillar B — Omnichannel Leads, Property Matching & Bounded Agent (2 min)
1. Navigate to **Properties** (`/properties`) and **Leads** (`/leads`).
2. Open a lead's detail view (`LeadDetailPage`):
   - Show **Property Matches** filtered deterministically by SQL (`status = AVAILABLE`, `price <= maxBudget`, `bedrooms >= minBedrooms`).
   - Show **LeadRequirementProposal** (Proposal Pattern—AI suggests, human approves).
   - Show the **Conversation Thread** state machine (`AUTOPILOT` vs. `HUMAN_TAKEOVER`).
3. Press **`⌘K`** (`Cmd+K`) to open the global **Command Palette** and jump between Deals, Leads, Properties, and Analytics.

### Step 5: Automated Security & Architecture Verification (Optional Technical Proof, 1 min)
If a technical judge asks for proof of tenant isolation, concurrency, or date math:
```bash
cd backend
npx jest tests/dateEngine.service.test.ts tests/security/promptInjection.test.ts tests/security/webhookSecurity.test.ts
```
*(Ensure `backend/.env.test.local` points to a `_test` database before running full DB-backed security suites.)*

---

## 3. Fallback Plan (If Internet / Gemini API Key Is Unavailable)
- **Date Engine & Security Tests:** Run `dateEngine.service.test.ts` and `quoteMatcher.test.ts` offline—no external API keys required.
- **UI Walkthrough:** All public pages (`/`, `/docs`, `/security`, `/pricing`, `/login`) and cached workspace views render locally from Vite + PostgreSQL.
- **Code Walkthrough:** Keep `backend/src/services/citationVerifier.ts`, `backend/src/services/dateEngine.service.ts`, and `backend/src/services/agent/orchestrator.ts` open in your IDE to show exact implementation lines.
