# Dual-Channel AI Real Estate Sales Operating System: Architecture Specification

**Channels Supported**:
1. **Inbound Channel**: Meta Lead Ads (Instant Forms), Click-to-WhatsApp (CTWA), Direct WhatsApp Inquiries, 99acres, Magicbricks, Housing.com.
2. **Outbound Channel**: Cold City Phone Databases (CSV Upload), Channel Partner Lists, Expo Inquiries.

---

## 1. Core Architectural Principle: Unified Downstream, Specialized Ingestion

Both channels feed into a single database core, AI reasoning engine, and CRM workflow, but operate under strictly isolated ingestion, compliance, and initial contact policies:

```mermaid
flowchart TD
    subgraph Channel 1: Inbound Pipeline (Speed to Lead)
        I1["Meta Ad Click / Portal Inquiry"] --> I2["Inbound Webhook Adapter"]
        I2 --> I3["Auto-Set Priority: HIGH / URGENT"]
        I3 --> I4["Preserve Project/Ad Context (e.g. Godrej 3BHK)"]
        I4 --> I5["Meta 24h Window Open -> Instant WhatsApp Dispatch (<45s)"]
        I5 --> I6["AI Contextual Dialogue (agentRuntime.ts)"]
    end

    subgraph Channel 2: Outbound Pipeline (Cold Database Compliance)
        O1["Bulk CSV Upload (Bangalore/Pune)"] --> O2["Phone Normalization (+91)"]
        O2 --> O3["DND Registry Scrubber"]
        O3 -->|DND Active| O4["Mark DND_ACTIVE -> Block Auto-Dial"]
        O3 -->|Clean| O5["Auto-Set Priority: LOW, Unqualified"]
        O5 --> O6["HARD GUARD: Block Freeform WhatsApp"]
        O6 --> O7["Voice Touch (1-Click Preview Dialer / AI Voice Agent)"]
        O7 -->|Customer: 'Send details on WhatsApp'| O8["Mark VOICE_CALL_OPT_IN -> Release WhatsApp Collateral"]
        O7 -->|Customer: 'Not interested / Don't call'| O9["Mark OPTED_OUT -> Archive"]
    end

    subgraph Shared Downstream Infrastructure (Zero Duplication)
        I6 --> S1["Property Matcher & Inventory Engine (propertyMatch.service.ts)"]
        O8 --> S1
        S1 --> S2["Live Advisor Calendar Slot Verification"]
        S2 --> S3["Site Visit Scheduled (siteVisit.service.ts)"]
        S3 --> S4["Advisor Mobile Pocket Dossier Dispatch"]
        S4 --> S5["Human Senior Advisor: In-Person Site Visit & Booking Close"]
    end
```

---

## 2. Channel Comparison & Enforcement Matrix

| Dimension | Inbound Channel | Outbound Channel |
|---|---|---|
| **Sources** | Meta Lead Ads, CTWA, WhatsApp Organic, 99acres, Magicbricks | Cold CSV Database, CP Lists, Past Inquiries |
| **Initial Priority** | `HIGH` or `URGENT` | `LOW` (Unqualified) |
| **Initial Touchpoint** | WhatsApp (Meta 24-hr session or Approved Template) | Voice Telephony (Human 1-Click Dialer / Voice Agent) |
| **WhatsApp Permission** | Permitted (Customer initiated or explicit lead form consent) | **BLOCKED** until verbal or SMS opt-in confirmed |
| **Target Response SLA** | **< 45 seconds** (Speed to Lead) | Scheduled batch dialing during legal TRAI hours (9:30 AM – 7:30 PM) |
| **Context Awareness** | Injects Ad ID, Campaign Name, Project Name into LLM prompt | Generic discovery of buyer requirements |
| **Compliance Requirement** | Meta Cloud API Messaging Policy, 24-hour service window | TRAI National DND (NDNC) scrubbing, Telecom commercial regulations |

---

## 3. Database Schema Specification (`backend/prisma/schema.prisma`)

