# 06 — Judge & Evaluator Q&A (45+ Questions & Answers)

> **Organized across all 15 evaluation categories.** Every answer reflects the actual codebase—no invented metrics or unimplemented claims.

---

### A. Problem & Solution (Q1–Q3)
1. **Q: Why combine lead qualification and contingency tracking in a single platform?**
   **A:** Because in real estate, a qualified buyer becomes an active escrow. Having both in one schema (`Lead` converts directly to `Deal` via `leadConversion.service.ts`) preserves buyer requirements, property context, and conversation history straight through to closing.
2. **Q: Why can't agents just use Google Calendar + ChatGPT?**
   **A:** Google Calendar doesn't read 50-page PDFs or compute business-day state holidays from clause text, and ChatGPT has no multi-tenant isolation, no HITL confirmation workflow, no deterministic quote verification, and no automated `EmailLog`-deduplicated alert cron.
3. **Q: What happens if an addendum overrides a base purchase agreement?**
   **A:** Our Assistant system prompt (`assistant.service.ts`) enforces strict contract precedence (Addenda and Counter Offers override Purchase Agreements) and outputs structured `overrides` objects alongside inline citations so the agent sees both the original and modified terms.

### B. Product Functionality (Q4–Q6)
4. **Q: Are extracted deadlines automatically marked as active?**
   **A:** No—by design, extracted deadlines start as `PENDING`. A human agent reviews and confirms them on `ReviewPage.tsx` (`CONFIRMED`/`ACTIVE`) before relying on them for legal compliance.
5. **Q: What channels does the sales agent support?**
   **A:** WhatsApp (Meta Cloud API), Telegram Bot, Embeddable Web Widget (`publicWidget.ts`), Email (Resend/SendGrid/SMTP), and Live Voice Calls (Plivo `<Stream>` WebSockets).
6. **Q: What happens if a human advisor replies on WhatsApp while the AI is active?**
   **A:** Our WhatsApp coexistence & escalation design (`ESCALATION` specialist + thread state) supports pausing/handing off to the human advisor so the bot never talks over a live agent.

### C. Architecture (Q7–Q9)
7. **Q: Why did you choose a modular monolith over microservices?**
   **A:** A modular TypeScript monolith lets us wrap domain writes, `OutboxJob` creation, and `AuditLog` entries in atomic Prisma transactions, eliminates inter-service network overhead, and deploys cleanly to Render (backend) and Vercel (frontend).
8. **Q: How are background jobs and webhooks structured?**
   **A:** Scheduled deadline alerts run via `node-cron` (`alert.service.ts`), outbound messages use a transactional `OutboxJob` table (`outboxDispatcher.ts`), and inbound channels enter via dedicated Express webhook routers with `rawBody` preserved for signature checks.
9. **Q: How does graceful shutdown work?**
   **A:** `index.ts` listens for `SIGTERM`/`SIGINT`, stops cron jobs and the Telegram bot, closes the HTTP server to drain in-flight requests, and disconnects Prisma—bounded by a 10-second emergency timeout.

### D. Backend (Q10–Q12)
10. **Q: How do you validate incoming API payloads and AI responses?**
    **A:** Both use `zod` schemas—API routes validate `req.body` before hitting services, and `ai.service.ts` / `assistant.service.ts` / `agentTools.ts` validate LLM JSON and tool arguments with Zod.
11. **Q: How does the Date Engine handle holidays?**
    **A:** `dateEngine.service.ts` uses `date-holidays` initialized with `(country, state)` (e.g., `US`, `CA`) and iterates day-by-day for `business` day clauses, skipping weekends (`isWeekend`) and statutory holidays.
12. **Q: What happens if a scanned PDF has no text layer?**
    **A:** `ai.service.ts` checks if `pdf-parse` yields >50 characters; if not, it reads the PDF as base64 and sends it as `inlineData` (`application/pdf`) to Gemini Vision for multimodal extraction. Similarly, `pdf.service.ts` falls back to Gemini Vision OCR for pages with `< 30` chars.

### E. Database (Q13–Q16)
13. **Q: How many models are in your database, and how are migrations managed?**
    **A:** Over 40 Prisma models in `backend/prisma/schema.prisma` backed by PostgreSQL 16 and versioned SQL migrations (`prisma migrate deploy`).
14. **Q: How do you prevent duplicate alert emails if the cron job runs multiple times?**
    **A:** `EmailLog` has a composite unique constraint `@@unique([deadlineId, template])`, and `alert.service.ts` checks for an existing log before dispatching.
15. **Q: How do you prevent duplicate leads across channels?**
    **A:** `Lead` enforces `@@unique([organizationId, email])` and `@@unique([organizationId, phone])`.
