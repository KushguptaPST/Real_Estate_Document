# API Design & Interface Specifications
## Contingency Deadline Copilot & Real Estate AI Platform

**Document Version:** 1.0.0  
**Base URL:** `/api`  
**Protocol:** HTTPS / JSON / Server-Sent Events (SSE)  
**Status:** Baseline Verified  
**Primary Architect:** Principal Software Systems Architect  

---

## 1. Global API Standards & Conventions

### 1.1 Authentication & Header Invariants
- **Session Authentication:** `Authorization: Bearer <session_jwt>` required on all protected endpoints.
- **Server-to-Server Intake:** `X-Api-Key: <org_api_key>` required on `/api/leads/inbound` and `/api/inbound/email`.
- **HMAC Signatures:** `X-Webhook-Signature: <hex_digest>` required on JSON webhook endpoints; Svix headers (`svix-id`, `svix-timestamp`, `svix-signature`) required on Resend webhooks.

### 1.2 Error Envelope Format
All error responses adhere to a normalized JSON format:
```json
{
  "error": {
    "message": "Human readable error description",
    "code": "OPTIONAL_ERROR_CODE",
    "details": {}
  }
}
```

---

## 2. API Endpoint Inventory

### 2.1 Authentication & Organization Endpoints

#### `POST /api/auth/google`
- **Purpose:** Authenticates a user using a Google Identity Services credential token.
- **Auth:** Public.
- **Payload:** `{ "credential": "<idToken>", "inviteToken": "<optionalToken>" }`
- **Response (200):** `{ "token": "<sessionJwt>", "user": { "id": "...", "email": "...", "organizationId": "...", "role": "OWNER" } }`
- **Errors:** 401 (Invalid Google credential), 403 (Account lacks org membership), 409 (Email conflict).

#### `POST /api/auth/demo`
- **Purpose:** Sandbox login for demo agent (`demo-google-agent-sub-1001`).
- **Auth:** Public (Gated behind `ENABLE_DEMO_LOGIN=true`, blocked in production).
- **Response (200):** `{ "token": "<jwt>", "user": { ... } }`
- **Errors:** 404 (Route disabled in production).

#### `GET /api/auth/me`
- **Purpose:** Returns current authenticated user profile.
- **Auth:** `requireAuth`.
- **Response (200):** `{ "user": { ... } }`

#### `GET /api/org/members`
- **Purpose:** Lists all members within the authenticated user's organization.
- **Auth:** `requireAuth`.
- **Response (200):** `[ { "id": "...", "email": "...", "name": "...", "role": "OWNER" | "AGENT" } ]`

#### `POST /api/org/invitations`
- **Purpose:** Creates a one-time invitation token for joining the organization.
- **Auth:** `requireAuth` + `requireRole('OWNER')`.
- **Payload:** `{ "email": "advisor@example.com", "role": "AGENT" }`
- **Response (201):** `{ "id": "...", "email": "...", "inviteUrl": "https://.../login?invite=<token>" }`

#### `POST /api/org/api-keys`
- **Purpose:** Generates a high-entropy API key for automated lead ingestion.
- **Auth:** `requireAuth` + `requireRole('OWNER')`.
- **Payload:** `{ "name": "Website Form Webhook" }`
- **Response (201):** `{ "id": "...", "key": "org_live_...", "keyPrefix": "org_live_..." }`

---

### 2.2 Leads & Inbound Intake Endpoints

#### `POST /api/leads/inbound`
- **Purpose:** Server-to-server lead ingestion from external portals.
- **Auth:** `X-Api-Key` header with `lead_intake` scope.
- **Rate Limit:** 100 requests / minute per IP and key.
- **Payload:**
  ```json
  {
    "fullName": "Sarah Connor",
    "email": "sarah@example.com",
    "phone": "+14155552671",
    "source": "PORTAL_INQUIRY",
    "notes": "Interested in 3-bedroom properties in downtown."
  }
  ```
- **Response (202):** `{ "received": true }` (Never leaks internal IDs or existence).
- **Side Effects:** Triggers atomic upsert, extracts initial requirements proposal, computes property matches.