```prisma
// ─── Channel & Attribution Enums ──────────────────────────────────────────────
enum ChannelType {
  INBOUND
  OUTBOUND
}

enum InboundSource {
  META_LEAD_AD          // Facebook/Instagram Instant Forms
  META_CLICK_TO_WHATSAPP // CTWA direct ad click
  WHATSAPP_ORGANIC      // Direct customer chat
  PORTAL_99ACRES        // 99acres inquiry push
  PORTAL_MAGICBRICKS    // Magicbricks inquiry push
  PORTAL_HOUSING        // Housing.com developer API
  WEBSITE_FORM          // Direct landing page
}

enum OutboundSource {
  COLD_DATABASE_UPLOAD  // Bought city database (CSV)
  CHANNEL_PARTNER_LIST  // Brokerage network list
  OFFLINE_EVENT_EXPO    // Property expo / walk-in database
  PAST_BUYER_REFERRAL   // Old customer database
}

enum ConsentStatus {
  EXPLICIT_OPT_IN       // Clicked CTWA / submitted form with phone
  VOICE_CALL_OPT_IN     // Answered cold call & asked for WhatsApp brochure
  UNVERIFIED            // Cold contact (no consent yet)
  OPTED_OUT             // Customer said "Stop", "Don't call", DND
}

enum DndStatus {
  SCRUBBED_CLEAN        // Verified not on TRAI National DND
  DND_ACTIVE            // Registered on NDNC (Do Not Call)
  UNCHECKED             // Freshly uploaded
}

// ─── Lead Model Enhancements ──────────────────────────────────────────────────
model Lead {
  id             String       @id @default(cuid())
  organizationId String?
  fullName       String
  email          String?
  phone          String?
  status         LeadStatus   @default(NEW)
  priority       LeadPriority @default(MEDIUM)
  assignedUserId String?

  // 1. Channel Separation
  channelType    ChannelType  @default(INBOUND)
  inboundSource  InboundSource?
  outboundSource OutboundSource?

  // 2. Inbound Campaign & Ad Attribution (Zero Context Loss)
  targetProjectId String?     // e.g. "Godrej Splendour" or linked Property ID
  campaignName    String?     // e.g. "Bangalore Q4 High-Intent 3BHK"
  adId            String?     // Meta Ad ID
  adName          String?     // e.g. "Godrej_Splendour_TowerB_Video"
  formId          String?     // Meta Instant Form ID
  utmSource       String?
  utmMedium       String?
  utmCampaign     String?

  // 3. Indian Telecom, Consent & DND Compliance
  consentStatus   ConsentStatus @default(UNVERIFIED)
  consentEvidence String?       // e.g. Meta Lead ID or WhatsApp Message ID
  consentAt       DateTime?
  dndStatus       DndStatus     @default(UNCHECKED)
  dndCheckedAt    DateTime?
  callAttemptsCount Int         @default(0)
  lastCalledAt    DateTime?
  doNotContact    Boolean       @default(false)

  // Downstream Shared Infrastructure (Unchanged)
  organization  Organization?              @relation(fields: [organizationId], references: [id])
  assignedUser  User?                      @relation(fields: [assignedUserId], references: [id])
  requirements  LeadRequirement?
  proposals     LeadRequirementProposal[]
  conversations ConversationThread[]
  matches       PropertyMatch[]
  callLogs      LeadCallLog[]
  tasks         LeadTask[]
  siteVisits    SiteVisit[]
  deal          Deal?

  @@index([organizationId, channelType, status])
  @@index([organizationId, consentStatus])
  @@index([organizationId, dndStatus])
  @@index([phone])
}
```

---

## 4. API & Integration Endpoints

### 4.1 Inbound Endpoints
* `POST /api/webhooks/meta-leads`:
  * Validates Meta `X-Hub-Signature-256`.
  * Fetches lead metadata from Meta Graph API (`GET /{leadgen_id}`).
  * Extracts customer full name, phone number, and campaign ad info.
  * Ingests lead as `INBOUND`, `META_LEAD_AD`, sets `consentStatus = EXPLICIT_OPT_IN`, and triggers outbox greeting within 45s.
* `POST /api/webhooks/whatsapp`:
  * Handles CTWA referral metadata (`change.messages[0].referral`).
  * Ingests lead as `INBOUND`, `META_CLICK_TO_WHATSAPP`.
  * Passes ad context into `agentRuntime.ts`.
* `POST /api/webhooks/portals`:
  * Ingestion adapter for 99acres, Magicbricks, and Housing.com lead webhooks.

### 4.2 Outbound Endpoints
* `POST /api/leads/bulk-upload`:
  * Ingests CSV files of cold phone numbers.
  * Normalizes phone numbers (`+91XXXXXXXXXX`).
  * Deduplicates against existing database by phone number.
  * Marks `channelType = OUTBOUND`, `consentStatus = UNVERIFIED`, `priority = LOW`.
* `POST /api/voice/plivo/outbound`:
  * 1-Click preview dialer for human advisors or authorized voice pre-qualification.
  * Logs call attempt into `LeadCallLog`.
  * Exposes toggle to record `VOICE_CALL_OPT_IN` to safely unlock WhatsApp collateral delivery.

---

## 5. Safety & Anti-Ban Guard Implementation

To prevent Meta from banning the organization's WhatsApp Business Account:

```typescript
// backend/src/services/messaging/safetyGuard.ts
export function assertWhatsAppDispatchAllowed(lead: {
  channelType: 'INBOUND' | 'OUTBOUND';
  consentStatus: 'EXPLICIT_OPT_IN' | 'VOICE_CALL_OPT_IN' | 'UNVERIFIED' | 'OPTED_OUT';
  doNotContact: boolean;
}): void {
  if (lead.doNotContact || lead.consentStatus === 'OPTED_OUT') {
    throw new Error('Customer has opted out of communication. WhatsApp dispatch blocked.');
  }

  if (lead.channelType === 'OUTBOUND' && lead.consentStatus === 'UNVERIFIED') {
    throw new Error(
      'Spam Prevention Policy: Unsolicited WhatsApp messages to unverified outbound contacts are strictly prohibited. Voice opt-in required.'
    );
  }
}
```

---

## 6. Development Priorities Roadmap

1. **Phase 1: Database Migration & Inbound Meta Lead Ads Engine**
   - Apply Prisma schema migration adding `ChannelType`, `InboundSource`, `OutboundSource`, `ConsentStatus`, and `DndStatus`.
   - Build `/api/webhooks/meta-leads` endpoint with Graph API leadgen retrieval.
   - Inject ad context into `agentRuntime.ts` prompt to eliminate redundant questions.
   - Update `propertyMatch.service.ts` to format prices natively in Indian Lakhs/Crores (`₹`).

2. **Phase 2: Outbound Engine & Meta Spam Guard**
   - Implement `assertWhatsAppDispatchAllowed` safety guard in `outboxDispatcher.ts`.
   - Re-enable and upgrade `CsvImportModal` in frontend with client-side CSV parsing and E.164 phone normalization.
   - Add "Voice Opt-In Confirmed" button in `LeadDetailPage` to transition cold leads to WhatsApp-enabled.

3. **Phase 3: Portal Connectors & Advisor Pocket Dossier**
   - Deploy webhook adapters for 99acres and Magicbricks.
   - Implement mobile-first Advisor Pocket Dossier tab for on-site visit preparation.
   - Implement automated site visit no-show recovery sequence.