16. **Q: Why store `DocumentChunk.embedding` as `Json?` instead of `pgvector`?**
    **A:** Storing embeddings as `Json?` allowed rapid iteration with Prisma without custom raw-SQL migrations on every environment. Moving to a native `pgvector` `vector(768)` column with an HNSW index is our planned scaling upgrade.

### F. Authentication & Security (Q17–Q20)
17. **Q: How does JWT revocation work without a Redis blacklist?**
    **A:** Every `User` has a `sessionVersion` integer embedded as `sv` in the `HS256` JWT. When a user's role changes or they are removed, `sessionVersion` is incremented in Postgres, immediately invalidating older tokens.
18. **Q: How do you enforce multi-tenant isolation?**
    **A:** Every query filters by `req.user.organizationId` (from the verified JWT, never from client-supplied headers/body). We also have adversarial Jest tests (`tenantIsolationAdversarial.test.ts`, `ragIsolation.test.ts`) verifying cross-org access returns 404/403.
19. **Q: How are webhooks secured against spoofing?**
    **A:** `app.ts` captures `req.rawBody` during JSON parsing, and webhook routes verify HMAC signatures (WhatsApp, Telegram, Plivo, Resend/Svix, Razorpay, Stripe) against those exact bytes.
20. **Q: How do you protect against prompt injection inside uploaded contracts?**
    **A:** `assistant.service.ts` wraps all document text in `<<DOC_DATA>>...<</DOC_DATA>>` delimiters and instructs the model to treat it strictly as untrusted data. We also test this in `promptInjection.test.ts`.

### G. AI & LLM (Q21–Q23)
21. **Q: What happens if the primary Gemini model is unavailable or rate-limited?**
    **A:** `ai.service.ts` iterates through a deduplicated list of candidate Gemini Flash models (`GEMINI_MODEL`, `gemini-2.5-flash-lite`, `gemini-3.5-flash-lite`, `gemini-3.5-flash`, etc.) with a 500ms backoff between attempts.
22. **Q: How do you control LLM output structure?**
    **A:** We pass `responseMimeType: 'application/json'`, a strict `responseJsonSchema`, and `temperature: 0`, then parse and sanitize the result with Zod.
23. **Q: What if the Gemini API key is missing or fails during a sales chat turn?**
    **A:** `agentRuntime.ts` falls back to `generateConsultativeFallback()`, which queries verified `AVAILABLE` properties from the organization's database so it never invents fake listings.

### H. Agentic AI (Q24–Q27)
24. **Q: How is the multi-agent system architected?**
    **A:** `orchestrator.ts` acts as a Supervisor Router classifying intent (`OPTOUT_DND`, `HUMAN_REQUEST`, `SCHEDULING_VISIT`, `COLLATERAL_REQUEST`, `PROJECT_DOCS_OR_LEGAL`, etc.) and assigning a specialist (`QUALIFIER`, `MATCHER`, `CLOSER`, `DOCS_RAG`, `ESCALATION`).
25. **Q: How do you prevent an AI agent from getting stuck in an infinite tool-calling loop?**
    **A:** `agentRuntime.ts` enforces `MAX_AGENT_ROUNDS = 5`, returning `exhaustedLimit` cleanly if reached, and logs every run in `AgentRunTrace` with latency, tools executed, and guardrail flags.
26. **Q: Can the agent book a site visit without the buyer's consent?**
    **A:** No—the `CLOSER` directive and `BASE_SYSTEM_INSTRUCTION` explicitly require offering slots via `check_site_visit_availability` first and only calling `book_site_visit` after the buyer explicitly agrees to a date and time.
