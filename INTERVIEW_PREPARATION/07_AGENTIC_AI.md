# 07 — Agentic AI Architecture (Custom TypeScript Multi-Agent System)

## 1. Agentic AI Fundamentals & Reality Check
- **LLM vs. AI Agent:** An LLM generates a single response; an **Agent** operates in a loop (Observe → Reason → Act via Tools → Observe Tool Result → Respond) with memory, state, and guardrails.
- **LangChain / LangGraph Reality Check:** Neither `langchain` nor `langgraph` is installed or used in this codebase. Instead, Eigen Estate implements a **custom, deterministic Supervisor + Bounded Tool-Calling Runtime** in TypeScript (`backend/src/services/agent/`). This gives full control over multi-tenant context injection, Zod validation, and zero-hallucination fallbacks without framework bloat.

---

## 2. How the Multi-Agent System Works

### A. Supervisor Router (`backend/src/services/agent/orchestrator.ts`)
- `routeToSpecialist(ctx: OrchestratorContext)` classifies the buyer's message into a `TurnIntent` and dispatches one of the specialist personas (`AgentSpecialist`):
  - `OPTOUT_DND` / `HUMAN_REQUEST` → **`ESCALATION`**
  - `SCHEDULING_VISIT` → **`CLOSER`**
  - `COLLATERAL_REQUEST` → **`MATCHER`**
  - `PROJECT_DOCS_OR_LEGAL` → **`DOCS_RAG`**
  - `PROPERTY_INQUIRY_OR_OBJECTION` → **`MATCHER`** (if requirements exist) or **`QUALIFIER`**
  - `DISCOVERY_QUALIFICATION` → **`QUALIFIER`**
- Also injects `allowedChannelConstraints` tailored to `VOICE_CALL` (< 35 words, spoken), `WEB_WIDGET` (< 65 words), or `WHATSAPP`/`TELEGRAM` (< 60 words, 1 question).

### B. Bounded Execution Loop (`backend/src/services/agent/agentRuntime.ts`)
- `MAX_AGENT_ROUNDS = 5` caps tool-calling iterations to prevent infinite loops and runaway latency/cost.
- Runs Gemini with `BASE_SYSTEM_INSTRUCTION` + specialist addendum + `AGENT_FUNCTION_DECLARATIONS`.
- **Fallback:** If Gemini is unavailable, `generateConsultativeFallback()` queries `AVAILABLE` properties from PostgreSQL and builds a strictly DB-grounded reply.
- **Post-LLM Guardrail:** `verifyAgentOutput()` checks the draft response for ungrounded property claims or unauthorized discounts.
- **Observability:** `recordAgentRunTrace()` persists `AgentRunTrace` (specialist, tools executed, duration, guardrail flags, stage).

### C. Typed Tool Registry & Security Boundary (`backend/src/services/agent/agentTools.ts`)
- Every tool validates LLM arguments with **Zod** (`SearchPropertiesArgsSchema`, `ProposeBuyerRequirementsArgsSchema`, `CheckSiteVisitAvailabilityArgsSchema`, etc.).
- **Critical Security Boundary:** `executeAgentTool()` injects `TrustedAgentContext` (`organizationId`, `leadId`, `threadId`) from the server—the LLM cannot pass or spoof another organization's ID.
- Key tools: `search_properties`, `propose_buyer_requirements`, `evaluate_buyer_qualification`, `check_site_visit_availability`, `book_site_visit`, `send_property_collateral`, `query_project_knowledge`, `escalate_to_human`.

### D. Persistent Buyer Memory & Fact Provenance (`backend/src/services/agent/buyerMemory.service.ts`)
- `assembleBuyerMemory()` builds `PersistentBuyerMemory` tagging every fact with its provenance:
  `AUTHORITATIVE_DB` | `PENDING_PROPOSAL` | `BUYER_STATED` | `CONFIRMED_VISIT` | `PROPOSED_VISIT` | `ADVISOR_COMMITMENT` | `INFERRED_UNCONFIRMED`.
- Prevents the AI from confusing a *proposed* visit slot with a *confirmed* booking.
