# Production Hardening & Security Audit Report

**System Name:** Contingency Deadline Copilot & B2B Real Estate AI Platform  
**Audit Date:** October 7, 2026  
**Auditor:** Independent Production Readiness Audit Agent  
**Overall Status:** **NOT PRODUCTION READY** (Critical vulnerabilities present in tenant isolation, authentication, data integrity, and webhook security)

---

## Executive Summary & Architecture Overview

The system is a multi-tenant B2B Real Estate SaaS platform built using:
- **Backend:** Node.js, Express, TypeScript, Prisma ORM, PostgreSQL.
- **Frontend:** React, Vite, TypeScript, TailwindCSS / Lucide.
- **AI Stack:** Google Gemini (`@google/genai`), Anthropic Claude, custom PDF text/OCR extraction pipeline, page-level RAG chunking & vector embeddings.
- **Messaging & Channels:** Email (Resend / Nodemailer), Twilio SMS/WhatsApp (adapter ready), Web Chat.

While rich in AI features (AI Lead Management, AI Conversation Assistant, AI Property Matching, AI Transaction Assistant, AI Knowledge Assistant RAG), the codebase was originally implemented as an MVP with fundamental multi-tenant security and correctness flaws.

---

## Audit Breakdown & Severity Matrix

| Category | Finding Summary | Severity | Status |
| :--- | :--- | :--- | :--- |
| **Multi-Tenancy** | Request handlers do not scope database queries by authenticated user's `organizationId`. `User`, `Lead`, `Property`, `Deal`, `KBDocument` allow nullable `organizationId`. | **CRITICAL** | Pending Fix |
| **RAG Tenant Isolation** | Vector search and document chunk queries search across all organizations or lack strict `organizationId` pre-filtering. | **CRITICAL** | Pending Fix |
| **Inbound Webhook Security** | `POST /api/leads/inbound` is unauthenticated, lacks signature verification (`WEBHOOK_SECRET`), rate limiting, timing-safe checks, and idempotency. | **CRITICAL** | Pending Fix |
| **Lead Concurrency & Deduplication** | Lead ingestion relies on non-atomic `findFirst` + `create`, allowing duplicate lead records under concurrent requests. No DB unique constraints on email/phone per tenant. | **CRITICAL** | Pending Fix |
| **AI State Mutation & Human Safety** | LLM outputs directly mutate authoritative `LeadRequirement` without a proposal/validation step. AI response generation lacks formal state machine and draft approval control. | **HIGH** | Pending Fix |
| **Transaction Task Reprocessing** | Transaction task extraction re-creates tasks on PDF re-upload without preserving human-reviewed/edited state. | **HIGH** | Pending Fix |
| **Property Matching** | Hard requirement filters (budget, bedrooms, property type) must be strictly enforced before scoring/LLM explanation. | **HIGH** | Pending Fix |
| **Database Migrations** | Package scripts use `prisma db push` instead of versioned `prisma migrate deploy`. | **HIGH** | Pending Fix |
| **API Route Authorization** | Routes in `deals.ts`, `documents.ts`, `tasks.ts`, `assistant.ts`, `knowledge.ts`, `notifications.ts`, `deadlines.ts` lack `requireAuth` or tenant checks. | **CRITICAL** | Pending Fix |
| **Observability & Error Handling** | API errors expose internal details in development; structured logging lacks uniform request correlation IDs. | **MEDIUM** | Pending Fix |

---

## Detailed Audit Findings

### 1. Multi-Tenant Authorization & Tenant Isolation (CRITICAL)
- **Vulnerability:** Unauthenticated or authenticated users from Organization A can supply any entity ID (`leadId`, `dealId`, `propertyId`, `documentId`) and read/modify/delete resources belonging to Organization B.
- **Root Cause:**
  1. `SessionUser` JWT payload lacks `organizationId`.
  2. Prisma models (`User`, `Lead`, `Property`, `Deal`, `KBDocument`) have nullable `organizationId String?`.
  3. Related models (`ConversationThread`, `ConversationMessage`, `PropertyMatch`, `TransactionTask`, `Document`, `DocumentChunk`, `AssistantConversation`, `AssistantMessage`, `NotificationSetting`, `EmailLog`, `ContingencyClause`, `Deadline`, `AuditLog`) lack direct `organizationId` attributes.
  4. Query handlers in Express routes use `findUnique({ where: { id } })` instead of scoping to `where: { id, organizationId }`.