#### `GET /api/leads`
- **Purpose:** Lists leads for the organization with search, status, priority, and assignment filters.
- **Auth:** `requireAuth`.
- **Query Params:** `search`, `status`, `priority`, `assignedUserId`, `unassigned` (`true` | `false`).
- **Response (200):** Array of `Lead` objects with nested requirements and assigned agent.

#### `GET /api/leads/:id`
- **Purpose:** Retrieves full details for a lead.
- **Auth:** `requireAuth` (Scaped to `req.user.organizationId`).
- **Response (200):** Detailed `Lead` object.
- **Errors:** 404 (Lead not found in this organization).

#### `POST /api/leads/:id/claim`
- **Purpose:** Allows an agent to atomically claim an unassigned lead.
- **Auth:** `requireAuth`.
- **Payload:** `{ "reason": "Self-assigned from pool" }`
- **Response (200):** Updated `Lead` object.
- **Errors:** 409 (Lead already claimed by another agent).

#### `POST /api/leads/:id/reassign`
- **Purpose:** Reassigns a lead to another advisor.
- **Auth:** `requireAuth` (`OWNER` can reassign any lead; `AGENT` can only reassign leads assigned to them).
- **Payload:** `{ "targetUserId": "<userId>", "reason": "Territory transfer" }`
- **Response (200):** Updated `Lead` object.

#### `POST /api/leads/:id/calls`
- **Purpose:** Records an inbound or outbound call log.
- **Auth:** `requireAuth`.
- **Payload:**
  ```json
  {
    "direction": "OUTBOUND",
    "outcome": "CONNECTED",
    "durationSeconds": 180,
    "notes": "Discussed pre-approval status. Budget confirmed at $850k.",
    "followUpNeeded": true,
    "followUpDate": "2026-10-20T15:00:00Z"
  }
  ```
- **Response (201):** Created `LeadCallLog` object.

#### `POST /api/leads/:id/convert-to-deal`
- **Purpose:** Atomically converts a qualified lead into an active contract deal.
- **Auth:** `requireAuth` (Agent must be assigned to lead; Owner authorized across all leads).
- **Payload:**
  ```json
  {
    "propertyId": "prop_123",
    "propertyAddress": "742 Evergreen Terrace, Springfield",
    "buyerName": "Homer Simpson",
    "acceptanceDate": "2026-10-15",
    "timezone": "America/New_York"
  }
  ```
- **Response (201):** `{ "deal": { ... }, "lead": { ... }, "contingencyStatus": "PENDING_DOCUMENT_UPLOAD" }`
- **Errors:** 400 (Lead not in QUALIFIED stage), 404 (Lead/Property not found), 409 (Lead already converted).

---

### 2.3 Conversations & AI Copilot Endpoints

#### `GET /api/leads/:id/conversations`
- **Purpose:** Retrieves the active conversation thread and messages for a lead.
- **Auth:** `requireAuth` (Scaped to assigned agent or owner).
- **Response (200):** `ConversationThread` object with ordered `messages`.

#### `POST /api/leads/:id/conversations/messages`
- **Purpose:** Ingests customer inbound message or simulates client chat in dev.
- **Auth:** `requireAuth` (Blocked in production unless `ENABLE_CUSTOMER_SIMULATION=true`).
- **Payload:** `{ "content": "I am looking for a 3BHK in Indiranagar under 2 Cr.", "channel": "EMAIL" }`
- **Response (201):** Returns customer message and queued AI draft/reply.

#### `POST /api/leads/:id/conversations/messages/agent`
- **Purpose:** Sends an authenticated human advisor reply.
- **Auth:** `requireAuth`.
- **Payload:** `{ "content": "Hi Sarah, I will check with the seller and call you at 4 PM.", "channel": "EMAIL" }`
- **Response (201):** Created message with `senderType: AGENT`.

#### `POST /api/leads/:id/conversations/takeover`
- **Purpose:** Toggles human takeover mode to suppress autonomous AI messaging.
- **Auth:** `requireAuth`.
- **Payload:** `{ "isHumanTakeover": true }`
- **Response (200):** Updated `ConversationThread`.

#### `PATCH /api/leads/:id/conversations/messages/:msgId`
- **Purpose:** Reviews, approves, modifies, or rejects an AI message draft.
- **Auth:** `requireAuth`.
- **Payload:** `{ "status": "APPROVED", "editedContent": "..." }`
- **Response (200):** Enqueues message into `outbox_jobs` if approved.

