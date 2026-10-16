# End-to-End Data Flows & Sequence Workflows
## Contingency Deadline Copilot & Real Estate AI Platform

**Document Version:** 1.0.0  
**Status:** Baseline Verified  
**Primary Architect:** Principal Software Systems Architect  

---

## Workflow 1: Inbound Lead Intake & Ingestion

```mermaid
sequenceDiagram
    autonumber
    actor Provider as Lead Source / Portal
    participant API as Inbound Gateway (leads.ts / inbound.ts)
    participant Auth as ApiKeyResolver
    participant LeadSvc as LeadService
    participant DB as PostgreSQL (Prisma)
    participant Matcher as PropertyMatchService

    Provider->>API: POST /api/leads/inbound (X-Api-Key, Payload)
    API->>Auth: resolveApiKey(key, 'lead_intake')
    alt Invalid or Revoked Key
        Auth-->>API: null
        API-->>Provider: 401 Unauthorized
    else Valid Key
        Auth-->>API: { organizationId, keyId }
        API->>LeadSvc: ingestInboundLead(data, organizationId)
        LeadSvc->>DB: Atomic Upsert (WHERE organizationId, email/phone)
        alt Concurrent Race Detected
            DB-->>LeadSvc: P2002 Unique Violation
            LeadSvc->>DB: Fallback to findFirst and update
        end
        DB-->>LeadSvc: Lead Record
        LeadSvc->>Matcher: computeMatchesForLead(lead.id, organizationId)
        Matcher->>DB: SQL Hard Filter (AVAILABLE, price <= maxBudget, beds >= minBeds)
        Matcher->>DB: Store PropertyMatch Records
        LeadSvc-->>API: Ingestion Success
        API-->>Provider: 202 Accepted { "received": true }
    end
```

### Flow Specifications:
- **Trigger:** External real estate portal or form sends lead inquiry.
- **Entry Point:** `POST /api/leads/inbound` or `POST /api/inbound/email`.
- **Validation:** Rate limiter (100 req/min), `X-Api-Key` cryptographic lookup, Zod schema parsing.
- **Database Operations:** Upsert into `leads`, create `lead_requirements`, create `property_matches`, write `audit_logs`.
- **Edge Cases:** Concurrent duplicate submissions trigger PostgreSQL unique index violation `P2002` and safely resolve to an update without duplicating rows.

---

## Workflow 2: Multi-Channel Customer Messaging & AI Copilot Loop

```mermaid
sequenceDiagram
    autonumber
    actor Customer as Home Buyer (Client)
    participant Gateway as Messaging / Webhook Gateway
    participant ConvSvc as ConversationService
    participant Agent as AgentRuntime (Loop <= 5)
    participant Tools as AgentTools
    participant DB as PostgreSQL (Prisma)
    actor Advisor as Human Agent (Advisor)

    Customer->>Gateway: Sends Message (Email / Web Chat / Telegram)
    Gateway->>ConvSvc: handleCustomerMessage(leadId, content, channel)
    ConvSvc->>DB: Find ConversationThread
    ConvSvc->>DB: Insert ConversationMessage (senderType: CUSTOMER)
    
    alt isHumanTakeover == true OR autoReplyEnabled == false
        ConvSvc-->>Gateway: Autonomous reply suppressed (Human takeover active)
    else Autopilot Active
        ConvSvc->>Agent: runSalesAgentLoop(leadId, content)
        loop Max 5 Bounded Rounds
            Agent->>Agent: Generate Tool Call (search_properties / check_site_visit_availability)
            Agent->>Tools: executeAgentTool(toolName, args)
            Tools->>DB: Scoped Query (WHERE organizationId = ?)
            DB-->>Tools: Grounded DB Results
            Tools-->>Agent: Tool Response Data
        end
        Agent-->>ConvSvc: Suggested Reply & Reasoning
        ConvSvc->>DB: Insert ConversationMessage (senderType: AI, approvalStatus: PENDING_APPROVAL)
        ConvSvc-->>Gateway: AI Draft Created
    end

    Advisor->>ConvSvc: PATCH /messages/:id (status: APPROVED)
    ConvSvc->>DB: Atomically Enqueue OutboxJob & update message status
```

### Flow Specifications:
- **Trigger:** Customer inbound message.
- **Entry Point:** `POST /api/leads/:id/conversations/messages` or Telegram long-polling update.
- **Safety Safeguards:**
  - If `isHumanTakeover = true`, autonomous AI responses are completely suppressed.
  - LLM execution is bounded to `MAX_AGENT_ROUNDS = 5`.
  - AI responses generate with `PENDING_APPROVAL` status, preventing unvetted customer dispatch.

---

## Workflow 3: Site Visit Scheduling & Conflict Resolution