27. **Q: What is "Human Chat Physics"?**
    **A:** Implemented in `humanChatPhysics.ts`, it splits long AI replies into 2–3 conversational micro-bubbles, enforces the "Tennis Volley Rule" (strictly one `?` per turn so the AI doesn't interrogate the buyer), and respects Night-Owl etiquette.

### I. RAG Pipeline (Q28–Q30)
28. **Q: Why use a 120,000-token full-context threshold instead of always doing vector search?**
    **A:** Purchase agreements are dense and interdependent—an addendum on page 18 can override page 3. When a deal's total tokens are `<= 120,000`, `full_context` mode guarantees zero missed clauses. Beyond that, `hybrid_retrieval` keeps core contracts in full and scores bulky docs.
29. **Q: How does hybrid scoring work?**
    **A:** `retrieval.service.ts` computes `0.7 * cosineSimilarity(queryEmbedding, chunkEmbedding) + 0.3 * keywordScore`, selects the top-K (`6`) bulky chunks, and expands to `page ± 1` neighbor pages so split clauses aren't cut off.
30. **Q: How does the Citation Verifier handle PDF formatting quirks?**
    **A:** `normalizeTextForMatching()` in `citationVerifier.ts` applies NFKC normalization, converts curly quotes to straight ASCII, un-hyphenates line-broken words (`inspec-\ntion` → `inspection`), and checks an 80% continuous window for quotes >60 chars. Any unverified citation is dropped.

### J. Frontend (Q31–Q33)
31. **Q: How do you keep the frontend fast with 24 pages and Three.js / PDF.js?**
    **A:** `App.tsx` uses `React.lazy()` and `<Suspense>` for route-level code splitting, plus route prefetching (`routes/prefetch.ts`).
32. **Q: How does citation highlighting work in the UI?**
    **A:** Verified citations include `documentId`, `pageNumber`, and `quote`; `quoteMatcher.ts` and `DocumentInspectorModal.tsx` locate and highlight the exact passage inside the `pdfjs-dist` viewer.
33. **Q: What UX shortcuts exist for power users?**
    **A:** `⌘K` opens the global `CommandPalette`, and `⌘I` jumps straight to `/upload`.

### K. Scalability & Performance (Q34–Q37)
34. **Q: What are the current bottlenecks if 1,000 brokerages onboard tomorrow?**
    **A:** Two honest bottlenecks: (1) in-memory `cosineSimilarity` over JSON embeddings for very large deals/KBs, and (2) per-process in-memory `rateLimit.ts`. Both have clear upgrade paths: `pgvector` HNSW indexes and Redis.
35. **Q: How do you handle concurrent PDF uploads or webhooks?**
    **A:** `OutboxJob` uses database-level idempotency keys, `EmailLog` uses unique constraints, and `concurrency.test.ts` tests parallel execution safety.
36. **Q: How do you keep live voice call latency low?**
    **A:** `plivoStreamGateway.ts` streams raw 8kHz mu-law audio over WebSockets, uses `eleven_flash_v2_5` with native `ulaw_8000` output (skipping transcoding when ElevenLabs succeeds), and restricts voice replies to `< 35` words.
37. **Q: What happens if ElevenLabs goes down mid-call?**
    **A:** `synthesizeCallAudioMulaw()` tracks consecutive failures in `PlatformConfig` and automatically fails over to `Cartesia Sonic` or `Microsoft Edge Neural` (`msedge-tts` + `ffmpeg`).

### L. Business Model, Competitors & Future Scope (Q38–Q45)
38. **Q: What is your business model?**
    **A:** Tiered SaaS subscriptions (`SOLO`, `TEAM`, `ENTERPRISE` via Stripe/Razorpay) combined with a pre-paid metered usage wallet (`OrganizationWallet`) for telephony minutes and omnichannel AI qualification.
39. **Q: How do you track unit economics?**
    **A:** `ProviderCostEvent` logs per-operation COGS (Gemini tokens, Plivo voice, STT, TTS, Razorpay fees) per organization, surfaced in the Super-Admin dashboard (`AdminPage.tsx`).
40. **Q: Who are your main competitors?**
    **A:** Transaction management tools like Dotloop/SkySlope (which lack AI clause extraction + omnichannel voice/WhatsApp agents) and generic real estate CRMs (which lack deterministic escrow surveillance and citation-verified RAG).
41. **Q: What is your strongest technical moat?**
    **A:** The combination of deterministic legal date math, server-side verbatim citation verification, and a 13-tool bounded multi-agent runtime unified in one tenant-isolated schema.
42. **Q: How is the codebase tested?**
    **A:** We have 37 Jest test files in `backend/tests/` covering unit logic (`dateEngine.service.test.ts`), E2E APIs (`apiE2E.test.ts`), security (`tenantIsolationAdversarial.test.ts`, `promptInjection.test.ts`, `webhookSecurity.test.ts`), and agentic flows.
43. **Q: Why is `@anthropic-ai/sdk` in `package.json` if you use Gemini?**
    **A:** It was added for planned multi-provider LLM routing; currently all active extraction, embedding, and agent runtime calls use `@google/genai`.
44. **Q: What is your immediate next engineering milestone?**
    **A:** Migrating `DocumentChunk.embedding` to native `pgvector` HNSW indexes and moving `rateLimit.ts` to Redis for multi-instance horizontal scaling.
45. **Q: If a judge asks: "What if the AI extracts a wrong number of days from a blurry scan?"**
    **A:** *"That is precisely why we enforce Human-in-the-Loop review: every extracted deadline starts as `PENDING` with its verbatim `rawText` and confidence score shown side-by-side, so the agent verifies and confirms it before any alert is armed."*
