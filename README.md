# TokTickIT

IT service desk application for Account and Access, Hardware, Software, and Network requests.

- **Lab 1** delivered a vertical slice proving the whole stack works.
- **Lab 2** delivered the Requester ticketing MVP: Create Ticket, My Tickets, Ticket Detail and the
  Attachment lifecycle, under one Zen Green visual system.
- **Lab 3** replaced the temporary Development Requester selector with real authentication and
  server-side role-based authorization, and added the IT Staff queue and ticket operations, Public
  Comments, Internal Notes and Administrator user management.
- **Lab 4** adds Actions Taken under each Ticket, a backend resolution gate and an append-only
  status history, stale-update protection, a dashboard for every role, and the final regression and
  hardening of Labs 1 to 3.

Stack: **React + TypeScript + Vite -> Express REST API -> Prisma ORM -> PostgreSQL**, with Vitest,
Supertest, Testing Library and Playwright.

## Prerequisites

- Node.js 20 or later
- PostgreSQL 15 or later, running locally, with a database named `toktickit`

## Setup

```bash
# 1. Backend
cd server
npm install
cp .env.example .env          # then edit DATABASE_URL with your credentials
npx prisma migrate deploy     # applies the Lab 1 to Lab 4 migrations
npm run prisma:seed           # idempotent, safe to run again
npm run dev                   # http://localhost:3000

# 2. Frontend (second terminal)
cd client
npm install
cp .env.example .env          # VITE_API_URL=http://localhost:3000
npm run dev                   # http://localhost:5173
```

If port 5173 is already used by another application, start the client on another port and tell
the API to accept it:

```bash
cd server && CLIENT_ORIGIN=http://localhost:5180 npm run dev
cd client && npx vite --port 5180 --strictPort
```

### Development accounts

Every seeded account uses the same password, **`TokTick!2026`**. These are local development
values only, not real credentials.

| Role | Email | Notes |
|---|---|---|
| Requester | `jennifer.anderson@toktickit.dev` | Has tickets, with Actions Taken |
| Requester | `sarah.johnson@toktickit.dev` | Has a ticket Waiting for Requester |
| Requester | `priya.nair@toktickit.dev` | Never has a ticket, for the empty states |
| Requester | `nina.sato@toktickit.dev` | Starts with an initial password (first-login change) |
| Requester | `alex.turner@toktickit.dev` | Inactive |
| IT Staff | `michael.brown@toktickit.dev` | Owns seeded tickets, has an open action |
| IT Staff | `emily.davis@toktickit.dev`, `kwan.thongchai@toktickit.dev` | Colleagues for actions done by someone other than the owner |
| IT Staff | `robert.wilson@toktickit.dev` | Inactive, refused as performer or owner |
| Administrator | `john.smith@toktickit.dev` | User Management, dashboard with user counts |
| Administrator | `lisa.martinez@toktickit.dev` | Second administrator |

## Migrations, rollback and seed

`npx prisma migrate deploy` applies the two Lab 4 migrations on top of the Lab 3 database without
losing data (`docs/lab-04/specification.md` section 7). To check it on your own data:

```bash
cd server
npx tsx scripts/lab-04-migration-check.ts snapshot before.json   # before migrating
npx prisma migrate deploy
npx tsx scripts/lab-04-migration-check.ts snapshot after.json
npx tsx scripts/lab-04-migration-check.ts compare before.json after.json
npx tsx scripts/lab-04-migration-check.ts rollback               # tests the rollback on a copy
```

The rollback script is `server/prisma/rollback/lab4_down.sql`. It removes only what Lab 4 added;
take a `pg_dump` first because the Actions Taken and the history are lost. The `rollback` check
needs the dev server to be stopped (copying a database needs no open connection on it).

## Tests

```bash
cd server && npm test      # 220 tests: unit, API, authorization, dashboards vs SQL, migration
cd client && npm test      # 72 component tests
npx playwright test        # 57 end-to-end, responsive and visual tests (repo root)
```

The API tests use the real PostgreSQL dev database and clean up what they create; the test files
run one after another because they share that database. Playwright starts or reuses both dev
servers. Use `E2E_CLIENT_URL=http://localhost:5180 npx playwright test` when the client runs on
another port. The end-to-end tests leave their tickets in the dev database (see
`docs/lab-04/tests.md` section 7). Test plans and results: `docs/lab-0X/tests.md`.

## Demonstration

1. Sign in as `jennifer.anderson@toktickit.dev`. You land on My Tickets. Open **Dashboard**: four
   counts, tickets that need you, recently updated and resolved tickets. Click a "View" link: My
   Tickets opens with the same filter.
