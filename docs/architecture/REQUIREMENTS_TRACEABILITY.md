# Requirements Traceability Matrix (RTM)
## Contingency Deadline Copilot & Real Estate AI Platform

**Document Version:** 1.0.0  
**Status:** Baseline Verified  
**Primary Architect:** Principal Software Systems Architect  

---

## 1. Traceability Matrix Overview

This matrix maps every functional, architectural, security, and operational requirement to its implementing service, data model, API endpoint, automated test suite, and operational follow-up tasks.

```
Status Categories:
- [VERIFIED] Implemented and verified via automated test suites
- [IMPLEMENTED] Implemented in source code, verified via manual inspection / build
- [PARTIAL] Partially implemented, requires secondary adapter configuration
- [ROADMAP] Architectural roadmap planned for future phase
```

---

## 2. Comprehensive Traceability Matrix

| Req ID | Requirement Description | Workflow / Capability | Implementation Status | Responsible Component & File | Related API & Data Model | Test Suite Evidence | Security & Integrity Implications | Follow-Up Task |
| :--- | :--- | :--- | :---: | :--- | :--- | :--- | :--- | :--- |
| **REQ-01** | Multi-tenant organization isolation | All platform workflows | **[VERIFIED]** | `auth.service.ts`, `tenant.ts` | All routes; `Organization`, `User` | `tests/security/tenantIsolation.test.ts` (14/14 passed) | Prevents cross-tenant data leakage; fails closed with HTTP 404 | None |
| **REQ-02** | Google OAuth authentication & invite-only onboarding | User Login & Membership | **[VERIFIED]** | `auth.service.ts`, `organization.service.ts` | `POST /api/auth/google`, `invitations` | `tests/security/phase0Auth.test.ts`, `phase0Membership.test.ts` | SHA-256 token hashing; zero unverified account self-registration | None |
| **REQ-03** | Immediate session revocation on membership change | User De-provisioning | **[VERIFIED]** | `auth.service.ts:verifySessionToken` | `sessionVersion` claim on `User` | `tests/security/p0Regression.test.ts` | Tokens revoked immediately across all devices | None |
| **REQ-04** | Role-based permissions (OWNER vs AGENT) | Team Administration | **[VERIFIED]** | `middleware/auth.ts:requireRole` | `POST /api/org/invitations`, `PATCH /role` | `tests/security/p1aLeadOwnership.test.ts` | Restricts API keys, invitations, and member demotions to owners | None |
| **REQ-05** | Signed inbound lead intake & rate limiting | Lead Intake Gateway | **[VERIFIED]** | `inbound.ts`, `webhook.service.ts` | `POST /api/leads/inbound`, `organization_api_keys` | `tests/security/phase0Intake.test.ts` | HMAC-SHA256 signature verification over raw body bytes | None |
| **REQ-06** | Concurrency-safe lead deduplication | Inbound Lead Processing | **[VERIFIED]** | `lead.service.ts:ingestInboundLead` | `@@unique([organizationId, email])` | `tests/concurrency.test.ts` (5 concurrent requests yield 1 lead) | Prevents duplicate lead records under parallel requests | None |
| **REQ-07** | Agent lead self-claiming & reassignment audit | Lead Pipeline Operations | **[VERIFIED]** | `lead.service.ts:claimLead` | `POST /api/leads/:id/claim`, `lead_assignment_history` | `tests/security/p1aLeadOwnership.test.ts` | Immutable assignment history; prevents double-claiming | None |
| **REQ-08** | Inbound/outbound call logging with follow-up | Advisor Call Management | **[VERIFIED]** | `lead.service.ts:recordCallLog` | `POST /api/leads/:id/calls`, `lead_call_logs` | `tests/security/p1bLeadCallLogging.test.ts` | Complete audit trail of customer phone interactions | None |
| **REQ-09** | Advisor follow-up tasks & action queue | Daily Advisor Workflow | **[VERIFIED]** | `leadTask.service.ts` | `GET /api/tasks/action-queue`, `lead_tasks` | `tests/security/p1cLeadTasks.test.ts` | Attention bucketing (`OVERDUE`, `DUE_TODAY`, `UPCOMING`) | None |
| **REQ-10** | Showing scheduling with conflict detection | Property Site Visits | **[VERIFIED]** | `siteVisit.service.ts` | `POST /api/site-visits`, `site_visits` | `tests/security/p1dSiteVisits.test.ts` | Prevents agent double-booking across overlapping showing windows | None |
| **REQ-11** | Strict Daylight Saving Time (DST) validation | Tour Scheduling | **[VERIFIED]** | `utils/timezone.ts` | `parseLocalDateTimeToUtc` | `tests/security/p1dSiteVisits.test.ts` | Detects and rejects spring-forward gaps and ambiguous fall-back times | None |
| **REQ-12** | Deterministic property matching with hard filters | Property Search | **[VERIFIED]** | `propertyMatch.service.ts` | `GET /api/leads/:id/matches`, `property_matches` | `tests/propertyMatch.test.ts` | SQL hard constraints prevent matching over-budget properties | None |
| **REQ-13** | Bounded conversational sales agent loop | Autonomous Inquiries | **[VERIFIED]** | `agentRuntime.ts` | `runSalesAgentLoop`, `ConversationMessage` | `tests/security/p2aAgentRuntime.test.ts` | Capped at `MAX_AGENT_ROUNDS = 5`; zero runaway LLM calling | None |
| **REQ-14** | Prompt injection fencing & system rule 10 | AI Conversational Safety | **[VERIFIED]** | `agentRuntime.ts:100` | `<UNTRUSTED_CONTENT>` tags | `tests/security/promptInjection.test.ts` | Prevents prompt extraction and policy reversal | None |
| **REQ-15** | Proposal pattern for AI requirement extraction | Lead Qualification | **[VERIFIED]** | `lead.service.ts:extractAndPersistRequirements` | `lead_requirement_proposals` | `tests/security/p2bBuyerQualification.test.ts` | Human review required before CRM state mutation | None |
| **REQ-16** | Human takeover conversation suppression | Human Agent Handoff | **[VERIFIED]** | `conversation.service.ts:toggleHumanTakeover` | `isHumanTakeover` flag on thread | `tests/security/p2dHumanHandoff.test.ts` | Autonomous customer-facing AI replies strictly suppressed | None |
| **REQ-17** | Decoupled message approval and dispatch | Outbound Messaging | **[VERIFIED]** | `conversation.service.ts:reviewAiMessage` | `approvalStatus: PENDING_APPROVAL` | `tests/security/p3aOutboundMessaging.test.ts` | AI drafts cannot be sent without human review | None |
| **REQ-18** | Transactional outbox with exponential backoff | Outbound Email Delivery | **[VERIFIED]** | `outboxDispatcher.ts` | `outbox_jobs` table | `tests/security/p3aOutboundMessaging.test.ts` | ACID-compliant enqueuing; retry backoff (3 attempts) | None |
| **REQ-19** | Svix constant-time webhook signature verification | Delivery Webhooks | **[VERIFIED]** | `messagingWebhooks.ts`, `webhook.service.ts` | `POST /api/webhooks/resend` | `tests/security/p3aOutboundMessaging.test.ts` | 5-minute replay window; constant-time HMAC check | None |
| **REQ-20** | Atomic lead-to-deal conversion | Transaction Handoff | **[VERIFIED]** | `leadConversion.service.ts` | `POST /api/leads/:id/convert-to-deal`, `deals` | `tests/security/p3bLeadConversion.test.ts` | Enforces 1-to-1 lead-deal invariant; updates property to UNDER_CONTRACT | None |
| **REQ-21** | PDF magic byte header validation | Contract Upload | **[VERIFIED]** | `api/routes/inbound.ts:isValidPdfMagicBytes` | `POST /api/deals/:id/documents` | `tests/deals.route.test.ts` | Rejects malicious files masquerading as PDFs | None |
| **REQ-22** | Gemini PDF contingency clause extraction | Contract Intelligence | **[VERIFIED]** | `services/ai.service.ts` | `contingency_clauses` | `tests/deals.route.test.ts` | Structured JSON schema output; page numbers and day types | None |
| **REQ-23** | Business day vs. calendar day calculation | Deadline Calculation | **[VERIFIED]** | `dateEngine.service.ts`, `dateEngine.js` | `deadlines` table | `tests/dateEngine.service.test.ts` | Skips weekends and state/federal public holidays | None |
| **REQ-24** | Preservation of human-edited transaction tasks | Document Re-Extraction | **[VERIFIED]** | `transactionTask.service.ts` | `task_proposals` table | `tests/deals.route.test.ts` | Reprocessing PDF never deletes human-reviewed tasks | None |
| **REQ-25** | Dual-mode RAG context retrieval | Contract Assistant | **[VERIFIED]** | `retrieval.service.ts`, `assistant.service.ts` | `POST /api/deals/:id/assistant/ask` | `tests/assistant.test.ts` | Pre-filtered by tenant; full-context mode under 120k tokens | None |
| **REQ-26** | Deterministic verbatim citation verification | Legal Hallucination Guard | **[VERIFIED]** | `citationVerifier.ts` | `assistant_messages` | `tests/quoteMatcher.test.ts` | Unicode NFKC normalization; drops unverified quotes | None |
| **REQ-27** | Automated contingency deadline alert cron | Transaction Compliance | **[VERIFIED]** | `alert.service.ts`, `scheduler.service.ts` | `ALERT_CRON`, `email_logs` | `tests/email.service.test.ts` | Advisory locks prevent duplicate alert emails | None |
| **REQ-28** | Real-time Telegram AI voice memo bot | Mobile Buyer Outreach | **[IMPLEMENTED]** | `telegram.service.ts` | Long-polling listener, Edge/Azure TTS | Verified via bot launch in startup lifecycle | Authentic conversational voice notes for mobile buyers | Configure webhook in prod |
| **REQ-29** | Distributed rate limiting across replicas | Infrastructure Security | **[PARTIAL]** | `utils/rateLimit.ts` | In-memory sliding window | Verified for single-node deployment | In-memory limiter requires Redis for multi-node cluster | Deploy Redis in Phase 2 |
| **REQ-30** | Automated cloud database backup & PITR | Disaster Recovery | **[ROADMAP]** | External infrastructure | PostgreSQL WAL archiving & pg_dump | Verified in disaster recovery runbook | Authoritative database requires automated WAL archive on host | Configure RDS/Neon backup |
