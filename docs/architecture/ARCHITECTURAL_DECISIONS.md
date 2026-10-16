# Architecture Decision Records (ADRs)
## Contingency Deadline Copilot & Real Estate AI Platform

**Document Version:** 1.0.0  
**Status:** Baseline Documented & Verified  
**Primary Architect:** Principal Software Systems Architect  

---

## Index of Architectural Decisions

1. [ADR-001: Multi-Tenancy Strategy via Row-Level Scoping & Composite Unique Constraints](#adr-001-multi-tenancy-strategy-via-row-level-scoping--composite-unique-constraints)
2. [ADR-002: Dual-Model Authentication with Dynamic Session Revocation](#adr-002-dual-model-authentication-with-dynamic-session-revocation)
3. [ADR-003: AI Safety Architecture via the Proposal Pattern & Bounded Loops](#adr-003-ai-safety-architecture-via-the-proposal-pattern--bounded-loops)
4. [ADR-004: Transactional Outbox Pattern for Decoupled Outbound Messaging](#adr-004-transactional-outbox-pattern-for-decoupled-outbound-messaging)
5. [ADR-005: Atomic Lead-to-Deal Conversion Invariant & Property Locking](#adr-005-atomic-lead-to-deal-conversion-invariant--property-locking)
6. [ADR-006: Dual-Mode RAG Pipeline with Verbatim Substring Citation Verification](#adr-006-dual-mode-rag-pipeline-with-verbatim-substring-citation-verification)
7. [ADR-007: Deterministic Property Inventory Matching Pre-Filtering](#adr-007-deterministic-property-inventory-matching-pre-filtering)
8. [ADR-008: Strict Daylight-Saving Time (DST) Transition Defense](#adr-008-strict-daylight-saving-time-dst-transition-defense)
9. [ADR-009: Webhook Security, Constant-Time Signatures & Event Deduplication](#adr-009-webhook-security-constant-time-signatures--event-deduplication)
10. [ADR-010: Telegram Real-Time Conversational AI & Neural Voice Memo Architecture](#adr-010-telegram-real-time-conversational-ai--neural-voice-memo-architecture)

---

### ADR-001: Multi-Tenancy Strategy via Row-Level Scoping & Composite Unique Constraints
- **Status:** Existing (Accepted & Verified)
- **Context:** The platform serves multiple independent real estate brokerages. Cross-tenant data leakage (e.g. Brokerage A seeing Brokerage B's leads, confidential contracts, or clients) would represent a catastrophic security failure and regulatory violation.
- **Decision:** Implement logical row-level tenancy within a single shared PostgreSQL database. Every domain table (`leads`, `properties`, `deals`, `documents`, `site_visits`, `conversation_threads`) contains a mandatory foreign key to `Organization`. Handlers extract `organizationId` from authenticated JWT session claims and enforce it server-side.
- **Alternatives Considered:**
  - *Database-per-tenant:* High operational overhead, connection pool exhaustion, complex migration management.
  - *Schema-per-tenant (PostgreSQL schemas):* Migration complexity, dynamic schema connection routing overhead.
- **Consequences:**
  - *Advantages:* Low operational cost, simple cross-brokerage analytics, straightforward backup and migration scripts.
  - *Disadvantages:* Requires absolute rigor in query building. Mitigated by `requireOrgId()` and automated multi-tenant security test suites.

---

### ADR-002: Dual-Model Authentication with Dynamic Session Revocation
- **Status:** Existing (Accepted & Verified)
- **Context:** Independent real estate agents demand frictionless sign-in (Google OAuth), while brokerages require strict invite-only membership control and the ability to instantly revoke an agent's access upon termination.
- **Decision:** Use Google Identity Services for identity verification, combined with an internal `invitations` table enforcing single-use SHA-256 token hashes. Sessions are signed JWTs with a `sessionVersion` claim. Every authenticated request verifies that `claims.sv === user.sessionVersion` in the database.
- **Alternatives Considered:**
  - *Pure stateless JWTs without database check:* Cannot revoke access until JWT expires (7 days of vulnerability).
  - *Stateful session store (Redis):* Introduces external dependency for minimal gain at current scale.
- **Consequences:**
  - *Advantages:* Instant access revocation across all devices whenever an agent is removed or demoted; zero password management liability.
  - *Disadvantages:* Adds a single fast indexed primary key query per HTTP request.

---

### ADR-003: AI Safety Architecture via the Proposal Pattern & Bounded Loops
- **Status:** Existing (Accepted & Verified)
- **Context:** Autonomous LLMs interacting with clients risk mutating authoritative CRM requirements, agreeing to unauthorized price discounts, or executing infinite recursive tool calling loops.
- **Decision:** Decouple AI tool execution from authoritative database mutations via the **Proposal Pattern**. Tools create proposal records (`LeadRequirementProposal`, `TaskProposal`, `SuggestedReply`) that require explicit human agent review and approval. The agent loop is strictly capped at `MAX_AGENT_ROUNDS = 5`.
- **Alternatives Considered:**
  - *Full Autonomous Mutation:* High risk of data corruption, legal liability, and customer dissatisfaction.
  - *Pure Chatbot (No Tools):* Fails to automate CRM entry, showing checks, or inventory searches.
- **Consequences:**
  - *Advantages:* 100% human-in-the-loop auditability; eliminates hallucinations in authoritative records.
  - *Disadvantages:* Requires human agent interaction to review and approve proposals.

---

### ADR-004: Transactional Outbox Pattern for Decoupled Outbound Messaging
- **Status:** Existing (Accepted & Verified)
- **Context:** Sending customer emails directly inside HTTP request handlers causes slow response times, fails on external provider downtime, and risks dual-write inconsistencies if the database write succeeds but email dispatch fails.
- **Decision:** Implement the **Transactional Outbox Pattern**. Approving an AI message atomically updates the message status and inserts a record into `outbox_jobs` inside a single PostgreSQL transaction. A background worker claims jobs with optimistic locking (`lockedAt`) and retries transient failures with bounded exponential backoff.
- **Alternatives Considered:**
  - *Direct synchronous HTTP calls to Resend:* Prone to timeouts, network drops, and lost emails.
  - *External Message Queue (RabbitMQ / SQS):* Unnecessary infrastructure complexity when PostgreSQL handles transactional enqueuing cleanly.
- **Consequences:**
  - *Advantages:* Guaranteed delivery; resilience against third-party API outages; zero lost messages.
  - *Disadvantages:* Outbound emails are asynchronous rather than instantaneous (typically 1–2 second latency).

---

### ADR-005: Atomic Lead-to-Deal Conversion Invariant & Property Locking
- **Status:** Existing (Accepted & Verified)
- **Context:** When a sales lead signs a contract, multiple agents could race to convert the lead, or mid-flight database failures could leave the lead marked `WON` without an active `Deal`.
- **Decision:** Enforce a strict one-to-one invariant via `@unique` on `Deal.leadId`. Conversion executes within `prisma.$transaction`, verifying lead eligibility (`QUALIFIED`/`PROPOSAL`), updating property status to `UNDER_CONTRACT`, creating the `Deal`, and logging audit records. Concurrent conversion races fail closed with HTTP 409 Conflict.
- **Alternatives Considered:**
  - *Multi-step non-transactional conversion:* Risks orphan deals and inconsistent inventory status.
- **Consequences:**
  - *Advantages:* Complete database integrity; impossible to double-convert a lead or sell an under-contract property.
  - *Disadvantages:* Requires property address and eligible lead stage prior to conversion.

---

### ADR-006: Dual-Mode RAG Pipeline with Verbatim Substring Citation Verification
- **Status:** Existing (Accepted & Verified)
- **Context:** Generic RAG systems frequently hallucinate contract clause interpretations and cite incorrect page numbers, which can lead to severe legal and financial consequences in real estate transactions.
- **Decision:** Implement a dual-mode retrieval architecture:
  1. For deal packets under 120,000 tokens (typical contracts): Inject the entire document text into Gemini's long-context attention window.
  2. For packets over 120,000 tokens: Inject core contracts in full and retrieve bulky inspection reports via vector similarity.
  3. Every generated citation undergoes server-side text normalization and verbatim substring verification against the database chunk text. Hallucinated quotes are stripped before delivery.
- **Alternatives Considered:**
  - *Standard Chunk-Only Vector Search:* Misses cross-document amendments and counter-offers that override early clauses.
  - *Unverified LLM Citations:* Hallucination rate is unacceptable for legal contracts.
- **Consequences:**
  - *Advantages:* Zero hallucinated contract citations; complete awareness of addenda and counter-offers.
  - *Disadvantages:* Slightly higher token consumption during full-context mode for large documents.

---

### ADR-007: Deterministic Property Inventory Matching Pre-Filtering
- **Status:** Existing (Accepted & Verified)
- **Context:** An AI model presented with property inventory might recommend a home that violates a non-negotiable buyer constraint (e.g. exceeds budget ceiling or lacks required bedrooms) because soft features (pool, view) score highly.
- **Decision:** Enforce strict SQL hard filters (`status = AVAILABLE`, `price <= maxBudget`, `bedrooms >= minBedrooms`, `propertyType = requestedType`) before passing candidate properties to soft scoring algorithms or LLM explanation generators.
- **Alternatives Considered:**
  - *Pure LLM Matching:* High likelihood of showing unaffordable properties.
- **Consequences:**
  - *Advantages:* 100% mathematical guarantee that no over-budget property is matched to a buyer.
  - *Disadvantages:* If a buyer's criteria are too narrow, zero properties may pass the hard filter.

---

### ADR-008: Strict Daylight-Saving Time (DST) Transition Defense
- **Status:** Existing (Accepted & Verified)
- **Context:** Real estate showings scheduled across daylight-saving transitions (spring-forward gaps and fall-back repeats) can cause missed client appointments and calendar synchronization errors.
- **Decision:** Implement `parseLocalDateTimeToUtc` in `timezone.ts`. The utility detects and strictly throws descriptive validation errors for nonexistent local times (e.g. 02:30 EDT on March 8 spring-forward) and ambiguous local times during fall-back turn-backs.
- **Alternatives Considered:**
  - *Naive UTC timestamp parsing:* Silently shifts appointments by 1 hour on DST days.
- **Consequences:**
  - *Advantages:* Complete appointment scheduling accuracy across all US and international timezones.
  - *Disadvantages:* Clients scheduling during DST change hours must select an unambiguous time.

---

### ADR-009: Webhook Security, Constant-Time Signatures & Event Deduplication
- **Status:** Existing (Accepted & Verified)
- **Context:** Inbound webhooks from lead generation portals and email gateways are vulnerable to signature spoofing, replay attacks, and denial-of-service spam.
- **Decision:** Validate webhook signatures using constant-time HMAC-SHA256 comparison and standard Svix verification headers (`svix-id`, `svix-timestamp`, `svix-signature`). Persist every incoming event in `webhook_events` with a unique index on `(provider, externalEventId)`. Replayed requests are safely ignored.
- **Alternatives Considered:**
  - *Unauthenticated webhooks:* Vulnerable to lead spoofing and uncontrolled LLM API billing abuse.
- **Consequences:**
  - *Advantages:* Full defense against replay attacks and signature spoofing; guaranteed idempotency.
  - *Disadvantages:* Webhook providers must configure valid HMAC secrets.

---

### ADR-010: Telegram Real-Time Conversational AI & Neural Voice Memo Architecture
- **Status:** Existing (Accepted & Verified)
- **Context:** High-net-worth real estate buyers prefer conversational messaging and audio voice notes over filling out static CRM web forms or reading marketing emails.
- **Decision:** Integrate a Telegram Bot daemon (`@BadalLabsAssistantBot`) that connects directly into the `SalesAgentRuntime`. The bot supports real-time text dialogue and synthesizes ultra-realistic human speech voice memos using Microsoft Edge / Azure Neural TTS and ElevenLabs.
- **Alternatives Considered:**
  - *Third-party WhatsApp Business API exclusively:* Requires extensive Meta business verification and fees before testing; Telegram allows instant, zero-cost conversational testing.
- **Consequences:**
  - *Advantages:* Immediate access for mobile buyers; authentic voice memo interaction; zero app installation needed.
  - *Disadvantages:* Production WhatsApp integration will still require Twilio/Meta setup in future phases.
