# Manual UI Testing Guide — Step-by-Step Browser Verification

**Repository:** `/Users/badal11/Desktop/Real_Estate_Contigency`  
**Application URLs:**  
- **Frontend:** [http://localhost:3000](http://localhost:3000)  
- **Backend API:** [http://localhost:3001](http://localhost:3001)  
**Document Status:** Complete Phase 4 Manual Testing Playbook  

---

## 1. Prerequisites & Environment Setup

Before starting manual browser testing, verify that both development servers are running:
1. Open terminal and run: `curl -s http://localhost:3001/health`  
   *Expected output:* `{"status":"ok", ...}`
2. Open terminal and run: `curl -s http://localhost:3001/api/auth/config`  
   *Expected output:* `{"demoLoginEnabled":true}`
3. Open your browser to [http://localhost:3000](http://localhost:3000).

### Test Roles & Accounts
- **Demo Advisor (AGENT Role):**  
  - Name: Sarah Jenkins  
  - Email: `agent.demo@contingencycopilot.com`  
  - Organization: `demo-sandbox-org` ("Demo Sandbox Brokerage")  
  - Login Method: Click the purple button **"Enter Demo Sandbox (Advisor Role)"** on `/login`.
- **Brokerage Admin (OWNER Role):**  
  - Email: `riklestork@gmail.com` (existing organization `cmuyc3rxl0001xj888pzcoyop`)  
  - Alternatively, if you wish to run as an OWNER in the sandbox org, you can generate an owner token with the backend script or modify Sarah Jenkins's role in the local database.

---

## 2. Step-by-Step Feature Test Cases

### Category A: Authentication & Organization

---

#### TC-AUTH-01: Demo Sandbox Login
1. **Feature Name:** Demo Sandbox One-Click Authentication
2. **Navigation Path:** Direct URL: `http://localhost:3000/login`
3. **Required Role & Prerequisites:** No active session. Log out first if already logged in.
4. **Synthetic Data Required:** None.
5. **Numbered Actions:**
   1. Open `http://localhost:3000/login`.
   2. Verify the purple button labelled **"Enter Demo Sandbox (Advisor Role)"** is visible below the Google sign-in options.
   3. Click the **"Enter Demo Sandbox (Advisor Role)"** button.
6. **Expected UI Result:**  
   - Button shows brief spinner.
   - Browser immediately redirects to `/leads`.
   - Top right user menu displays "Sarah Jenkins".
7. **Expected API/DB Result:**  
   - `POST /api/auth/demo` returns HTTP 200 with JWT token and user payload.
   - `localStorage.getItem('copilot.session')` contains a valid JWT.
8. **Negative / Error Case:**  
   - Open browser developer tools and simulate network offline; click demo login; UI displays error alert: *"Demo login failed. Check connection."*
9. **Cleanup:** Not required (idempotent upsert).
10. **Status:** **PASS**

---

#### TC-AUTH-02: Session Persistence & Logout
1. **Feature Name:** Session Persistence & User Logout
2. **Navigation Path:** Top navigation bar -> User Menu (top right avatar)
3. **Required Role & Prerequisites:** Logged in as Demo Agent.
4. **Synthetic Data Required:** None.
5. **Numbered Actions:**
   1. Refresh the page at `http://localhost:3000/leads`.
   2. Confirm you remain logged in and are NOT redirected back to `/login`.
   3. Click on the user avatar / profile button in the top right header.
   4. In the dropdown menu, click **"Sign out"**.
6. **Expected UI Result:**  
   - Session terminates immediately.
   - Browser redirects to `/login`.
   - Navigating manually to `http://localhost:3000/leads` immediately redirects back to `/login`.
7. **Expected API/DB Result:**  
   - `localStorage.getItem('copilot.session')` is cleared (`null`).
8. **Negative / Error Case:**  
   - In browser console, run `localStorage.setItem('copilot.session', 'invalid.token.here')` and refresh. The app makes `GET /api/auth/me`, gets HTTP 401, clears the token, and redirects to `/login`.
9. **Cleanup:** None.
10. **Status:** **PASS**

---

### Category B: Dashboard & Navigation

---

#### TC-NAV-01: Navigation Menu & Deep Linking
1. **Feature Name:** Sidebar Navigation & Direct Route Loading
2. **Navigation Path:** Left Sidebar (`/leads`, `/properties`, `/deals`, `/upload`, `/organization`, `/analytics`, `/docs`, `/audit`)
3. **Required Role & Prerequisites:** Logged in.
4. **Synthetic Data Required:** None.
5. **Numbered Actions:**
   1. Click **"Leads"** in sidebar -> verifies URL `http://localhost:3000/leads`.
   2. Click **"Properties"** in sidebar -> verifies URL `http://localhost:3000/properties`.
   3. Click **"Transactions"** (Deals) in sidebar -> verifies URL `http://localhost:3000/deals`.
   4. Click **"Contract OCR"** (Upload) in sidebar -> verifies URL `http://localhost:3000/upload`.
   5. Click **"Organization"** in sidebar -> verifies URL `http://localhost:3000/organization`.
   6. Click **"Analytics"** in sidebar -> verifies URL `http://localhost:3000/analytics`.
   7. Click **"Documentation"** in sidebar -> verifies URL `http://localhost:3000/docs`.
   8. Click **"Audit Trail"** in sidebar -> verifies URL `http://localhost:3000/audit`.
6. **Expected UI Result:**  
   - Each page renders without white screens, uncaught React errors, or routing crashes.
   - The active sidebar item highlights in purple (`bg-[#635bff]/10 text-[#635bff]`).
7. **Expected API/DB Result:**  
   - Client router resolves route synchronously; corresponding API fetches execute.
8. **Negative / Error Case:**  
   - Enter an invalid URL: `http://localhost:3000/non-existent-page`. Router redirects gracefully to `/leads`.
9. **Cleanup:** None.
10. **Status:** **PASS**

---

### Category C: Property Management

---

#### TC-PROP-01: Property Inventory Listing & Search
1. **Feature Name:** Property Inventory & Real-Time Filter
2. **Navigation Path:** Sidebar -> **"Properties"** (`/properties`)
3. **Required Role & Prerequisites:** Logged in.
4. **Synthetic Data Required:** Existing properties in organization or freshly created listing.
5. **Numbered Actions:**
   1. Navigate to `/properties`.
   2. Observe the header: *"MLS Property Inventory & Valuation"*.
   3. Type a city name or keyword (e.g. "Austin") into the search box: *"Search listings by title, address, or city..."*.
6. **Expected UI Result:**  
   - Listing cards filter dynamically based on the search query.
   - If no properties match, displays empty state: *"No listings match your search criteria"*.
7. **Expected API/DB Result:**  
   - `GET /api/properties?search=Austin` executes and returns filtered JSON array.
8. **Negative / Error Case:**  
   - Enter special characters `!@#$%^&*()` into search box; verify backend handles gracefully and returns empty array without 500 error.
9. **Cleanup:** None.
10. **Status:** **PASS**

---

#### TC-PROP-02: Property Creation Role Restriction (AGENT vs OWNER)
1. **Feature Name:** Role-Guarded Property Creation
2. **Navigation Path:** `/properties` -> Top right buttons
3. **Required Role & Prerequisites:** Logged in as Demo Agent (`AGENT` role).
4. **Synthetic Data Required:** None.
5. **Numbered Actions:**
   1. Navigate to `/properties` as Sarah Jenkins (`AGENT`).
   2. Inspect the top right action button.
6. **Expected UI Result:**  
   - Button renders as disabled: **"Add Listing (Owner Only)"** with reduced opacity and cursor not-allowed.
   - Hovering displays tooltip: *"Only organization owners can add listings"*.
7. **Expected API/DB Result:**  
   - If the endpoint `POST /api/properties` is called via console/curl with the AGENT's token, the backend returns HTTP 403 Forbidden with `{ "error": { "message": "You do not have permission to perform this action" } }`.
8. **Negative / Error Case:**  
   - Direct API invocation as AGENT receives 403.
9. **Cleanup:** None.
10. **Status:** **PASS**

---

#### TC-PROP-03: Property CMA Valuation & Marketing Kit Modals
1. **Feature Name:** CMA Engine & Instant Marketing Kit
2. **Navigation Path:** `/properties` -> Any Property Card
3. **Required Role & Prerequisites:** Logged in; at least 1 property visible.
4. **Synthetic Data Required:** Synthetic property record.
5. **Numbered Actions:**
   1. On any property card, click **"Run CMA Valuation"**.
   2. Review the comparative market analysis modal (estimated price, confidence score, valuation range).
   3. Close the CMA modal.
   4. On the same property card, click **"AI Marketing Kit"**.
   5. Review the generated listing headline, social blurbs, and email pitch.
   6. Click **"Copy"** on any generated section.
6. **Expected UI Result:**  
   - Modals open smoothly with rich glassmorphism backdrop.
   - Copy button shows green checkmark indicating text copied to clipboard.
7. **Expected API/DB Result:**  
   - Executed client-side with deterministic calculation models.
8. **Negative / Error Case:**  
   - Close modal via Escape key or backdrop click; modal dismisses cleanly.
9. **Cleanup:** None.
10. **Status:** **PASS**

---

### Category D: Lead Management

---

#### TC-LEAD-01: Manual Lead Creation
1. **Feature Name:** New Buyer Lead Intake
2. **Navigation Path:** Sidebar -> **"Leads"** -> Top right button **"+ New Lead"**
3. **Required Role & Prerequisites:** Logged in.
4. **Synthetic Data Required:**  
   - Full Name: `David Miller`  
   - Email: `david.miller.test@contingencycopilot.internal`  
   - Phone: `+1-512-555-0199`  
   - Initial Inquiry: `Looking for a 3-bedroom single-family home in Downtown Austin with a yard under $850k. Moving in 60 days.`
5. **Numbered Actions:**
   1. Click **"+ New Lead"** in the top right.
   2. In the modal form, enter Full Name, Email, Phone, and Initial Inquiry.
   3. Click **"Create Lead & Run Qualification"**.
6. **Expected UI Result:**  
   - Modal displays spinner on submit button.
   - Green banner appears: *"Lead successfully created!"*.
   - Lead appears in the leads table with status `NEW` and source `MANUAL`.
7. **Expected API/DB Result:**  
   - `POST /api/leads` returns HTTP 201 with newly created lead ID.
   - Lead inserted in database with caller's `organizationId`.
8. **Negative / Error Case:**  
   - Attempt submission with empty name or invalid email (`david.miller`); form validation prevents submission and shows validation message.
9. **Cleanup:** Record can remain as synthetic test lead or be archived.
10. **Status:** **PASS**

---

#### TC-LEAD-02: Lead Self-Claiming & Unassigned Pool
1. **Feature Name:** Atomic Lead Claiming
2. **Navigation Path:** `/leads` -> **"Unassigned"** tab
3. **Required Role & Prerequisites:** Logged in as Demo Agent; at least 1 unassigned lead.
4. **Synthetic Data Required:** Unassigned lead (created in TC-LEAD-01).
5. **Numbered Actions:**
   1. Navigate to `/leads` and click the **"Unassigned"** tab.
   2. Locate the lead created in TC-LEAD-01 (`David Miller`).
   3. Click the purple button **"Claim Lead"** in the table action column.
6. **Expected UI Result:**  
   - Button shows spinner, then transforms into checkmark.
   - Success toast appears: *"Lead claimed successfully!"*.
   - Lead moves out of "Unassigned" and appears under the **"My Leads"** tab.
7. **Expected API/DB Result:**  
   - `POST /api/leads/:id/claim` returns HTTP 200.
   - Database updates `assignedUserId` to caller's user ID.
   - Record created in `LeadAssignmentHistory`.
8. **Negative / Error Case:**  
   - Attempting to claim an already claimed lead returns HTTP 409 Conflict with message: *"Lead is already assigned to another advisor"*.
9. **Cleanup:** Can release the lead in TC-LEAD-03.
10. **Status:** **PASS**

---

#### TC-LEAD-03: Lead Release & Ownership Controls
1. **Feature Name:** Lead Ownership Release
2. **Navigation Path:** Open lead detail: `/leads/:id`
3. **Required Role & Prerequisites:** Logged in as assigned advisor.
4. **Synthetic Data Required:** Assigned lead.
5. **Numbered Actions:**
   1. Open the lead detail page `/leads/:id`.
   2. In the top action bar, click **"Release Lead"**.
   3. In the confirmation dialog, enter reason: *"Reallocating capacity for South Austin tours"*.
   4. Click **"Confirm Release"**.
6. **Expected UI Result:**  
   - Success message appears.
   - Top bar now displays **"Claim Lead"** button instead of "Release".
   - Assigned advisor chip changes to "Unassigned Pool".
7. **Expected API/DB Result:**  
   - `POST /api/leads/:id/release` returns HTTP 200.
   - In DB, `assignedUserId` is set to `null`.
8. **Negative / Error Case:**  
   - Calling release on an unassigned lead returns HTTP 400 Bad Request.
9. **Cleanup:** Claim the lead back to proceed with subsequent tests.
10. **Status:** **PASS**

---

#### TC-LEAD-04: Editable Buyer Requirements
1. **Feature Name:** Manual Buyer Requirements Update
2. **Navigation Path:** `/leads/:id` -> Left column *"Buyer Requirements & Criteria"*
3. **Required Role & Prerequisites:** Assigned advisor or Owner.
4. **Synthetic Data Required:**  
   - Min Budget: `700000`  
   - Max Budget: `900000`  
   - Preferred Locations: `Downtown Austin, Zilker, South Congress`  
   - Property Type: `Single Family`  
   - Min Bedrooms: `3`  
   - Possession Timeline: `60 Days`
5. **Numbered Actions:**
   1. On `/leads/:id`, locate the left-hand requirements card.
   2. Enter the synthetic budget and preference values above into the input fields.
   3. Click **"Save Requirements"**.
6. **Expected UI Result:**  
   - Button shows brief loading indicator.
   - Toast confirms: *"Buyer criteria updated successfully"*.
   - Input fields reflect the saved values.
7. **Expected API/DB Result:**  
   - `PATCH /api/leads/:id` returns HTTP 200.
   - `Lead` and `LeadRequirements` tables updated in DB.
8. **Negative / Error Case:**  
   - Set Min Budget (`900000`) greater than Max Budget (`700000`); system flags budget inversion warning.
9. **Cleanup:** None.
10. **Status:** **PASS**

---

#### TC-LEAD-05: Manual Call Logging
1. **Feature Name:** Advisor Call Logging
2. **Navigation Path:** `/leads/:id` -> Left column *"Call Logs & Phone Outreach"* -> **"Log Call"**
3. **Required Role & Prerequisites:** Logged in.
4. **Synthetic Data Required:**  
   - Direction: `OUTBOUND`  
   - Outcome: `CONNECTED`  
   - Duration (seconds): `320`  
   - Notes: `Spoke with David. Confirmed pre-approval letter for $900k from Chase. Prefers modern finishes and 2-car garage.`  
   - Follow-up needed: Checked (Date: Tomorrow 10:00 AM)
5. **Numbered Actions:**
   1. Click **"Log Call"**.
   2. In the modal, select Direction: Outbound, Outcome: Connected.
   3. Enter duration `320` and call notes.
   4. Check "Follow-up required" and select tomorrow's date.
   5. Click **"Save Call Log"**.
6. **Expected UI Result:**  
   - Modal closes.
   - New call record appears in the call history card with purple "Outbound" badge and "Connected" indicator.
   - Call event immediately appears in the unified activity timeline at the bottom of the page.
7. **Expected API/DB Result:**  
   - `POST /api/leads/:id/calls` returns HTTP 201 with call log object.
   - `LeadCallLog` record inserted into database.
8. **Negative / Error Case:**  
   - Leave notes empty; submit button requires valid notes or displays validation warning.
9. **Cleanup:** None.
10. **Status:** **PASS**

---

#### TC-LEAD-06: Follow-Up Task Management
1. **Feature Name:** Follow-Up Tasks & Action Queue
2. **Navigation Path:** `/leads/:id` -> Left column *"Follow-Up Tasks"* -> **"Add Task"**
3. **Required Role & Prerequisites:** Logged in.
4. **Synthetic Data Required:**  
   - Title: `Send curated MLS listings brochure`  
   - Task Type: `MESSAGE`  
   - Priority: `HIGH`  
   - Due Date: Select tomorrow  
   - Description: `Email PDF summary of Downtown 3BHK listings under $900k.`
5. **Numbered Actions:**
   1. Click **"Add Task"**.
   2. Fill in Title, Type, Priority, Due Date, and Description.
   3. Click **"Create Task"**.
   4. In the tasks card, observe the new task card with High priority red badge.
   5. Click the green checkmark button on the task card to mark it as complete.
6. **Expected UI Result:**  
   - Task creates instantly and appears in the "Open" filter.
   - After clicking complete, task moves to "Completed" filter with strikethrough styling.
   - Activity timeline logs the task creation and completion events.
7. **Expected API/DB Result:**  
   - `POST /api/leads/:id/tasks` returns HTTP 201.
   - `POST /api/tasks/:id/complete` returns HTTP 200 with `status: 'COMPLETED'`.
8. **Negative / Error Case:**  
   - Submit task with empty title; validation error displayed: *"Title cannot be empty"*.
9. **Cleanup:** None.
10. **Status:** **PASS**

---

### Category E: AI Real Estate Sales Agent

---

#### TC-AI-01: Inbound Customer Message Simulation & AI Auto-Reply
1. **Feature Name:** Multi-Round AI Conversation & Proposal Generation
2. **Navigation Path:** `/leads/:id` -> Center Column *"Customer Inquiry Simulator"* (Non-Production Banner)
3. **Required Role & Prerequisites:** Logged in to dev sandbox.
4. **Synthetic Data Required:**  
   - Customer message: `Hi, I am looking for a 3 bedroom home in Downtown Austin with a yard. My budget is around $850,000. Do you have anything available this Saturday to tour?`
5. **Numbered Actions:**
   1. On `/leads/:id`, locate the blue box labelled *"Customer Inquiry Simulator (Development Only)"*.
   2. Type or paste the customer message above into the simulator input.
   3. Click **"Simulate Customer Send"**.
6. **Expected UI Result:**  
   - Customer message appears on the left side of the chat thread with a grey bubble.
   - A purple AI thinking indicator appears: *"AI Sales Agent is analyzing requirements and checking inventory..."*.
   - AI assistant replies in the chat thread.
   - AI generates and embeds an interactive **"Requirement Proposal"** card in the chat showing:
     - Proposed Budget: `$850,000`
     - Proposed Bedrooms: `3`
     - Proposed Location: `Downtown Austin`
     - Two action buttons: **"Approve Proposal"** and **"Reject Proposal"**.
7. **Expected API/DB Result:**  
   - `POST /api/leads/:id/conversations/messages` returns HTTP 201.
   - `agentRuntime.ts` invokes tools: `propose_buyer_requirements`, `search_properties`, `check_site_visit_availability`.
   - Records inserted into `ConversationMessage` and `RequirementProposal`.
8. **Negative / Error Case:**  
   - If AI provider is offline or API key missing, runtime executes the deterministic fallback contract: returns a grounded receipt message and suggests safe follow-ups without crashing.
9. **Cleanup:** None.
10. **Status:** **PASS**

---

#### TC-AI-02: Human Review & Approval of AI Requirement Proposal
1. **Feature Name:** Human-in-the-Loop Proposal Decision
2. **Navigation Path:** `/leads/:id` -> Center Column Chat Proposal Card
3. **Required Role & Prerequisites:** Assigned advisor or Owner.
4. **Synthetic Data Required:** Proposal generated in TC-AI-01.
5. **Numbered Actions:**
   1. Locate the AI Requirement Proposal card in the chat.
   2. Verify the proposed values match the customer statement.
   3. Click the green button: **"Approve Proposal"**.
6. **Expected UI Result:**  
   - Proposal card updates to a green border with badge: *"Approved by Advisor"*.
   - Left-column requirements card instantly updates and displays the approved budget `$850,000` and `3` bedrooms.
7. **Expected API/DB Result:**  
   - `POST /api/leads/:id/proposals/:proposalId/accept` returns HTTP 200.
   - Authoritative database table `LeadRequirements` updated.
   - Audit trail records `REQUIREMENTS_PROPOSAL_APPROVED`.
8. **Negative / Error Case:**  
   - Click "Reject Proposal" on another proposal; proposal status transitions to `REJECTED` and authoritative database is left untouched.
9. **Cleanup:** None.
10. **Status:** **PASS**

---

#### TC-AI-03: Fast-Path Human Escalation
1. **Feature Name:** Deterministic Human Takeover Trigger
2. **Navigation Path:** `/leads/:id` -> Customer Simulator
3. **Required Role & Prerequisites:** Logged in.
4. **Synthetic Data Required:**  
   - Message: `I want to speak with a human advisor right now, stop the bot.`
5. **Numbered Actions:**
   1. Paste the message above into the Customer Simulator.
   2. Click **"Simulate Customer Send"**.
6. **Expected UI Result:**  
   - Fast-path deterministic safeguard triggers instantly.
   - AI replies with handoff notice: *"I understand and have alerted our advisor team. A dedicated human advisor has been notified and will reach out to you directly."*
   - Amber alert badge appears at top of chat: *"Human Takeover Active — Automated AI replies are paused"*.
   - Takeover toggle in top bar automatically flips to active.
7. **Expected API/DB Result:**  
   - Fast-path regex executes without waiting for LLM round.
   - `escalate_to_human` tool records escalation with reason `BUYER_REQUESTED_HUMAN`.
   - `ConversationThread.isHumanTakeover` set to `true`.
8. **Negative / Error Case:**  
   - Send another customer message while takeover is active; automated AI replies are strictly suppressed.
9. **Cleanup:** Click "Resume AI Autopilot" to return to normal mode.
10. **Status:** **PASS**

---

#### TC-AI-04: Site Visit Availability Check & Booking
1. **Feature Name:** Conflict-Free Site Visit Scheduling
2. **Navigation Path:** `/leads/:id` -> Left column *"Site Visits & Tours"* -> **"Schedule Visit"**
3. **Required Role & Prerequisites:** Logged in.
4. **Synthetic Data Required:**  
   - Start Date/Time: Upcoming Friday at 2:00 PM  
   - Duration: 60 minutes  
   - Meeting Location: `Property Front Entrance`  
   - Notes: `Buyer requested private walkthrough of master suite and backyard.`
5. **Numbered Actions:**
   1. Click **"Schedule Visit"**.
   2. In the modal, pick property (or leave blank for custom location).
   3. Pick start time: Friday 2:00 PM, duration 60 mins.
   4. Click **"Check Advisor Availability"**.
   5. Observe the green banner: *"Advisor is available during this time slot"*.
   6. Click **"Confirm & Schedule Tour"**.
6. **Expected UI Result:**  
   - Modal dismisses.
   - Visit appears in the Site Visits card with status `SCHEDULED` and countdown.
   - Event appears in the activity timeline.
7. **Expected API/DB Result:**  
   - `GET /api/site-visits/availability` returns `{ available: true }`.
   - `POST /api/site-visits` returns HTTP 201.
   - Record created in `SiteVisit` table.
8. **Negative / Error Case:**  
   - Try scheduling a second visit for the exact same advisor at the exact same time; availability check flags conflict: *"Advisor has a conflicting booking during this time slot"*.
9. **Cleanup:** Use "Cancel Visit" modal to test cancellation.
10. **Status:** **PASS**

---

### Category F: Messaging & Outbound Dispatch

---

#### TC-MSG-01: Advisor-Authored Message & Outbox Queue
1. **Feature Name:** Human Advisor Outbound Message Dispatch
2. **Navigation Path:** `/leads/:id` -> Center Column *"Advisor Reply (Human Takeover)"*
3. **Required Role & Prerequisites:** Assigned advisor or Owner.
4. **Synthetic Data Required:**  
   - Message text: `Hi David, I have reviewed the Downtown Austin properties and reserved a tour for this Friday at 2:00 PM. Looking forward to meeting you!`
5. **Numbered Actions:**
   1. Locate the advisor text area at the bottom of the conversation thread.
   2. Type the message text above.
   3. Click **"Send Message as Advisor"**.
6. **Expected UI Result:**  
   - Message appears immediately in the conversation thread with a purple background and avatar indicating advisor authorship (`ADVISOR`).
   - In the left-hand column under *"Outbound Messages & Delivery Status"*, a new outbox entry appears.
   - Delivery badge transitions: `PENDING` -> `SENDING` -> `SENT` (or `DELIVERED`).
7. **Expected API/DB Result:**  
   - `POST /api/leads/:id/conversations/messages/agent` returns HTTP 201.
   - `ConversationMessage` created with `senderType: 'ADVISOR'`.
   - `OutboxJob` created with `idempotencyKey: 'dispatch-<msgId>'`.
   - `processOutboxJobs()` executes in background, simulated delivery completes with mock provider ID, and message updates to `SENT`.
8. **Negative / Error Case:**  
   - Submit empty message; client prevents submission.
9. **Cleanup:** None.
10. **Status:** **PASS**

---

#### TC-MSG-02: AI Draft Approval Workflow
1. **Feature Name:** Human-in-the-Loop Message Draft Approval
2. **Navigation Path:** `/leads/:id` -> Conversation Thread Draft Card
3. **Required Role & Prerequisites:** Assigned advisor or Owner.
4. **Synthetic Data Required:** Message draft generated by AI or follow-up plan.
5. **Numbered Actions:**
   1. Click **"Plan Follow-Up"** in the Persistent Buyer Memory card to generate a recommended outreach draft.
   2. Observe the AI Message Draft card appearing in the thread with yellow border: *"Pending Advisor Approval"*.
   3. Click **"Approve & Send Draft"**.
6. **Expected UI Result:**  
   - Card transitions from pending yellow to approved purple.
   - Message enters outbox queue for dispatch.
   - Outbox list in left column shows dispatch status.
7. **Expected API/DB Result:**  
   - `PATCH /api/leads/:id/conversations/messages/:msgId` called with `{ status: 'APPROVED' }`.
   - Message enqueued in `OutboxJob`.
8. **Negative / Error Case:**  
   - Click "Reject Draft"; message status transitions to `REJECTED` and is never enqueued for outbound dispatch.
9. **Cleanup:** None.
10. **Status:** **PASS**

---

#### TC-MSG-03: Outbox Manual Retry on Simulated Failure
1. **Feature Name:** Idempotent Outbox Retry
2. **Navigation Path:** `/leads/:id` -> Left column *"Outbound Messages & Delivery Status"*
3. **Required Role & Prerequisites:** Assigned advisor or Owner.
4. **Synthetic Data Required:** Message in `FAILED` status.
5. **Numbered Actions:**
   1. Locate a failed message card (or inspect message with failed recipient).
   2. Click the red **"Retry Dispatch"** button on the failed message card.
6. **Expected UI Result:**  
   - Button shows spinner.
   - Status badge transitions from `FAILED` to `RETRYING` to `SENT`.
7. **Expected API/DB Result:**  
   - `POST /api/leads/:id/conversations/messages/:id/retry` returns HTTP 200.
   - Outbox job attempt count increments, error cleared, and dispatcher re-executed.
8. **Negative / Error Case:**  
   - Clicking retry on an already `DELIVERED` message returns HTTP 400 Bad Request (*"Message is already delivered"*).
9. **Cleanup:** None.
10. **Status:** **PASS**

---

### Category G: Deals & Contingencies

---

#### TC-DEAL-01: Lead-to-Deal Conversion & Qualification Gate
1. **Feature Name:** Lead-to-Deal Conversion Workflow
2. **Navigation Path:** `/leads/:id` -> Top Bar purple button **"Convert to Deal"**
3. **Required Role & Prerequisites:** Assigned advisor or Owner; Lead in `QUALIFIED` or `CONTACTED` stage.
4. **Synthetic Data Required:**  
   - Property Address: `450 Colorado St, Unit 14B, Austin, TX 78701`  
   - Buyer Name: `David Miller`  
   - Seller Name: `Austin Urban Residences LLC`  
   - Acceptance Date: Today's date  
   - Contract Timezone: `America/Chicago`
5. **Numbered Actions:**
   1. On `/leads/:id`, click the purple **"Convert to Deal"** button in the header.
   2. In the modal, review the pre-filled Buyer Name and Address.
   3. Enter Seller Name and verify Acceptance Date.
   4. If lead is not fully qualified (e.g. missing pre-approval flag), check **"Request Manager Eligibility Override"** and enter justification: *"Verified Chase pre-approval letter on file via phone call."*
   5. Click **"Confirm & Convert to Deal"**.
6. **Expected UI Result:**  
   - Modal displays conversion progress spinner.
   - Success banner appears: *"Lead successfully converted to Deal! Redirecting to transaction cockpit..."*.
   - Browser automatically navigates to `/deals/:newDealId`.
   - Deal page displays the purchase agreement header and initial contingency status (`PENDING_DOCUMENT_UPLOAD`).
7. **Expected API/DB Result:**  
   - `POST /api/leads/:id/convert-to-deal` returns HTTP 201 with newly created Deal object.
   - In DB, `Lead.status` updated to `CONVERTED`.
   - `Deal` record created and associated with `leadId`.
   - Audit trail records `LEAD_CONVERTED_TO_DEAL` with override justification.
8. **Negative / Error Case (Duplicate Conversion):**  
   - Navigate back to `/leads/:id` in browser and click "Convert to Deal" again; modal immediately rejects: *"This lead has already been converted to an active deal."* (HTTP 409 Conflict).
9. **Cleanup:** None.
10. **Status:** **PASS**

---

#### TC-DEAL-02: Deal Contingency Deadlines & Editing
1. **Feature Name:** Contingency Deadline Tracking & Manual Confirmation
2. **Navigation Path:** `/deals/:id` -> Deadlines List
3. **Required Role & Prerequisites:** Logged in.
4. **Synthetic Data Required:** Active Deal.
5. **Numbered Actions:**
   1. Open the newly converted deal at `/deals/:id`.
   2. Locate the deadlines card (or review existing sample deal deadlines).
   3. On any deadline (e.g. "Financing Contingency" or "Inspection Contingency"), click **"Edit Deadline"**.
   4. Update confirmed date to 10 days from today and click **"Save & Confirm"**.
6. **Expected UI Result:**  
   - Modal closes.
   - Deadline card updates to display the new date with a green `CONFIRMED` badge.
   - Days remaining countdown recalibrates automatically.
7. **Expected API/DB Result:**  
   - `PATCH /api/deals/:id/deadlines/:dId` returns HTTP 200.
   - Database updates `Deadline.confirmedDate` and resets notification calculation windows.
   - Audit log records `DEADLINE_CONFIRMED`.
8. **Negative / Error Case:**  
   - Select an invalid date format; API returns 422 Unprocessable Entity.
9. **Cleanup:** None.
10. **Status:** **PASS**

---

### Category H: Administration, Operations & Audit

---

#### TC-ADMIN-01: Audit Trail Verification
1. **Feature Name:** Tamper-Evident Audit History
2. **Navigation Path:** Sidebar -> **"Audit Trail"** (`/audit`)
3. **Required Role & Prerequisites:** Logged in.
4. **Synthetic Data Required:** None (uses logs generated during prior test cases).
5. **Numbered Actions:**
   1. Click **"Audit Trail"** in the left sidebar.
   2. Observe the chronological log table.
   3. Verify recent actions from your test session are present:
      - `LEAD_CREATED`
      - `CALL_LOG_RECORDED`
      - `TASK_CREATED`
      - `SITE_VISIT_SCHEDULED`
      - `MESSAGE_DISPATCH_QUEUED`
      - `LEAD_CONVERTED_TO_DEAL`
   4. Check that actor email is displayed accurately without exposing sensitive secrets.
6. **Expected UI Result:**  
   - Table renders with entity badges, timestamp, actor, and action description.
7. **Expected API/DB Result:**  
   - `GET /api/audit` returns HTTP 200 with scoped audit log entries.
8. **Negative / Error Case:**  
   - None.
9. **Cleanup:** None.
10. **Status:** **PASS**

---

## 3. Quick-Start 5-Minute Manual Testing Path

If you have limited time and want to verify the complete product in 5 minutes, follow this exact sequence:

1. **Step 1:** Open `http://localhost:3000/login` and click **"Enter Demo Sandbox (Advisor Role)"**.
2. **Step 2:** Click **"+ New Lead"**, enter `Alexander Wright`, `alex@test.com`, and click **"Create Lead & Run Qualification"**.
3. **Step 3:** Open Alexander Wright's lead detail. In the blue simulator box, send:  
   `"I want a 3 bedroom condo in Downtown Austin under $900k. Can we tour this Saturday at 2pm?"`
4. **Step 4:** Watch the AI respond and click **"Approve Proposal"** on the generated requirements proposal.
5. **Step 5:** In the advisor box at the bottom, type `"Tour confirmed!"`, click **"Send Message as Advisor"**, and watch the outbound status badge transition to `SENT`.
6. **Step 6:** Click the purple **"Convert to Deal"** button in the header, check the manager override box, click **"Confirm & Convert"**, and verify you land on the live transaction deal page!
