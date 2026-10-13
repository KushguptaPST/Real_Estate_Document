# UI Gaps, Incomplete Features & Blockers Report

**Repository:** `/Users/badal11/Desktop/Real_Estate_Contigency`  
**Document Status:** Complete Phase 4 Audit Deliverable  
**Audit Date:** October 2026  

---

## 1. Executive Summary

This report catalogues all identified gaps, disconnected UI components, hardcoded values, missing API integrations, and operational caveats found during the comprehensive inspection of the frontend and backend codebases.

Each finding includes its **Severity**, **User Impact**, **Exact Code Locations (File & Line Numbers)**, **Observed vs. Expected Behavior**, and a **Prioritized Remediation Recommendation**.

---

## 2. Identified Gaps & Defect Inventory

### GAP-01: Disconnected Organization Page (`/organization`)
- **Severity:** Medium
- **Category:** Disconnected UI / Mock State
- **Files Affected:**
  - `frontend/src/pages/OrganizationPage.tsx` (Lines 59–97)
  - `frontend/src/services/api.ts` (Lines 394–396)
  - `backend/src/api/routes/organization.ts` (Lines 38–130)
- **Observed Behavior:**  
  `OrganizationPage.tsx` defines local mock state for team members (`teamMembers` array initialized with Sarah Jenkins, Michael Vance, Elena Rostova), a hardcoded webhook secret (`whsec_copilot_b2b_9f8a7b6c5d4e3f2a1`), and mock white-label settings. Inviting a member or changing roles only mutates local React state.
- **Expected Behavior:**  
  The frontend should call `organizationApi.listMembers()`, `organizationApi.createInvitation()`, and `organizationApi.listApiKeys()` which are already fully implemented on the backend (`backend/src/api/routes/organization.ts`).
- **Remediation Plan:**
  1. Expand `organizationApi` in `frontend/src/services/api.ts` to expose `inviteMember`, `changeRole`, `removeMember`, and `listApiKeys`.
  2. Refactor `OrganizationPage.tsx` with a `useEffect` hook to fetch live team members and invitations from `GET /api/org/members`.

---

### GAP-02: Global Search Input in TopHeader (`TopHeader.tsx`)
- **Severity:** Low
- **Category:** Disconnected UI
- **Files Affected:**
  - `frontend/src/components/TopHeader.tsx` (Lines 13–17)
- **Observed Behavior:**  
  The global top header renders an attractive search input (`"Search transactions, properties, leads..."`), but the `<input>` element lacks `value`, `onChange`, or form submission handlers. Typing into this bar does not trigger any search or filter.
- **Expected Behavior:**  
  Typing into the global search bar should either navigate to a unified search results page or display an instant dropdown modal (command palette style) querying leads, properties, and transactions.
- **Remediation Plan:**
  Connect the input to a command-palette modal (e.g. `cmdk` or custom overlay) that queries `GET /api/leads?search=...`, `GET /api/properties?search=...`, and `GET /api/deals?search=...`.

---

### GAP-03: Hardcoded Role Badge in User Profile Menu (`UserMenu.tsx`)
- **Severity:** Low
- **Category:** Misleading UI Display
- **Files Affected:**
  - `frontend/src/components/UserMenu.tsx` (Line 85)
- **Observed Behavior:**  
  In the user profile dropdown, the role badge is hardcoded as `<Badge variant="outline">Brokerage Admin</Badge>`. Even when logged in as the Demo Agent Sarah Jenkins (`role: 'AGENT'`), the UI displays "Brokerage Admin".
- **Expected Behavior:**  
  The badge should dynamically read `user?.role === 'OWNER' ? 'Brokerage Admin' : 'Real Estate Advisor'`.
- **Remediation Plan:**
  Replace the static string at `UserMenu.tsx:85` with conditional role text based on `user?.role`.

---

### GAP-04: Hardcoded Organization Name in Sidebar (`Sidebar.tsx`)
- **Severity:** Low
- **Category:** Misleading UI Display
- **Files Affected:**
  - `frontend/src/components/Sidebar.tsx` (Line 65)
- **Observed Behavior:**  
  The sidebar header hardcodes `"Apex Brokerage Group"` as the brokerage brand name, regardless of which tenant is currently active (e.g. `demo-sandbox-org` is named "Demo Sandbox Brokerage").
- **Expected Behavior:**  
  The sidebar should render `user?.organizationName || 'Brokerage Workspace'`.
- **Remediation Plan:**
  Include `organizationName` in the `authApi.me()` response payload and display it dynamically in `Sidebar.tsx`.

---

### GAP-05: Native Browser `alert()` and `confirm()` Dialogs
- **Severity:** Medium
- **Category:** UX Consistency & Polish
- **Files Affected:**
  - `frontend/src/pages/PropertiesPage.tsx` (Line 89)
  - `frontend/src/pages/AnalyticsPage.tsx` (Line 171)
  - `frontend/src/pages/DealsPage.tsx` (Line 155)
  - `frontend/src/pages/DealDetailPage.tsx` (Line 180)
  - `frontend/src/pages/OrganizationPage.tsx` (Line 101, 107)
  - (Total 22 instances of `alert()` and 2 instances of `confirm()`)
- **Observed Behavior:**  
  Several catch blocks and mock action buttons trigger raw browser `alert(...)` or `window.confirm(...)` popups, which block the browser thread and look unpolished.
- **Expected Behavior:**  
  Use a modern, non-blocking toast notification library or styled confirmation modal.
- **Remediation Plan:**
  Replace raw `alert()` invocations with a lightweight toast notification component.

---