```mermaid
sequenceDiagram
    autonumber
    actor Agent as Real Estate Agent
    participant Route as SiteVisitsRoute
    participant VisitSvc as SiteVisitService
    participant TimezoneUtil as TimezoneUtility
    participant DB as PostgreSQL (Prisma)

    Agent->>Route: POST /api/leads/:id/site-visits
    Route->>VisitSvc: scheduleSiteVisit(leadId, startAt, endAt, advisorId)
    VisitSvc->>TimezoneUtil: parseLocalDateTimeToUtc(date, time, timezone)
    alt Nonexistent or Ambiguous DST Time
        TimezoneUtil-->>VisitSvc: Throws DST Error
        VisitSvc-->>Route: 400 Bad Request (Ambiguous daylight saving time)
    else Valid UTC Instant
        TimezoneUtil-->>VisitSvc: Valid Date
        VisitSvc->>DB: Query Overlapping Visits (status: SCHEDULED, advisorId)
        alt Conflict Found
            DB-->>VisitSvc: Existing Visit
            VisitSvc-->>Route: 409 Conflict (Advisor busy)
        else Slot Available
            VisitSvc->>DB: Create SiteVisit Record
            VisitSvc->>DB: Create LeadTask (taskType: SITE_VISIT)
            VisitSvc->>DB: Record AuditLog (SITE_VISIT_SCHEDULED)
            VisitSvc-->>Route: Created SiteVisit
            Route-->>Agent: 201 Created
        end
    end
```

---

## Workflow 4: Outbound Message Dispatch via Transactional Outbox

```mermaid
sequenceDiagram
    autonumber
    actor Agent as Human Advisor
    participant ConvCtrl as ConversationsController
    participant Outbox as OutboxDispatcher
    participant DB as PostgreSQL (Prisma)
    participant Provider as Messaging Provider (Resend)
    actor Gateway as Resend Svix Webhook

    Agent->>ConvCtrl: PATCH /api/leads/:id/conversations/messages/:msgId (APPROVED)
    ConvCtrl->>Outbox: queueMessageDispatch(messageId, leadId)
    Outbox->>DB: $transaction: Update Message (QUEUED) & Insert OutboxJob (PENDING)
    ConvCtrl-->>Agent: 200 OK (Message Queued)

    Note over Outbox,Provider: Asynchronous Outbox Worker Cycle
    Outbox->>DB: Claim Jobs (UPDATE status=PROCESSING, lockedAt=now() WHERE status=PENDING)
    DB-->>Outbox: Claimed OutboxJobs
    Outbox->>Provider: POST https://api.resend.com/emails
    alt Transient Error (429 / 5xx)
        Provider-->>Outbox: 500 Server Error
        Outbox->>DB: UPDATE OutboxJob (status=RETRYING, attempts+1, nextAttemptAt=now()+backoff)
    else Delivery Success
        Provider-->>Outbox: 200 OK { id: "resend_123" }
        Outbox->>DB: UPDATE OutboxJob (COMPLETED) & Message (SENT, providerMessageId)
    end

    Gateway->>ConvCtrl: POST /api/webhooks/resend (Svix Headers, Payload)
    ConvCtrl->>DB: Verify Svix Signature & Deduplicate WebhookEvent
    ConvCtrl->>DB: UPDATE ConversationMessage (deliveryStatus: DELIVERED, deliveredAt: now())
    ConvCtrl-->>Gateway: 200 OK
```

---

## Workflow 5: Lead-to-Deal Conversion

```mermaid
sequenceDiagram
    autonumber
    actor Agent as Real Estate Agent
    participant Ctrl as LeadController
    participant ConvertSvc as LeadConversionService
    participant DB as PostgreSQL (Prisma)

    Agent->>Ctrl: POST /api/leads/:id/convert-to-deal
    Ctrl->>ConvertSvc: convertLeadToDeal(params)
    ConvertSvc->>DB: Check Lead (status in QUALIFIED/PROPOSAL, assignedUserId == callerId)
    alt Unauthorized Agent or Ineligible Stage
        ConvertSvc-->>Ctrl: 403 Forbidden or 400 Bad Request
        Ctrl-->>Agent: Error Response
    else Eligible
        ConvertSvc->>DB: $transaction:
        Note over ConvertSvc,DB: 1. Check existing Deal.leadId (Race Defense)
        Note over ConvertSvc,DB: 2. Create Deal Record
        Note over ConvertSvc,DB: 3. Update Lead (status = WON)
        Note over ConvertSvc,DB: 4. Update Property (status = UNDER_CONTRACT)
        Note over ConvertSvc,DB: 5. Initialize NotificationSetting
        Note over ConvertSvc,DB: 6. Record AuditLog (DEAL_CREATED)
        DB-->>ConvertSvc: Transaction Committed
        ConvertSvc-->>Ctrl: Result { deal, lead }
        Ctrl-->>Agent: 201 Created
    end
```

---

## Workflow 6: PDF Upload, AI Clause Extraction & Deadline Calculation

