# 08 — Backup Demo Plan (Zero-Failure Contingency)

> **Treat your Demo Day like your own software:** never have a single point of failure. Prepare these 3 fallback tiers before you walk on stage.

---

## Tier 1: Gemini API / Internet Rate-Limit or Timeout
**Symptom:** Uploading `sample-contract.pdf` or asking a live Assistant question hangs or returns a 429/500 error.

**Action:**
1. Stay calm—do **not** keep clicking Retry.
2. Explain: *"Our extraction service automatically retries across candidate Gemini Flash models; while that completes, let's inspect a pre-indexed deal already stored in our local PostgreSQL database."*
3. Open a **pre-seeded Deal** in `/deals` (created and indexed during your pre-demo setup 15 minutes earlier):
   - Show the **Review Page** (`/deals/:id/review`) with extracted clauses, `rawText`, and computed dates.
   - Show the **Deal Detail / Timeline** (`/deals/:id`).
   - Show **Audit Trail** (`/audit`).
   - Open `/leads` and show a pre-existing Lead with `PropertyMatch` and `ConversationThread` history.

---

## Tier 2: Total Venue Wi-Fi Outage
**Symptom:** No internet access (Google OAuth, Gemini API, and external webhooks unreachable).

**Action:**
1. **Local Full-Stack Mode (Already Works Offline for Auth/DB):**
   - If you logged in before the Wi-Fi dropped, your JWT is already in browser storage and `http://localhost:3000` + `http://localhost:3001` + Docker PostgreSQL (`localhost:5432`) all run 100% locally!
   - Walk through all seeded UI pages: `/deals`, `/deals/:id`, `/deals/:id/review`, `/leads`, `/properties`, `/analytics`, `/billing`, `/audit`.
2. **Pre-Recorded 2-Minute Video Fallback:**
   - Before Demo Day, record a crisp 1080p MP4 screen capture of the complete live flow (Upload `sample-contract.pdf` → Extraction → Confirm Deadlines → Ask Assistant + Click Verified Citation → Lead AI Chat).
   - Keep that MP4 on your Desktop so you can play and narrate over it seamlessly if anything breaks.

---

## Tier 3: Live Verification via Automated Test Suite (For Technical Judges)
**Symptom:** Frontend or external API demo is blocked, and judges want proof that the backend engines actually work.

**Action:**
Open your terminal in `backend/` and run targeted deterministic tests that do not require live internet:
```bash
# Run Date Engine, Citation Verifier, Security, and Tenant Isolation tests
npm test -- tests/dateEngine.service.test.ts tests/quoteMatcher.test.ts tests/security/promptInjection.test.ts tests/security/tenantIsolation.test.ts
```
Narrate to the judges:
*"Even without live cloud LLM access, we can verify our deterministic Date Engine, quote-matching Citation Verifier, prompt-injection guards, and multi-tenant isolation directly through our Jest test suite."*

---

## Pre-Demo Backup Preparation Checklist
- [ ] Pre-seed 1 complete Deal with `sample-contract.pdf` already uploaded, extracted, and indexed in local Postgres.
- [ ] Pre-seed 2–3 Properties and 1 Lead with an active conversation thread.
- [ ] Stay logged in to `http://localhost:3000` in your demo browser profile.
- [ ] Record a 2-minute 1080p MP4 backup walkthrough saved on your Desktop.
- [ ] Verify `docker compose up -d` and `npm test` work locally before leaving for the venue.
