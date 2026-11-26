# 12 — System Design & Architectural Trade-Offs

## 1. Monolithic vs. Microservices
- **Current Choice:** Modular Monolith (single Express process + PostgreSQL).
- **Why:** Allows ACID `prisma.$transaction()` across `Lead`, `ConversationMessage`, `OutboxJob`, `Organization`, and `OrganizationWallet` without distributed 2PC/Saga complexity, and keeps deployment lean.
- **When to Split:** Extract `alertCron`, `outboxDispatcher`, and `plivoStreamGateway` (WebSockets) into separate worker/media services once concurrency or memory pressure grows.

---

## 2. Key Distributed-System Patterns Implemented
1. **Transactional Outbox (`outboxDispatcher.ts`):** Guarantees at-least-once delivery without holding DB locks during external HTTP calls (WhatsApp/Email), using `OutboxJob.messageId` (`@unique`) for idempotency.
2. **Optimistic Concurrency / Conditional Updates (`acceptInvitation`):** `updateMany` with `acceptedAt: null` prevents race conditions when claiming single-use invite tokens.
3. **Fail-Closed Boundaries (`requireOrgId`, `assertSecurityConfig`):** Crashes or rejects immediately on missing tenant scope or weak secrets rather than failing open.
4. **Graceful Degradation (AI Fallbacks):** `ai.service.ts` cascades through `candidateModels`; `agentRuntime.ts` falls back to DB-grounded `generateConsultativeFallback()`; `embedding.service.ts` falls back cleanly.

---

## 3. Scaling Bottlenecks & How to Solve Them at 100x
1. **Auth DB Lookup:** `verifySessionToken()` queries `prisma.user` on every request → cache `{ organizationId, role, sessionVersion, isSuspended }` in Redis with short TTL, invalidated when `sessionVersion` increments.
2. **In-Memory Vector Loop:** `retrieval.service.ts` loads chunks into Node memory → move to native `pgvector` SQL `<=>` with HNSW index + `WHERE organization_id = $1`.
3. **In-Memory Rate Limiter:** `rateLimit.ts` uses a process-local `Map` → move to Redis sliding window.
4. **In-Process Cron & Outbox:** Move to BullMQ / Cloud Tasks so multiple API replicas don't duplicate cron evaluations.