### 2. RAG & Vector Retrieval Tenant Isolation (CRITICAL)
- **Vulnerability:** Document chunk similarity searches query embeddings across the entire database or filter by `dealId` without verifying that the `dealId` belongs to the request's `organizationId`.
- **Risk:** Cross-tenant prompt injection or knowledge base data leakage where Organization A receives Organization B's confidential contract clauses or client information.

### 3. Inbound Webhook Security & Idempotency (CRITICAL)
- **Vulnerability:** `POST /api/leads/inbound` accepts raw JSON without signature header validation (`X-Webhook-Signature` or `X-Hub-Signature`).
- **Risk:** Malicious actors can spoof inbound leads or bombard the endpoint, triggering uncontrolled Gemini API usage. Lack of a `WebhookEvent` model with a unique constraint on `(provider, externalEventId)` means retried webhook requests duplicate leads.

### 4. Concurrent Lead Ingestion & Database Constraints (CRITICAL)
- **Vulnerability:** `ingestInboundLead` checks existing leads with `prisma.lead.findFirst({ where: { email } })` followed by `prisma.lead.create(...)`. Concurrent requests execute the check simultaneously, pass, and insert duplicate rows.
- **Fix Required:** Normalized email/phone, database unique constraints on `(organizationId, email)` and `(organizationId, phone)`, and atomic upsert / transaction handling.

### 5. AI Architecture & State Machine Safety (HIGH)
- **Vulnerability:**
  - AI extraction results directly update `LeadRequirement` and `LeadPriority`.
  - Conversation threads rely on loose boolean toggles (`isHumanTakeover`, `autoReplyEnabled`) instead of an explicit conversation state machine (`AUTOPILOT`, `DRAFT_ONLY`, `HUMAN_TAKEOVER`, `PAUSED`, `CLOSED`).
  - Outbound AI responses lack a draft proposal approval queue (`PENDING_APPROVAL`, `APPROVED`, `REJECTED`, `SENT`).

### 6. Transaction Task Auditability & Human Editing (HIGH)
- **Vulnerability:** Re-parsing a PDF document or calling `extractTasks` creates duplicate tasks or risks wiping out human-reviewed task edits.
- **Fix Required:** Implement `ExtractionRun` and `TaskProposal` models so human edits on authoritative `TransactionTask` rows are preserved regardless of document re-extraction.

### 7. Property Matching Determinism (HIGH)
- **Vulnerability:** Soft scoring algorithms could allow an LLM or match score to present a property that violates a hard buyer filter (e.g. price > maxBudget, bedrooms < minBedrooms, or incompatible property type).
- **Fix Required:** Hard filter enforcement before candidate ranking and distinction between `matchScore` (deterministic) and `aiExplanationConfidence`.

### 8. Database Migrations & Production Config (HIGH)
- **Vulnerability:** Deployment script in `package.json` relies on `prisma db push` which is unsafe for production and can cause silent data loss.
- **Fix Required:** Initialize versioned Prisma migrations with `prisma migrate dev` / `prisma migrate deploy` and enforce schema invariants.

---

## Hardening Action Plan

We will systematically execute the following phases:
1. **Phase 2:** Multi-Tenant Authorization & Database Schema Scoping (Adding `organizationId` to all models, enforce JWT `organizationId`, rewrite API routes).
2. **Phase 3 & 4:** Database Integrity & Concurrency-Safe Lead Ingestion (Normalized email/phone, unique constraints, atomic upsert, concurrency tests).
3. **Phase 5 & 6:** Inbound Webhook Security & Event Idempotency (`WebhookEvent` model, timing-safe HMAC signature verification, replay protection).
4. **Phase 7 & 8:** AI Architecture Safety & Conversation State Machine (`TaskProposal`, `LeadRequirementProposal`, AI message drafts, explicit state machine transitions).
5. **Phase 9 & 10:** RAG Tenant Isolation & Citation Traceability (Tenant-scoped vector query, document citation verification).
6. **Phase 11 & 12:** Transaction Task Extraction & Auditability (Preserve human edits, proposal review queue).
7. **Phase 13:** Deterministic Property Matching (Hard requirement enforcement).
8. **Phases 14-30:** Webhook rate limiting, error handling, background processing, security headers, Prisma migrations.
9. **Phases 31-44:** Comprehensive security & concurrency test matrix, E2E tests, production build & startup verification, and `PRODUCTION_READINESS_REPORT.md`.

---
