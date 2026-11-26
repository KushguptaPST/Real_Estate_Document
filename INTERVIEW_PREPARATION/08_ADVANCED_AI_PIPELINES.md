# 08 — Advanced AI Pipelines & Sequence Diagrams

## 1. Omnichannel Agentic Execution Sequence

```mermaid
sequenceDiagram
    participant Buyer as Buyer (WhatsApp/TG/Widget/Voice)
    participant WH as Webhook / Gateway
    participant Orch as orchestrator.ts (Supervisor)
    participant Mem as buyerMemory.service.ts
    participant RT as agentRuntime.ts (Max 5 Rounds)
    participant Tools as agentTools.ts (Zod + TrustedContext)
    participant Outbox as outboxDispatcher.ts

    Buyer->>WH: Sends message ("Looking for 3BHK in Indiranagar, 2Cr")
    WH->>Mem: assembleBuyerMemory(leadId, organizationId)
    WH->>Orch: routeToSpecialist(ctx)
    Orch-->>RT: SpecialistDirective (QUALIFIER + channel rules)
    loop Up to MAX_AGENT_ROUNDS = 5
        RT->>Tools: executeAgentTool("propose_buyer_requirements", args, trustedCtx)
        Tools-->>RT: Proposal saved
        RT->>Tools: executeAgentTool("search_properties", args, trustedCtx)
        Tools-->>RT: Verified DB properties
    end
    RT->>Orch: verifyAgentOutput(draft, verifiedTitles, channel)
    Orch-->>RT: Guardrail-checked response
    RT->>Outbox: queueMessageDispatch(messageId, organizationId)
    Outbox->>Buyer: Idempotent delivery via channel provider
```

---

## 2. Transactional Outbox Pattern (`backend/src/services/messaging/outboxDispatcher.ts`)
- **Problem:** Sending an external WhatsApp/Email inside a DB transaction can cause split-brain (message sent, DB rolls back; or DB commits, network fails).
- **Solution:** `queueMessageDispatch()` checks `OutboxJob` by `messageId`, then runs `prisma.$transaction()` to atomically set `ConversationMessage.deliveryStatus = 'QUEUED'` and insert `OutboxJob` with `idempotencyKey = "dispatch-" + messageId`. Retries use bounded exponential backoff.

## 3. Live Voice & Neural TTS Pipelines
- **Plivo Voice (`backend/src/services/telephony/plivoStreamGateway.ts`):** Handles `/ws/plivo/:sessionId` bidirectional audio streaming and `/api/webhooks/plivo` call lifecycle (`VoiceCallSession`).
- **Voice Notes (`backend/src/services/voice/voiceNote.service.ts` & `transcription.service.ts`):** Uses `msedge-tts` for neural voice synthesis on Telegram and transcribes incoming buyer voice notes.
- **Human Takeover:** When an advisor takes over a thread (`ConversationThread.isHumanTakeover = true`), `agentRuntime` suppresses autonomous replies so human and AI never collide.
