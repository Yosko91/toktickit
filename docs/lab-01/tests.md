# Lab 1 - Test Plan and Evidence

All test files live under `server/tests/lab-01/` and `client/tests/lab-01/`.

| # | Test File | Tool | Test Description | Result |
|---|-----------|------|------------------|--------|
| API-01 | `server/tests/lab-01/health.test.ts` | Supertest | `GET /api/health` returns 200 and `{ status: "ok", service: "TokTickIT API" }` | Passed |
| API-02 | `server/tests/lab-01/categories.test.ts` | Supertest | `GET /api/categories` returns the four seeded categories in id order | Passed |
| UI-01 | `client/tests/lab-01/App.test.tsx` | Vitest | The TokTickIT heading renders | Passed |
| UI-02 | `client/tests/lab-01/App.test.tsx` | Vitest | The loading state changes to Online + the category list | Passed |
| UI-03 | `client/tests/lab-01/App.test.tsx` | Vitest | An API failure displays the Offline error message | Passed |

## How to run

```bash
cd server && npm test
cd client && npm test
```

API-02 reads the real PostgreSQL database, so `npx prisma migrate dev` and
`npm run prisma:seed` must have been run first.

## Passing terminal output

### Backend - Supertest (API-01, API-02)

```
> toktickit-server@1.0.0 test
> vitest run

 RUN  v4.1.10 C:/Users/yohan/toktickit/server

 v tests/lab-01/health.test.ts (1 test) 14ms
 v tests/lab-01/categories.test.ts (1 test) 217ms

 Test Files  2 passed (2)
      Tests  2 passed (2)
   Start at  15:05:07
   Duration  610ms
```

### Frontend - Vitest (UI-01, UI-02, UI-03)

```
> vite-react-typescript-starter@0.0.0 test
> vitest run

 RUN  v4.1.10 C:/Users/yohan/toktickit/client

 v tests/lab-01/App.test.tsx (3 tests) 204ms
   v App (3)
     v renders the TokTickIT heading 20ms
     v shows the loading state, then Online and the category list 115ms
     v shows an Offline error message when the API is unavailable 66ms

 Test Files  1 passed (1)
      Tests  3 passed (3)
   Start at  15:10:21
   Duration  2.23s
```

### Database evidence

The idempotent seed was run twice and reported `Seed complete - 4 categories in
database` both times. Prisma Studio confirms exactly four rows in the `Category`
table: Account and Access (id 1), Hardware (2), Software (3), Network (4).
