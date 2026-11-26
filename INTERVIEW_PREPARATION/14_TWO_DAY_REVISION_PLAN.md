# 14 — Two-Day Interview Revision Plan

## Day 1: Core Backend, Auth, Database & Escrow RAG
- **Morning (3 hrs): Foundations (`00` → `03`)**
  - Read `00_PROJECT_OVERVIEW.md` & `01_ARCHITECTURE.md` (30m)
  - Trace `backend/src/index.ts` & `backend/src/app.ts` (`02_BACKEND_ENGINEERING.md`) (45m)
  - Master Auth, `scrypt`, `sessionVersion`, `acceptInvitation`, `requireOrgId` (`03_AUTHENTICATION_AUTHORIZATION.md`) (60m)
  - Review `schema.prisma` ER diagram & transactions (`04_DATABASE_ENGINEERING.md`) (45m)
- **Afternoon (3 hrs): LLM, RAG & Escrow (`05` → `06`)**
  - Trace PDF → `ai.service.ts` → `dateEngine.service.ts` → `alert.service.ts` (90m)
  - Trace `chunk.service.ts` → `retrieval.service.ts` (`full_context` vs `hybrid_retrieval`) → `assistant.service.ts` → `citationVerifier.ts` (90m)
- **Evening (1 hr):** Practice Q1–Q60 in `13_TOP_100_INTERVIEW_QUESTIONS.md`.

---

## Day 2: Agentic AI, Frontend, System Design & Mock Drill
- **Morning (3 hrs): Agentic AI & Omnichannel (`07` → `09`)**
  - Trace `orchestrator.ts` → `agentRuntime.ts` (`MAX_AGENT_ROUNDS=5`) → `agentTools.ts` (`TrustedAgentContext`) → `buyerMemory.service.ts` (90m)
  - Trace `outboxDispatcher.ts` & `plivoStreamGateway.ts` + both E2E flows in `09_END_TO_END_INTEGRATION.md` (90m)
- **Afternoon (3 hrs): Frontend, Testing & System Design (`10` → `12`)**
  - Review `App.tsx`, `AuthContext.tsx`, `api.ts`, `PdfViewer.tsx` + `quoteMatcher.ts` (60m)
  - Review `11_TESTING_PRODUCTION.md` & `12_SYSTEM_DESIGN.md` (honest gaps + 100x scaling answers) (60m)
  - Practice Q61–Q100 in `13_TOP_100_INTERVIEW_QUESTIONS.md` (60m)

---

## 30-Minute Rapid Revision Notes (Before Interview)
1. **No LangChain/LangGraph/Redis:** Custom TypeScript Supervisor (`orchestrator.ts`) + 5-round Gemini tool loop (`agentRuntime.ts`) + PostgreSQL `OutboxJob` + in-memory `rateLimit.ts`.
2. **Auth:** Google OAuth (`email_verified`) + `scryptSync` + `timingSafeEqual`. `HS256` JWT with `sv` (`sessionVersion`) checked in DB on every request for instant revocation.
3. **Tenant Isolation:** `requireOrgId()` fails closed; RAG pre-filters `{ dealId, organizationId }`; AI tools inject `TrustedAgentContext`.
4. **Escrow Accuracy:** Gemini extracts `numberOfDays` + `dayType`; `dateEngine.service.ts` computes statutory dates; `citationVerifier.ts` drops hallucinated quotes.
5. **Honest Gaps:** `render.yaml` uses `db push`; `@anthropic-ai/sdk` is unused; `pgvector` similarity runs in Node memory; `alert.service` needs a unique `(deadlineId, template)` constraint.

---

## Final 10-Question Mock Interview (Self-Test)
1. Why capture `req.rawBody` in `express.json()`?
2. How do you revoke a 7-day JWT immediately?
3. How does `acceptInvitation()` prevent race conditions?
4. Why not let Gemini calculate contingency due dates?
5. How does `retrieval.service.ts` prevent cross-tenant leakage and missed addenda?
6. How do you defend against prompt injection in uploaded PDFs?
7. How does `agentTools.ts` stop an LLM from querying another org's properties?
8. Why use the Transactional Outbox (`OutboxJob`) for WhatsApp/Email?
9. What happens on `401` in the React frontend?
10. What are the 3 biggest bottlenecks at 100x scale?
