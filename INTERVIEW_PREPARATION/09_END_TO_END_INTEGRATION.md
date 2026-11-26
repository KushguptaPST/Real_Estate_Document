# 09 — Complete End-to-End Integration

## Trace 1: Contract PDF Upload → Deal Assistant Answer → Highlighted PDF

1. **Frontend (`UploadZone.tsx` → `api.ts`):** User selects a PDF; `api.ts` sends `POST /api/deals/:id/documents` with `Authorization: Bearer <JWT>` and `multipart/form-data`.
2. **Middleware (`auth.ts` → `upload.ts`):** `requireAuth` validates JWT + DB `sessionVersion`. `multer` checks `application/pdf` and $\le 50\text{MB}$, writing to `backend/uploads/`.
3. **Storage & Extraction (`storage.service.ts` → `pdf.service.ts` → `ai.service.ts`):**
   - Stores file locally or uploads private file to ImageKit.
   - `extractPagesFromPdf()` extracts text per page (with Gemini Vision OCR fallback for scanned pages).
   - `chunkDocumentPages()` chunks into $\le 600$-token sections; `embedding.service.ts` generates embeddings; chunks saved to `DocumentChunk` with `organizationId`.
   - `extractClausesFromPdf()` extracts contingency clauses (`numberOfDays`, `dayType`); `dateEngine.service.ts` computes statutory dates into `Deadline` rows (`PENDING`).
4. **User Asks a Question (`AssistantPage.tsx` → `POST /api/deals/:id/assistant`):**
   - `askDealAssistant()` calls `requireOrgId()` → `retrieveRelevantChunks()` (`full_context` or `hybrid_retrieval`) → Gemini (`<<DOC_DATA>>` guard + `assistantJsonSchema`) → `verifyCitations()`.
5. **Frontend Rendering (`ChatWindow.tsx` → `PdfViewer.tsx`):**
   - Renders answer with clickable `CitationChip` (`[^1]`). Clicking navigates `PdfViewer` to `pageNumber` and `quoteMatcher.ts` highlights the exact verbatim text.

---

## Trace 2: Inbound WhatsApp Message → AI Reply → Outbox Delivery

1. **Webhook (`webhooks/whatsapp.ts`):** Meta sends `POST /api/webhooks/whatsapp`. Express `rawBody` is verified against `X-Hub-Signature-256`.
2. **Lead & Thread Resolution:** Finds or creates `Lead` (scoped to `organizationId`) and `ConversationThread`. Checks `isHumanTakeover` and `doNotCall`.
3. **Orchestration & Execution:** `routeToSpecialist()` selects specialist (`QUALIFIER`/`MATCHER`/`CLOSER`/`DOCS_RAG`/`ESCALATION`). `agentRuntime.ts` runs up to 5 Gemini tool rounds using `TrustedAgentContext`.
4. **Guardrail & Persistence:** `verifyAgentOutput()` checks output; `AgentRunTrace` and `ConversationMessage` are saved.
5. **Outbox Dispatch:** `queueMessageDispatch()` atomically creates `OutboxJob` (`idempotencyKey = "dispatch-" + messageId`) and dispatches via `whatsapp.service.ts`.