```mermaid
sequenceDiagram
    autonumber
    actor TC as Transaction Coordinator
    participant DocCtrl as DocumentsController
    participant Storage as StorageService
    participant Gemini as Google Gemini AI
    participant DateEngine as DateEngineService
    participant DB as PostgreSQL (Prisma)

    TC->>DocCtrl: POST /api/deals/:id/documents (Multipart PDF)
    DocCtrl->>DocCtrl: Validate Magic Bytes (%PDF / 0x25 0x50 0x44 0x46)
    DocCtrl->>Storage: storeFile(pdfBuffer)
    Storage-->>DocCtrl: storagePath
    DocCtrl->>DB: Create Document Record (indexStatus: PENDING)

    DocCtrl->>Gemini: extractClausesFromPdf(filePath)
    Gemini-->>DocCtrl: Extracted Clauses (clauseType, rawText, numberOfDays, dayType)
    DocCtrl->>DB: Bulk Create ContingencyClause Records

    DocCtrl->>DateEngine: computeContractDeadline(acceptanceDate, days, dayType)
    Note over DateEngine: Calculates business days by skipping weekends and state public holidays
    DateEngine-->>DocCtrl: Computed Dates
    DocCtrl->>DB: Create Deadline Records (status: PENDING)
    DocCtrl->>DB: Record AuditLog (EXTRACTION_COMPLETED)
    DocCtrl-->>TC: 201 Created (Document, Clauses, Deadlines)
```

---

## Workflow 7: AI Knowledge Assistant RAG & Citation Verification

```mermaid
sequenceDiagram
    autonumber
    actor Agent as Real Estate Agent
    participant AssistantCtrl as AssistantController
    participant Retrieval as RetrievalService
    participant Gemini as Google Gemini AI
    participant CitationVerifier as CitationVerifierService
    participant DB as PostgreSQL (Prisma)

    Agent->>AssistantCtrl: POST /api/deals/:id/assistant/ask { question }
    AssistantCtrl->>Retrieval: retrieveRelevantChunks(dealId, query)
    Retrieval->>DB: Scoped Query (WHERE dealId = ? AND organizationId = ?)
    DB-->>Retrieval: DocumentChunk Records
    
    alt Total Tokens <= 120,000 (Full Context Mode)
        Retrieval-->>AssistantCtrl: Inject All Deal Pages in Prompt
    else Total Tokens > 120,000 (Hybrid Mode)
        Retrieval->>Retrieval: Cosine Similarity Vector Ranking + RRF
        Retrieval-->>AssistantCtrl: Top-K Chunks + Core Contracts
    end

    AssistantCtrl->>Gemini: generateContent(systemPrompt, context, question)
    Gemini-->>AssistantCtrl: Generated Answer + Candidate Citations
    
    AssistantCtrl->>CitationVerifier: verifyCitations(answer, candidateCitations, chunks)
    loop Every Citation
        CitationVerifier->>CitationVerifier: Normalize Text (NFKC, smart quotes, hyphenation)
        CitationVerifier->>CitationVerifier: Check Verbatim Substring on Target Page
    end
    CitationVerifier-->>AssistantCtrl: Verified Answer + Stripped Hallucinations
    AssistantCtrl->>DB: Store AssistantMessage (citations, content)
    AssistantCtrl-->>Agent: 200 OK (JSON or SSE stream)
```

---

## Workflow 8: Automated Deadline Alerts & Notification Cron Dispatch

```mermaid
sequenceDiagram
    autonumber
    participant Cron as Alert Cron Scheduler (Hourly)
    participant AlertSvc as AlertService
    participant DB as PostgreSQL (Prisma)
    participant EmailSvc as EmailService
    participant Resend as Resend / SendGrid API

    Cron->>AlertSvc: checkAndDispatchAlerts()
    AlertSvc->>DB: Acquire Advisory Lock (pg_try_advisory_xact_lock)
    AlertSvc->>DB: Query ACTIVE Deals + Deadlines + NotificationSettings
    
    loop Every Active Deal & Deadline
        AlertSvc->>AlertSvc: Compute diffDays = targetDate - now()
        AlertSvc->>AlertSvc: Evaluate Window (3d, 1d, dayOf, missed)
        AlertSvc->>DB: Check EmailLog (WHERE deadlineId = ? AND template = ?)
        alt Email Already Sent for Window
            Note over AlertSvc: Skip (Idempotent)
        else Unsent
            AlertSvc->>EmailSvc: sendEmail(to, templateHtml)
            EmailSvc->>Resend: POST /emails
            Resend-->>EmailSvc: 200 OK
            AlertSvc->>DB: Insert EmailLog (deadlineId, template, status: SENT)
            AlertSvc->>DB: Insert AuditLog (ALERT_SENT)
        end
    end
    AlertSvc-->>Cron: Evaluation Completed
```
