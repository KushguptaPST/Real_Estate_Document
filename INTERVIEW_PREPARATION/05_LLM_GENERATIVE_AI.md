# 05 — Generative AI & LLM Fundamentals (Code-Grounded)

## 1. LLM Fundamentals (Interview Primer)
- **LLM & Transformers:** Autoregressive neural networks using self-attention to predict next tokens given a context window.
- **Tokens:** Subword units (~4 characters in English). Context windows cap total input + output tokens.
- **Embeddings:** Dense numeric vectors (e.g., 768 dimensions) capturing semantic meaning, compared via cosine similarity.
- **Temperature:** Controls randomness (`0` = deterministic, used in `ai.service.ts` clause extraction; higher values = more conversational variety).
- **Structured Outputs (`responseMimeType: 'application/json'`, `responseJsonSchema`):** Constrains decoding to match a JSON schema, backed by **Zod** validation in application code.
- **Function / Tool Calling:** The model emits a structured tool call (`name` + `args`) instead of final text; the server executes the tool and feeds the result back.

---

## 2. How This Project Integrates LLMs

### Provider Reality Check
- **Active Provider:** Google Gemini via `@google/genai` (`v2.23.0`).
- **Unused Dependency:** `@anthropic-ai/sdk` is listed in `backend/package.json` but is **not imported anywhere** in `backend/src/`.

### Where Gemini Is Called in Code
1. **Clause Extraction (`backend/src/services/ai.service.ts` — `extractClausesFromPdf`):**
   - **Fast Path:** Extracts text layer via `pdf-parse` (`text.slice(0, 50000)`).
   - **Scanned PDF Fallback:** Reads base64 PDF binary (`inlineData: { mimeType: 'application/pdf', data: pdfData }`) for multimodal Vision OCR.
   - **Model Fallback Chain:** Iterates `candidateModels` (`GEMINI_MODEL` → `gemini-2.5-flash-lite` → `gemini-3.5-flash-lite` → `gemini-3.5-flash` → `gemini-3.8-flash` → `gemini-flash-latest`) if a model fails or is rate-limited.
   - **Validation:** `temperature: 0`, `responseJsonSchema`, then parsed by `GeminiResponseSchema` (Zod).
2. **Deal RAG Assistant (`backend/src/services/assistant.service.ts` — `askDealAssistant`):**
   - Uses `SYSTEM_INSTRUCTION` + `<<DOC_DATA>>` delimiters + `assistantJsonSchema` + `AssistantResponseSchema` (Zod).
3. **Embeddings (`backend/src/services/embedding.service.ts` — `generateEmbedding`):**
   - Calls `ai.models.embedContent({ model: GEMINI_EMBEDDING_MODEL ?? 'gemini-embedding-001' })`. Returns a 768-dim zero vector fallback if `GEMINI_API_KEY` is missing or fails.
4. **Autonomous Sales Agent (`backend/src/services/agent/agentRuntime.ts`):**
   - Uses Gemini function calling with `AGENT_FUNCTION_DECLARATIONS` in a bounded 5-round loop, with DB-grounded fallback `generateConsultativeFallback()` if the LLM is unavailable.
5. **Cost Tracking (`backend/src/services/costTracker.service.ts`):**
   - `recordGeminiCost()` logs token usage and COGS per `organizationId` into `ProviderCostEvent`.
