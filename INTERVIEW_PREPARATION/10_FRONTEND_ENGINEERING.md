# 10 — Frontend Engineering (`frontend/src/`)

## 1. Architecture & Tech Stack
- **React 18 + TypeScript + Vite 8 + Tailwind CSS + React Router 7**.
- **State Management:** React Context API (`AuthContext`, `SidebarContext`, `ToastContext`) + custom hooks (`useAssistant`, `useDeadlines`, `useNotifications`) + in-memory `swrCache.ts` (Note: Zustand/Redux are NOT used).
- **Performance:** Route-level code splitting via `React.lazy()` + `Suspense` with `WorkspacePageSkeleton` fallbacks (`frontend/src/App.tsx`).

---

## 2. Core Frontend Modules
1. **Routing & Guards (`frontend/src/App.tsx`):**
   - Public routes: `/`, `/login`, `/signup`, `/pricing`, `/security`, `/contracts-library`, `/docs`.
   - `ProtectedLayout`: Checks `useAuth()` (`loading`, `user`, `subscriptionStatus === 'PENDING_PAYMENT'`), renders fixed `Sidebar`, `TopHeader`, `CommandPalette` (`⌘K`), `Breadcrumbs`, and scrollable `<Outlet />`. Resets `mainRef.current.scrollTop = 0` on route change.
   - `AdminRouteGuard`: Requires `user.isPlatformAdmin`.
2. **Auth & Session (`frontend/src/context/AuthContext.tsx`, `frontend/src/services/session.ts`):**
   - Stores JWT in `localStorage` (`'copilot.session'`), attaches `Authorization: Bearer <token>` via `authHeaders()`.
   - Subscribes to `onUnauthorized()` so any `401` response clears `user` and `swrCache`.
3. **API Client (`frontend/src/services/api.ts`):**
   - `send()` wraps `fetch()`, catches network failures with a user-friendly message, triggers `notifyUnauthorized()` on `401`, and handles `204 No Content` / empty bodies safely.
4. **AI & PDF Components:**
   - `components/assistant/` (`ChatWindow`, `CitationChip`, `MessageBubble`, `StatusStream`, `SuggestedQuestions`, `SummaryPanel`).
   - `components/pdf/PdfViewer.tsx` + `utils/quoteMatcher.ts`: Uses `pdfjs-dist` to render PDF pages and `findQuoteInText()` (NFKC + smart-quote normalization + 70% fallback slice) to highlight verified AI citations.
   - `components/landing/`: `Hero3DCanvas` (Three.js), `PinnedWorkflowShowcase` (GSAP), `BrokerageRoiCalculator`.
