# Contingency Deadline Copilot

> Help solo real-estate agents and small TC teams never miss a purchase-agreement contingency deadline.

## Project Structure

```
Real_Estate_Document/
├── dateEngine.js          # Core business/calendar-day engine (built + tested)
├── dateEngine.test.js     # Jest tests
├── package.json           # Root – date engine package
├── reference/             # Python mirror of date engine (reference only)
├── backend/               # Express + TypeScript + Prisma API
├── frontend/              # React (Vite) + TypeScript + Tailwind UI
├── docker-compose.yml     # Local PostgreSQL (Docker)
└── .env.example           # All environment variables documented
```

---

## Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| Node.js | ≥ 22 | https://nodejs.org |
| npm | ≥ 10 | bundled with Node |
| Docker Desktop | latest | https://docker.com/products/docker-desktop |

---

## Quick Start (Local Dev)

### 1. Clone & install root deps (date engine)

```bash
git clone https://github.com/badal484/Real_Estate_Document.git
cd Real_Estate_Document
npm install
```

### 2. Start PostgreSQL via Docker

```bash
docker compose up -d
# Postgres will be available on localhost:5432
# Healthcheck runs every 5s — wait ~10s before next step
```

> **Optional pgAdmin UI** (DB browser):
> ```bash
> docker compose --profile tools up -d
> # Open http://localhost:5050  (admin@local.dev / admin)
> ```

### 3. Set up the backend

```bash
cd backend
cp ../.env.example .env          # copy template
# Edit .env — DATABASE_URL is pre-filled for Docker local setup

npm install
npx prisma generate              # generate Prisma client
npx prisma migrate deploy        # apply versioned migrations (never `db push`)
npm run dev                      # starts on http://localhost:3001 (refuses to start without a strong JWT_SECRET)

# Organizations are invite-only. Bootstrap the first one and its owner:
npm run org:create -- --name "My Brokerage" --owner-email you@example.com
# → prints a one-time invite link; open it and sign in with Google as that email.
```

An existing database that was created with `db push` must be baselined once
(after confirming `npx prisma migrate diff --from-url "$DATABASE_URL" --to-migrations prisma/migrations --shadow-database-url <scratch db>` shows only the pending migrations):
`npx prisma migrate resolve --applied 0_init`, then `npx prisma migrate deploy`.

Tests run only against a database whose name ends in `_test`
(`TEST_DATABASE_URL`, or `DATABASE_URL=` in `backend/.env.test.local`).

Smoke test:
```bash
curl http://localhost:3001/health
# → { "status": "ok", "timestamp": "..." }

curl http://localhost:3001/api/deals
# → 401 (all data routes require a session)
```

### 4. Set up the frontend

```bash
cd frontend
cp ../.env.example .env.local    # copy template (Vite reads .env.local)
# VITE_API_URL=http://localhost:3001/api is pre-filled

npm install
npm run dev                      # starts on http://localhost:3000
```

Open **http://localhost:3000** — you should see the Upload page.

### 5. Run all tests

```bash
# Root date engine tests
cd Real_Estate_Document && npm test

# Backend tests
cd backend && npm test
```

---

## Environment Variables

See [`.env.example`](./.env.example) for the full list with descriptions.

Key variables:

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` |  | PostgreSQL connection string |
| `ANTHROPIC_API_KEY` | Later | Claude API key (AI extraction — not yet active) |
| `TWILIO_ACCOUNT_SID` | Later | SMS alerts (not yet active) |
| `SENDGRID_API_KEY` | Later | Email alerts (not yet active) |
| `VITE_API_URL` |  frontend | Backend API base URL |

---

## v1 Feature Scope

| Feature | Status |
|---------|--------|
| Date engine (business/calendar days) |  Done |
| Project scaffold (backend + frontend) |  Done |
| PDF upload endpoint | 🔜 Next |
| AI extraction (Claude) | 🔜 Next |
| Deadline confirmation UI | 🔜 Next |
| Timeline view | 🔜 Next |
| SMS / Email alerts | 🔜 Later |
| Auth (magic-link) | 🔜 Later |
| Payments (Stripe) | 🔜 Later |

---

## Deployment

| Service | What |
|---------|------|
| **Vercel / Netlify / any static host** | Frontend (Vite build output) |
| **Railway / Render / Fly.io** | Backend (Express) + Postgres |

Set all env vars in your host's dashboard — never commit `.env` files.

---

## Tech Stack

- **Frontend:** React 18 (Vite) · React Router · TypeScript · Tailwind CSS · pdf.js
- **Backend:** Node.js 22 · Express · TypeScript · tsx
- **Database:** PostgreSQL 16 · Prisma ORM
- **Date engine:** date-fns · date-holidays
- **AI:** @anthropic-ai/sdk (Claude) — stub, not active yet
- **Alerts:** Twilio · SendGrid — stub, not active yet
- **Payments:** Stripe — stub, not active yet
