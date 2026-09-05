# TokTickIT

IT service desk application for Account and Access, Hardware, Software, and Network requests.

- **Lab 1** delivered a vertical slice proving the whole stack works.
- **Lab 2** delivers the Requester-facing ticketing MVP: a temporary Development Requester
  selector (testing mechanism, not authentication - see `docs/lab-02/specification.md`), Create
  Ticket, My Tickets (search/filter/sort/pagination), Requester Ticket Detail, and the
  Attachment lifecycle (upload, download, soft removal), all under one Zen Green visual system.

Stack: **React + TypeScript + Vite -> Express REST API -> Prisma ORM -> PostgreSQL**, with
Playwright for end-to-end and visual/responsive evidence.

## Repository structure

```
toktickit/
├── client/                       React + TypeScript + Vite frontend
│   ├── src/
│   │   ├── api.ts                REST client for the full Lab 2 contract
│   │   ├── context/               RequesterContext (Development Requester)
│   │   ├── components/            AppShell, form fields, badges, attachment UI, ...
│   │   ├── pages/                 RequesterSelection, CreateTicket, MyTickets, TicketDetail
│   │   └── styles/                Zen Green theme (docs/lab-02/ui-spec.md)
│   └── tests/lab-01/, lab-02/    Vitest + Testing Library
├── server/                       Node.js + Express + TypeScript backend
│   ├── prisma/                    schema.prisma, seed.ts, migrations/
│   ├── src/
│   │   ├── routes/                categories, related-systems, requesters, tickets, attachments
│   │   ├── middleware/             X-Dev-Requester-Id identity check
│   │   └── services/               ticket number, validation, attachment storage, query building
│   ├── uploads/lab-02/            Uploaded attachment files (git-ignored, created on demand)
│   └── tests/lab-01/, lab-02/    Vitest + Supertest, against the real dev database
├── e2e/lab-02/                    Playwright E2E + responsive/visual tests
├── artifacts/lab-02/screenshots/  Committed Create Ticket / My Tickets / Ticket Detail screenshots
├── docs/lab-01/, lab-02/         specification.md, tests.md, ui-spec.md, api-spec.md,
│                                  reviewer.md, ai-use.md
├── playwright.config.ts
├── package.json                  Root-level: Playwright only (client/server have their own)
└── README.md
```

## Prerequisites

- Node.js 20 or later
- PostgreSQL 15 or later, running locally
- A database named `toktickit`

## Setup

### 1. Database

```sql
CREATE DATABASE toktickit;
```

### 2. Backend

```bash
cd server
npm install
cp .env.example .env          # then edit DATABASE_URL with your credentials
npx prisma migrate dev
npm run prisma:seed           # idempotent - safe to run again
npm run dev                   # http://localhost:3000
```

The seed creates the four Categories, seven Related Systems, and seven Development Requesters
(six active, one inactive - see `server/prisma/seed.ts`) needed by the Lab 2 screens.

### 3. Frontend

```bash
cd client
npm install
cp .env.example .env          # VITE_API_URL=http://localhost:3000
npm run dev                   # http://localhost:5173
```

### 4. End-to-end tests (optional, root of the repo)

```bash
npm install                   # installs @playwright/test at the repo root
npx playwright install chromium
npx playwright test           # starts/reuses both dev servers automatically
```

## Environment variables

| File | Variable | Purpose |
|------|----------|---------|
| `server/.env` | `DATABASE_URL` | PostgreSQL connection string |
| `server/.env` | `PORT` | API port (default 3000) |
| `client/.env` | `VITE_API_URL` | Base URL of the API |

Real `.env` files are git-ignored. Only `.env.example` is committed.

## REST endpoints

