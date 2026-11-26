# 03 — Authentication, Authorization & Multi-Tenant Security

## 1. Fundamentals
- **Authentication (AuthN):** *"Who are you?"* — Verifying identity via Google OAuth ID token or email/password.
- **Authorization (AuthZ):** *"What are you allowed to do?"* — Checking `UserRole` (`OWNER` vs `AGENT`), `isPlatformAdmin`, and `organizationId` ownership.

---

## 2. Exact Implementation in This Project

### 2.1 Password Hashing (`backend/src/services/auth.service.ts`)
- **Algorithm:** Node.js `crypto.scryptSync(password, salt, 64)` with a random 16-byte hex salt (`${salt}:${hash}`). (Note: `bcrypt`/`Argon2` are NOT used; `scrypt` is built into Node's `crypto` module and is memory-hard.)
- **Verification:** `verifyPassword()` derives the 64-byte key and compares buffers using `crypto.timingSafeEqual(keyBuffer, derivedKey)` to prevent timing side-channel attacks.

### 2.2 Three Login/Signup Flows
1. **Google Sign-In (`signInWithGoogle`):**
   - Verifies Google ID token with `OAuth2Client.verifyIdToken({ idToken, audience: GOOGLE_CLIENT_ID })`.
   - Requires `payload.sub`, `payload.email`, and `payload.email_verified === true`.
2. **Email + Password (`signInWithPassword`):**
   - Lowercases email, fetches user, checks `verifyPassword()`, checks `user.organizationId`.
3. **Workspace Registration (`registerOrganization`):**
   - Atomic `prisma.$transaction()` creates `Organization` + `User` (`role: 'OWNER'`) + `OrganizationChannel` + `OrganizationWallet`.
   - In `production` with `STRIPE_SECRET_KEY`, sets `subscriptionStatus = 'PENDING_PAYMENT'` so `ProtectedLayout` routes the user to complete checkout before accessing the workspace.

### 2.3 JWT Structure, Signing & Stateful Revocation
- **Signing (`signSessionToken`):**
  - Algorithm: `HS256`, TTL: `7d`, `issuer: 'contingency-copilot'`, `audience: 'contingency-copilot-api'`.
  - Claims: `{ sub: user.id, org: organizationId, role: user.role, sv: user.sessionVersion }`.
  - Secret: `getJwtSecret()` enforces `>= 32` chars and rejects `KNOWN_WEAK_SECRETS`.
- **Verification (`verifySessionToken`):**
  1. `jwt.verify()` checks signature, `exp`, `issuer`, `audience`.
  2. Queries `prisma.user.findUnique({ where: { id: claims.sub }, include: { organization: ... } })`.
  3. Rejects (`401`) if `!user || !user.organizationId || user.organizationId !== claims.org || user.sessionVersion !== claims.sv`.
  4. `toSessionUser()` rejects (`403`) if `user.organization.isSuspended && !platformAdmin`.
- **Why DB lookup on every request?** Pure stateless JWTs cannot be revoked before `exp` (7 days). Embedding `sv` (`sessionVersion`) and checking PostgreSQL means changing a role, removing a member, or suspending a brokerage takes effect **immediately** on the very next request.

### 2.4 Client Storage & Logout (`frontend/src/services/session.ts`, `AuthContext.tsx`)
- **Storage:** Stored in `localStorage` under key `'copilot.session'` (note: NOT `HttpOnly` cookies; sent as `Authorization: Bearer <token>` header by `api.ts`).
  - *Interview trade-off:* `localStorage` makes cross-origin Vercel→Render SPA requests simple without CSRF tokens, but is accessible to XSS—making `helmet()` and strict input sanitization critical.
- **Logout (`signOut`):** Removes token from `localStorage`, clears `swrCache`, sets `user = null`, and calls `window.google?.accounts?.id?.disableAutoSelect?.()`.
- **401 Auto-Logout:** `api.ts` calls `notifyUnauthorized()` on any `401`, which dispatches `'copilot:unauthorized'` window event, clearing `AuthContext` user state.

---

## 3. Authorization, Invitations & Tenant Isolation
- **Middleware (`backend/src/middleware/auth.ts`):**
  - `requireAuth` → validates JWT + DB user, sets `req.user`.
  - `requireRole(...roles)` → enforces `OWNER` vs `AGENT` (`403` on mismatch).
  - `requirePlatformAdmin` → enforces `isPlatformAdmin` (checked against `PLATFORM_ADMIN_EMAILS` env list).
- **Single-Use Invitations (`acceptInvitation`):**
  - Token is hashed with `SHA-256` (`hashToken`) before DB lookup.
  - Claimed atomically inside `prisma.$transaction()` using `tx.invitation.updateMany({ where: { id, acceptedAt: null, revokedAt: null, expiresAt: { gt: now } }, data: { acceptedAt: now, acceptedById: user.id } })`. If `claimed.count !== 1`, throws `403`.
- **Fail-Closed Tenant Scope (`backend/src/utils/tenant.ts`):**
  - `requireOrgId(organizationId)` throws a non-operational `500` error if `organizationId` is null/empty, ensuring no service ever accidentally drops the `organizationId` filter.

---

## 4. Failure Scenarios Trace
- **Token Expired / Invalid:** `jwt.verify()` throws → `verifySessionToken` throws `401` → frontend `api.ts` fires `notifyUnauthorized()` → user redirected to `/login`.
- **User Accesses Another Org's Data:** `req.user.organizationId` comes from the verified user record, never the request body; Prisma `findFirst({ where: { id, organizationId } })` returns `null` → `404`.
- **Insufficient Permissions:** `requireRole('OWNER')` returns `403 You do not have permission to perform this action`.
