# 07 — Presentation Delivery Guide (Demo Day Coaching)

---

## 1. How to Introduce the Project (First 30 Seconds)
- **Hook with the real-world pain, not the tech stack:**
  *"In real estate, deals die in two places: slow lead response before the visit, and missed contingency deadlines after the contract is signed. Eigen Estate solves both."*
- **State your role and what is actually built:**
  Make it immediately clear this is a working full-stack TypeScript, PostgreSQL, Gemini AI, and WebSocket voice platform—not a slideware mockup.

## 2. How to Explain Technical Architecture Without Confusing Judges
- **Use the "Two Engines + One Brain" framing:**
  1. **Escrow Engine:** PDF → Gemini Extraction → Deterministic Date Engine → Human Review → Cron Alerts.
  2. **Knowledge Brain (RAG):** Hybrid Retrieval + Server-Side Citation Verifier.
  3. **Sales Agent:** Supervisor Router → 5 Specialists → 13 Typed Tools → WhatsApp / Web / Plivo Voice.
- **Translate jargon immediately:**
  - Instead of just saying *"Hybrid RAG with Citation Verifier"*, say *"It searches the contract, and then a deterministic server check verifies every single quote word-for-word before showing it to the user."*

## 3. Balancing Business Value and Technical Depth
- **For Faculty / Technical Judges:** Lean into `dateEngine.service.ts` (why LLMs shouldn't do calendar math), `citationVerifier.ts` (NFKC + un-hyphenation), `MAX_AGENT_ROUNDS = 5`, `sessionVersion` JWT revocation, and `OutboxJob` idempotency.
- **For Startup / Product Judges:** Lean into speed-to-lead, Human-in-the-Loop safety, tiered SaaS + metered wallet unit economics (`ProviderCostEvent`), and the unified Lead-to-Deal lifecycle.

## 4. How to Explain Why Our Implementation Is Different
- **Never bash competitors; contrast architecture:**
  *"Generic AI wrappers pass a prompt to an LLM and hope the date and quote are right. Eigen Estate separates what LLMs are great at—language understanding—from what deterministic code must own: legal date arithmetic, quote verification, and tenant isolation."*

## 5. How to Answer When You Don't Know Something
- **Use the 3-step Honest Architect Formula:**
  1. Acknowledge directly: *"I don't have the exact benchmark number for that in front of me."*
  2. Anchor to what you *do* know in the code: *"What I can tell you from our implementation is..."*
  3. Offer to follow up or point to the architectural boundary.
- **Never guess** latency numbers, user counts, revenue, or accuracy percentages you haven't measured.

## 6. Avoiding Overclaiming
- Clearly distinguish:
  - **Implemented:** Multi-tenant auth, PDF extraction + OCR fallback, Date Engine, HITL Review, Cron alerts, Hybrid RAG + Citation Verifier, 13-tool Multi-Agent runtime, Plivo WS gateway, Wallet/COGS ledger, 37 Jest test files.
  - **Planned / Future:** Native `pgvector` HNSW index (currently JSON + in-memory cosine similarity), Redis rate limiting (currently in-memory), multi-provider Claude routing.

## 7. Maintaining Confidence & Pacing
- Speak 15% slower than your normal conversational speed—especially when explaining architecture diagrams.
- Pause for 1 full second after clicking a button in the live demo so the audience's eyes catch up to the screen.
- Keep your posture open, look at the judges (not your laptop screen), and narrate *why* a screen matters, not just *what* you are clicking.

## 8. Finishing Strongly
- End with a crisp 2-sentence wrap-up:
  *"Eigen Estate brings deterministic engineering to high-stakes real estate—turning 50-page contracts and multi-channel buyer conversations into one verifiable, automated operating system. Thank you—I'm ready for your questions."*