### GAP-06: Placeholder Export Actions on Analytics & Deals Pages
- **Severity:** Low
- **Category:** Incomplete Feature
- **Files Affected:**
  - `frontend/src/pages/AnalyticsPage.tsx` (Line 171)
  - `frontend/src/pages/DealsPage.tsx` (Line 155)
- **Observed Behavior:**  
  - On `/analytics`, clicking "Export Analytics" executes: `alert('Exporting Stripe Analytics...')`.
  - On `/deals`, clicking "Export Pipeline" executes: `alert('Exporting transaction pipeline summary (CSV)...')`.
- **Expected Behavior:**  
  Clicking export should generate and download a CSV file containing pipeline transactions or metrics.
- **Remediation Plan:**
  Implement client-side CSV export helpers that convert the active table data into a downloadable `.csv` blob.

---

### GAP-07: Static / Hardcoded KPI Metrics on Properties Page
- **Severity:** Low
- **Category:** Cosmetic / Static Data
- **Files Affected:**
  - `frontend/src/pages/PropertiesPage.tsx` (Lines 171, 182)
- **Observed Behavior:**  
  Top metric cards on `/properties` display hardcoded text:
  - "AI Match Rate: 94.8%" (static string)
  - "Marketing Kits: Ready" (static string)
- **Expected Behavior:**  
  Metrics should compute live figures (e.g. number of properties matched with at least one qualified lead).
- **Remediation Plan:**
  Calculate dynamic match coverage from the database or display actionable inventory counts (e.g. Available vs. Under Contract).

---

### GAP-08: Property Creation Role Restriction for Demo Sandbox User
- **Severity:** Medium (Testing Accessibility)
- **Category:** Role Guard / Permission
- **Files Affected:**
  - `backend/src/api/routes/properties.ts` (Line 58: `requireRole('OWNER')`)
  - `frontend/src/pages/PropertiesPage.tsx` (Lines 125–136)
- **Observed Behavior:**  
  The endpoint `POST /api/properties` is guarded by `requireRole('OWNER')`. When testing in the browser using the Demo Sandbox button, the user is logged in as Sarah Jenkins, whose role is `AGENT`. As a result, the **"Add Listing"** button is disabled in the UI.
- **Impact on Testing:**  
  A developer testing through the demo sandbox UI cannot add a new property listing without either:
  1. Using an OWNER account (e.g. `riklestork@gmail.com`).
  2. Updating Sarah Jenkins's role to `OWNER` in the local test database.
  3. Using the CSV import modal.
- **Remediation Plan:**
  Provide an optional "Switch to Owner Role" button in the development sandbox banner to enable seamless testing of both roles without manual database edits.

---

### GAP-09: Customer Simulator Panel Restricted to Non-Production
- **Severity:** Low (Intended Security Feature)
- **Files Affected:**
  - `frontend/src/pages/LeadDetailPage.tsx`
  - `backend/src/api/routes/conversations.ts` (Lines 79–82)
- **Observed Behavior:**  
  The blue "Customer Inquiry Simulator" box is rendered only when `!import.meta.env.PROD`. In production environments, customer simulation is disabled both in the UI and at the backend endpoint (`POST /api/leads/:id/conversations/messages`).
- **Impact on Testing:**  
  In local development (`npm run dev`), the simulator is active and works as expected. In a production build (`npm run build`), customer inquiries must arrive through real webhooks (`/api/inbound/message`) or an authenticated API key.
- **Remediation Plan:**
  Document clearly in operator runbooks that the simulator is a development-only tool.

---

### GAP-10: Outbox Worker Trigger Architecture
- **Severity:** Low (Architectural Note)
- **Files Affected:**
  - `backend/src/services/messaging/outboxDispatcher.ts`
  - `backend/src/services/conversation.service.ts` (Lines 147, 473)
- **Observed Behavior:**  
  Outbox jobs are processed via asynchronous triggers immediately following message creation (`processOutboxJobs({ batchSize: 5 }).catch(...)`). If the server process is killed while an outbox job is in `RETRYING` status, there is no recurring background cron loop automatically polling the outbox until the next user action or manual retry occurs.
- **Remediation Plan:**
  Register a lightweight recurring timer (e.g. every 60 seconds) in `scheduler.service.ts` to call `processOutboxJobs({ batchSize: 10 })` in the background.

---

## 3. Prioritized Remediation Roadmap

| Priority | Task ID | Description | Estimated Effort | Impact |
|---|---|---|---|---|
| **P1** | GAP-01 | Connect `OrganizationPage.tsx` to real `/api/org/members` & `/api/org/invitations` endpoints | 2–3 hours | High — Eliminates mock state in B2B team management |
| **P1** | GAP-08 | Add "Role Switcher" (Owner vs Agent) in demo sandbox UI header for effortless permission testing | 1 hour | High — Enables full OWNER workflow verification without database manipulation |
| **P2** | GAP-05 | Replace native browser `alert()` and `confirm()` calls with non-blocking toast notifications | 1–2 hours | Medium — Professional UI polish |
| **P2** | GAP-10 | Add periodic 60-second outbox processor to `scheduler.service.ts` | 30 mins | Medium — Enhances background retry autonomy |
| **P3** | GAP-03 | Dynamic role badge in `UserMenu.tsx` | 15 mins | Low — Eliminates minor visual inconsistency |
| **P3** | GAP-04 | Dynamic organization name in `Sidebar.tsx` | 15 mins | Low — Eliminates hardcoded brand name |
| **P3** | GAP-02 | Connect TopHeader search input to instant search command palette | 2 hours | Low — Improves navigation ergonomics |
| **P3** | GAP-06 | Implement genuine CSV download for Analytics and Deals export buttons | 1 hour | Low — Replaces alert placeholders |