2. Sign in as `michael.brown@toktickit.dev`. Open **Dashboard**: unassigned, assigned to me, my open
   actions, counts by status and IT priority, urgent tickets. Click Unassigned: the queue shows the
   same number of tickets.
3. Open the ticket "Laptop battery drains quickly". The **Actions Taken** card shows a completed
   action and a planned one performed by a colleague. Add an action, edit the planned one, move it
   to In Progress and then Completed with a result.
4. Try to resolve a ticket with an open action: the refusal is shown under the status control.
   Finish the action, resolve it, and see the **Status History**.
5. Sign in as Jennifer again: the same ticket shows "Work done by IT" read only, with no button.
6. Sign in as `priya.nair@toktickit.dev`: the dashboard shows zeros and empty lists.
7. Sign in as `john.smith@toktickit.dev`: the dashboard adds the user counts, and Users still works
   as in Lab 3.

## Environment variables

| File | Variable | Purpose |
|------|----------|---------|
| `server/.env` | `DATABASE_URL` | PostgreSQL connection string |
| `server/.env` | `PORT` | API port (default 3000) |
| shell | `CLIENT_ORIGIN` | Client origin allowed by CORS (default `http://localhost:5173`) |
| `client/.env` | `VITE_API_URL` | Base URL of the API |
| shell | `E2E_CLIENT_URL` | Client URL used by Playwright (default `http://localhost:5173`) |

Real `.env` files are git-ignored. Only `.env.example` is committed.

## REST API

Contracts: `docs/lab-02/api-spec.md`, `docs/lab-03/api-spec.md` and `docs/lab-04/api-spec.md`.
Identity comes from the `toktickit.sid` session cookie (Lab 3).

| Group | Paths |
|---|---|
| Health and reference data | `GET /api/health`, `/api/categories`, `/api/related-systems` |
| Authentication | `/api/auth/login`, `/logout`, `/me`, `/change-password` |
| Requester tickets | `/api/tickets` (create, list with filters including `statusGroup=active`), `/api/tickets/:id`, attachments, comments, requester-resolved |
| Attachments | `/api/attachments/:id`, `/download`, soft removal |
| IT Staff | `/api/staff/tickets` (queue), `/api/staff/tickets/:id` (detail with actions and history), owner, it-priority, status (with `version`), notes, `/api/staff/assignable-users` |
| Actions Taken (Lab 4) | `POST /api/staff/tickets/:id/actions`, `PATCH /api/staff/tickets/:id/actions/:actionId` (`DELETE` answers 405) |
| Dashboards (Lab 4) | `GET /api/dashboard/requester`, `GET /api/dashboard/staff` |
| Administrator | `/api/admin/users` |

## Repository structure

```
toktickit/
├── client/                React + TypeScript + Vite frontend
│   ├── src/               api.ts, context/, components/, pages/, utils/, styles/zen-theme.css
│   └── tests/             lab-02/, lab-03/, lab-04/ (Vitest + Testing Library)
├── server/                Express + TypeScript backend
│   ├── prisma/            schema.prisma, migrations/, rollback/, seed.ts
│   ├── scripts/           lab-02-evidence.ts, lab-04-migration-check.ts
│   ├── src/               routes/, middleware/, services/
│   └── tests/             lab-01/ to lab-04/, shared/ (Vitest + Supertest)
├── e2e/                   lab-02/, lab-03/, lab-04/ (Playwright)
├── artifacts/             lab-02/, lab-03/, lab-04/ screenshots and migration evidence
├── docs/                  lab-01/ to lab-04/: specification, api-spec, ui-spec, tests,
│                          reviewer, ai-use
├── playwright.config.ts
└── package.json           root: Playwright only
```

## Git workflow

`main` is the stable branch. Each lab has a staging branch (`lab4-staging` for Lab 4). Every Issue
is done on its own feature branch, merged into the staging branch with a Pull Request ("Create a
merge commit", in order, because each branch starts from the previous one), and then one release
Pull Request merges the staging branch into `main`.

| Order | Lab 4 feature branch | Scope |
|-------|----------------------|-------|
| 1 | `feature/lab4-01-spec-and-test-plan` | specification, api-spec, ui-spec, test plan |
| 2 | `feature/lab4-02-actions-taken-foundation` | migration, model, seed, Actions Taken API and tests |
| 3 | `feature/lab4-03-actions-taken-ui` | Actions Taken card, create and edit modes, tests |
| 4 | `feature/lab4-04-ticket-workflow` | resolution gate, status history, version checks, tests |
| 5 | `feature/lab4-05-role-dashboards` | dashboard APIs and screens, drill-down, tests |
| 6 | `feature/lab4-06-final-hardening` | regression fixes, end-to-end and visual tests, docs |

Review records: `docs/lab-0X/reviewer.md`.