Full contract, request/response shapes, validation, and status codes: `docs/lab-02/api-spec.md`.

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/health` | Liveness check |
| GET | `/api/categories` | Active Categories |
| GET | `/api/related-systems` | Active Related Systems |
| GET | `/api/requesters` | Active Development Requesters (selector) |
| POST | `/api/tickets` | Create a Ticket for the current Requester |
| GET | `/api/tickets` | List the current Requester's Tickets (search/filter/sort/page) |
| GET | `/api/tickets/:id` | One owned Ticket, with its Attachments |
| POST | `/api/tickets/:id/attachments` | Upload one Attachment |
| GET | `/api/attachments/:id` | Attachment metadata |
| GET | `/api/attachments/:id/download` | Download one active Attachment |
| DELETE | `/api/attachments/:id` | Soft-remove one Attachment |

All `/api/tickets*` and `/api/attachments*` routes require an `X-Dev-Requester-Id` header - the
Lab 2 testing mechanism described in `docs/lab-02/specification.md` (not authentication).

## Usage

1. Open http://localhost:5173 - you land on **Select Development Requester**.
2. Choose an active Requester and continue. The app shell then shows your name and a **Change
   Requester** action.
3. **Create Ticket**: pick a Category, Related System, and Requested Priority, write a Summary
   and Description, optionally attach up to five JPG/PNG/WEBP/PDF files (5 MB max each), and
   submit. The backend-issued Ticket Number is shown on success.
4. **My Tickets**: search, filter, sort, and page through your own Tickets; open one to see its
   detail.
5. **Ticket Detail**: read-only Ticket information plus the Attachments panel - add, download, or
   soft-remove (with a reason) your own Attachments.

## Tests

```bash
cd server && npm test         # Vitest + Supertest - unit + API (docs/lab-02/tests.md UNIT-*/API-*)
cd client && npm test         # Vitest + Testing Library - UI components (UI-*)
npx playwright test           # from the repo root - E2E + responsive/visual (E2E-*/VIS-*)
```

Backend API tests read/write the real PostgreSQL dev database (migrated + seeded, see above) and
clean up everything they create. Playwright drives the real running app end to end, so it also
creates real Tickets in the dev database - see `docs/lab-02/tests.md` section 7 for that
tradeoff. The full test plan, acceptance-criterion traceability, and final pass counts are in
`docs/lab-02/tests.md`.

## Lab 2 git workflow

`main` is the stable branch, `lab2-staging` is the Lab 2 integration branch (branched from
`main` once Lab 1 was complete). Each Issue is implemented on its own feature branch and enters
`lab2-staging` through a peer-reviewed Pull Request, merged **in the order below** using
"Create a merge commit" (not squash/rebase - later branches were started from the tip of the
previous one, so a non-linear merge keeps each PR's diff small and accurate). Once all seven are
in `lab2-staging` and integration-tested, one release Pull Request merges `lab2-staging` into
`main`.

| Order | Feature branch | Scope |
|-------|-----------------|-------|
| 1 | `feature/lab2-01-spec-and-test-plan` | `specification.md`, `api-spec.md`, `ui-spec.md`, `tests.md`, `ai-use.md`, `reviewer.md` |
| 2 | `feature/lab2-02-backend-foundation` | Prisma schema/migration/seed, full REST API, backend tests |
| 3 | `feature/lab2-03-requester-context-and-shell` | `RequesterContext`, app shell/nav, Requester Selection screen, Zen Green theme |
| 4 | `feature/lab2-04-create-ticket-ui` | Create Ticket screen, attachment picker, its tests |
| 5 | `feature/lab2-05-my-tickets-ui` | My Tickets screen, pagination, its tests |
| 6 | `feature/lab2-06-ticket-detail-attachments-ui` | Ticket Detail, Attachment lifecycle UI, its tests |
| 7 | `feature/lab2-07-e2e-and-visual-tests` | Playwright E2E + responsive/visual suite, committed screenshots |
| 8 | `feature/lab2-08-docs-and-release-prep` | Final docs, README, test-result traceability, release cleanup |

See `docs/lab-02/reviewer.md` for the PR links, review comments, and responses once each PR is
opened and reviewed.
