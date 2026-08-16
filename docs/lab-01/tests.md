# Lab 1 - Test Plan and Evidence

All test files live under `server/tests/lab-01/` and `client/tests/lab-01/`.

| # | Test File | Tool | Test Description | Result |
|---|-----------|------|------------------|--------|
| API-01 | `server/tests/lab-01/health.test.ts` | Supertest | `GET /api/health` returns 200 and `{ status: "ok", service: "TokTickIT API" }` | Passed |
| API-02 | `server/tests/lab-01/categories.test.ts` | Supertest | `GET /api/categories` returns the four seeded categories in id order | Passed |
| UI-01 | `client/tests/lab-01/App.test.tsx` | Vitest | The TokTickIT heading renders | Passed |
| UI-02 | `client/tests/lab-01/App.test.tsx` | Vitest | The loading state changes to the category list on success (System Status: Online) | Passed |
| UI-03 | `client/tests/lab-01/App.test.tsx` | Vitest | An API failure displays a useful error message (System Status: Offline) | Passed |

## How to run

```bash
cd server && npm test
cd client && npm test
```

API-02 requires `npx prisma migrate dev` and `npm run prisma:seed` to have been
run first, since it reads the real PostgreSQL database.

## Passing terminal output

<!-- Paste the screenshots / copied output of both test runs below. -->

### Backend (Supertest)

```
<paste here>
```

### Frontend (Vitest)

```
<paste here>
```