---

### 2.4 Site Visits & Showing Scheduling Endpoints

#### `GET /api/site-visits/availability`
- **Purpose:** Checks advisor calendar availability for a proposed showing window.
- **Auth:** `requireAuth`.
- **Query Params:** `startAt`, `endAt`, `advisorId`.
- **Response (200):** `{ "available": true, "conflicts": [] }`

#### `POST /api/leads/:id/site-visits`
- **Purpose:** Schedules a property showing appointment.
- **Auth:** `requireAuth`.
- **Payload:**
  ```json
  {
    "propertyId": "prop_123",
    "assignedUserId": "user_456",
    "startAt": "2026-10-18T10:00:00Z",
    "endAt": "2026-10-18T11:00:00Z",
    "meetingLocation": "Property Front Gate",
    "notes": "Client requested viewing the clubhouse."
  }
  ```
- **Response (201):** Created `SiteVisit` record.
- **Errors:** 409 (Advisor has conflicting appointment in that window).

---

### 2.5 Deals, Documents & Contingencies Endpoints

#### `GET /api/deals`
- **Purpose:** Lists all deals for the organization.
- **Auth:** `requireAuth`.
- **Response (200):** Array of `Deal` records with deadline counts.

#### `POST /api/deals`
- **Purpose:** Creates a new deal directly.
- **Auth:** `requireAuth`.
- **Payload:** `{ "propertyAddress": "123 Ocean Drive, Miami", "acceptanceDate": "2026-10-12" }`
- **Response (201):** Created `Deal`.

#### `POST /api/deals/:id/documents`
- **Purpose:** Uploads a PDF contract and executes Gemini AI clause extraction.
- **Auth:** `requireAuth`.
- **Content-Type:** `multipart/form-data` (Single file upload, field name `file`).
- **Response (201):** Created `Document` record with extracted clauses and computed deadlines.
- **Errors:** 400 (Missing file or invalid PDF magic bytes).

#### `GET /api/deals/:id/deadlines`
- **Purpose:** Lists all contingency deadlines for a deal.
- **Auth:** `requireAuth`.
- **Response (200):** Array of `Deadline` records with computed and confirmed dates.

#### `PATCH /api/deals/:id/deadlines/:dId`
- **Purpose:** Confirms or manually edits a contingency deadline date.
- **Auth:** `requireAuth`.
- **Payload:** `{ "confirmedDate": "2026-10-25T17:00:00Z", "activate": true }`
- **Response (200):** Updated `Deadline` record; creates `AuditLog` entry.

---

### 2.6 AI Knowledge Assistant (RAG) Endpoints

#### `POST /api/deals/:id/assistant/ask`
- **Purpose:** Answers contract questions with verifiable deep citations.
- **Auth:** `requireAuth`.
- **Headers:** `Accept: text/event-stream` (optional for SSE streaming).
- **Payload:** `{ "question": "What is the inspection contingency period and who pays for repairs?" }`
- **Response (JSON or SSE):**
  ```json
  {
    "answer": "The inspection contingency period is 10 calendar days...",
    "citations": [
      {
        "documentName": "Purchase_Agreement.pdf",
        "pageNumber": 4,
        "exactQuote": "Buyer shall have 10 calendar days after Acceptance...",
        "verified": true
      }
    ],
    "suggestedFollowUps": ["Who is responsible for termite inspection?"]
  }
  ```

---

### 2.7 External Webhooks API

#### `POST /api/webhooks/resend`
- **Purpose:** Receives delivery, open, and bounce events from Resend.
- **Auth:** Svix constant-time signature verification (`svix-id`, `svix-timestamp`, `svix-signature`).
- **Payload:** Standard Resend event payload.
- **Response (200):** `{ "received": true }`
- **Side Effects:** Idempotent deduplication in `webhook_events`, updates `conversation_messages.deliveryStatus`.

#### `POST /api/inbound/email`
- **Purpose:** SendGrid Inbound Parse multipart webhook for direct contract upload via email.
- **Auth:** Shared secret verification (`x-inbound-secret` or `?secret=`).
- **Payload:** `multipart/form-data` with raw email body, sender, and attached PDF.
- **Response (200):** `{ "status": "processed" }`
