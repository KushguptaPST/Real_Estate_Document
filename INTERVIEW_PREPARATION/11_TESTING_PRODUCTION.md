# 11 — Testing & Production Engineering

## 1. Testing Suite (`backend/tests/` & `frontend/src/utils/quoteMatcher.test.ts`)
- **Framework:** Jest 30 + `ts-jest` + Supertest (ESM mode: `node --experimental-vm-modules`).
- **Database Safety Guard:** Tests require `TEST_DATABASE_URL` / `DATABASE_URL` ending in `_test` to prevent accidental wipes of dev/prod DBs.
- **Test Coverage Areas:**
  - `dateEngine.service.test.ts` — calendar/business day math, weekends, statutory holidays.
  - `assistant.test.ts` & `quoteMatcher.test.ts` — RAG grounding, citation verification, quote matching.
  - `agenticOmnichannel.test.ts` & `voiceAndWhatsApp.test.ts` — orchestrator routing, tools, channel formatting.
  - `concurrency.test.ts` — atomic invitation claims & outbox idempotency under race conditions.
  - `security/` — cross-tenant isolation (IDOR), JWT `sessionVersion` revocation, weak secret checks.

---

## 2. Deployment, Docker & Observability
- **Local Dev:** `docker-compose.yml` (`pgvector/pgvector:pg16` + optional `pgadmin` profile).
- **Cloud Hosting:** `render.yaml` (backend Node web service) + `vercel.json` (frontend Vite SPA with `/(.*) -> /index.html` rewrite).
- **Observability:** `utils/logger.ts`, `AuditLog` table, `AgentRunTrace` table, `ProviderCostEvent` table (`costTracker.service.ts`). (Note: LangSmith and Redis are NOT implemented.)

---

## 3. Production-Ready vs. Needs Improvement

| Area | Production-Ready | Needs Improvement / Gap |
|---|---|---|
| **Auth & Tenant Isolation** | `assertSecurityConfig()`, `scrypt`, `sessionVersion` revocation, `requireOrgId()` | `localStorage` JWT is XSS-sensitive compared to `HttpOnly` cookies |
| **Deployment Migrations** | Versioned SQL migrations in `prisma/migrations/` | `render.yaml` uses `prisma db push --accept-data-loss` instead of `prisma migrate deploy` |
| **Rate Limiting** | Fixed-window `rateLimit.ts` protects endpoints | In-memory `Map` is per-process; needs Redis for multi-instance scaling |
| **Vector Search** | Tenant-pre-filtered hybrid scoring | Runs `cosineSimilarity()` in Node.js memory instead of SQL `pgvector` HNSW |
| **Outbox & Cron** | Transactional `OutboxJob` + `EmailLog` deduplication | Runs in-process; should move to dedicated worker/queue at high volume |
