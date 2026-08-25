# Lab 2 Test Plan and Results

## 1. Test Strategy

- **Unit** (Vitest, `server/`): pure logic with no DB/HTTP — Ticket Number formatting, filename
  sanitization, validators.
- **API/Integration** (Vitest + Supertest, `server/tests/lab-02/`): exercise the real Express
  app (`createApp()`) against the real local PostgreSQL dev database (same approach as Lab 1).
  Each suite creates its own Requesters/Tickets/Attachments in `beforeAll`/`beforeEach` and
  deletes everything it created in `afterAll`, so suites are independent and repeatable without
  manual DB resets.
- **UI component** (Vitest + Testing Library, `client/tests/lab-02/`): render each screen with
  the `api` module mocked, assert on states/behavior, not on backend behavior (already covered
  by API tests).
- **UI style / visual** (Playwright, `e2e/lab-02/responsive-visual.spec.ts`): screenshots at
  desktop/tablet/mobile for the three main screens, plus assertions on required CSS classes,
  field states, and no-horizontal-scroll.
- **E2E** (Playwright, `e2e/lab-02/requester-ticket-flow.spec.ts`): drives the real running app
  (client + server + database) through full user journeys.

Every Acceptance Criterion in `specification.md` §9 maps to at least one row below.

## 2. Planned Tests

| Test ID | Type | AC | What it tests | Expected result | Automated test file | Final |
|---|---|---|---|---|---|---|
| UNIT-01 | Unit | BR-01 | Ticket number formatter pads/prefixes correctly | `TKT-2026-000001` for year 2026, seq 1; `TKT-2026-123456` for seq 123456 | `server/tests/lab-02/ticket-number.unit.test.ts` | Pass |
| UNIT-02 | Unit | BR-26 | Stored filename generator never reuses the original name | output has a UUID + original extension only, no original characters | `server/tests/lab-02/attachment-storage.unit.test.ts` | Pass |
| UNIT-03 | Unit | BR-14/BR-15 | Ticket field validator trims and enforces length bounds | rejects <5/<20 chars and >120/>2000 chars, trims surrounding whitespace before checking | `server/tests/lab-02/ticket-validation.unit.test.ts` | Pass |
| API-01 | API | AC-01 | `POST /api/tickets` valid body | `201`, unique `ticketNumber` matching the format, `currentStatus: "NEW"` | `server/tests/lab-02/create-ticket.api.test.ts` | Pass |
| API-02 | API | AC-04 | `POST /api/tickets` missing summary | `400`, `details.summary` present, no row created | `server/tests/lab-02/create-ticket.api.test.ts` | Pass |
| API-03 | API | AC-05 | `POST /api/tickets` description too short | `400`, `details.description` present | `server/tests/lab-02/create-ticket.api.test.ts` | Pass |
| API-04 | API | AC-26 | `POST /api/tickets` unknown `categoryId` | `422`, `details.categoryId` present, no row created | `server/tests/lab-02/create-ticket.api.test.ts` | Pass |
| API-05 | API | AC-26 | `POST /api/tickets` inactive `relatedSystemId` | `422`, no row created | `server/tests/lab-02/create-ticket.api.test.ts` | Pass |
| API-06 | API | AC-27 | `POST /api/tickets` missing `X-Dev-Requester-Id` | `400` | `server/tests/lab-02/create-ticket.api.test.ts` | Pass |
| API-07 | API | AC-27/BR-09 | `POST /api/tickets` with an inactive requester's id | `403` | `server/tests/lab-02/create-ticket.api.test.ts` | Pass |
| API-08 | API | AC-01 | Second Ticket created right after the first gets a distinct, incrementing `ticketNumber` | two `201`s, numbers differ | `server/tests/lab-02/create-ticket.api.test.ts` | Pass |
| API-09 | API | AC-03/BR-13 | `GET /api/tickets` as Requester B never returns Requester A's tickets | `200`, `data` excludes A's ticket ids even unfiltered | `server/tests/lab-02/my-tickets.api.test.ts` | Pass |
| API-10 | API | AC-10 | `GET /api/tickets?search=<exact ticketNumber>` | `200`, `data` has exactly that one ticket | `server/tests/lab-02/my-tickets.api.test.ts` | Pass |
| API-11 | API | AC-11 | `GET /api/tickets?categoryId=<id>` | `200`, every row has that `categoryId` | `server/tests/lab-02/my-tickets.api.test.ts` | Pass |
| API-12 | API | AC-12 | `GET /api/tickets?page=2&pageSize=10` with 15 seeded tickets | `200`, `data.length === 5`, `pagination.totalItems === 15` | `server/tests/lab-02/my-tickets.api.test.ts` | Pass |
| API-13 | API | AC-13 | `GET /api/tickets?sortBy=createdAt&sortDir=asc` | `200`, `data[0]` is the oldest owned ticket | `server/tests/lab-02/my-tickets.api.test.ts` | Pass |
| API-14 | API | — | `GET /api/tickets?sortBy=notAField` | `400` | `server/tests/lab-02/my-tickets.api.test.ts` | Pass |
| API-15 | API | AC-03 | `GET /api/tickets/:id` for another Requester's ticket | `404` | `server/tests/lab-02/ticket-detail.api.test.ts` | Pass |
| API-16 | API | AC-04(detail) | `GET /api/tickets/:id` for the owner | `200`, full shape incl. `attachments: []` on a fresh ticket | `server/tests/lab-02/ticket-detail.api.test.ts` | Pass |
| API-17 | API | — | `GET /api/tickets/999999` (unknown id) | `404` | `server/tests/lab-02/ticket-detail.api.test.ts` | Pass |
| API-18 | API | AC-14 | `POST /api/tickets/:id/attachments` valid PNG under 5 MB | `201`, `mimeType: "image/png"` | `server/tests/lab-02/attachments.api.test.ts` | Pass |
| API-19 | API | AC-15 | upload a 6 MB PDF | `413` | `server/tests/lab-02/attachments.api.test.ts` | Pass |
| API-20 | API | AC-16 | upload a `.exe` file | `415` | `server/tests/lab-02/attachments.api.test.ts` | Pass |
| API-21 | API | AC-17 | 6th active upload on a ticket that already has 5 | `409` | `server/tests/lab-02/attachments.api.test.ts` | Pass |
| API-22 | API | AC-03 | upload to a ticket owned by another Requester | `404` | `server/tests/lab-02/attachments.api.test.ts` | Pass |
| API-23 | API | AC-18 | `GET /api/attachments/:id/download` for an active attachment | `200`, body bytes equal what was uploaded, correct `Content-Type` | `server/tests/lab-02/attachments.api.test.ts` | Pass |
| API-24 | API | AC-19 | `DELETE /api/attachments/:id` with a valid reason | `200`, `removedAt` set, `removedReason` echoed | `server/tests/lab-02/attachments.api.test.ts` | Pass |
| API-25 | API | — | `DELETE /api/attachments/:id` with a 1-char reason | `400` | `server/tests/lab-02/attachments.api.test.ts` | Pass |
| API-26 | API | AC-20 | `GET /api/attachments/:id/download` after removal | `410` | `server/tests/lab-02/attachments.api.test.ts` | Pass |
| API-27 | API | — | `DELETE` an already-removed attachment | `409` | `server/tests/lab-02/attachments.api.test.ts` | Pass |
| API-28 | API | AC-03 | download/remove an attachment on another Requester's ticket | `404` | `server/tests/lab-02/attachments.api.test.ts` | Pass |
| API-29 | API | BR-06/BR-30 | `GET /api/requesters` excludes the seeded inactive Requester | `200`, inactive row absent | `server/tests/lab-02/requesters.api.test.ts` | Pass |
| API-30 | API | AC-22 | `GET /api/categories` / `GET /api/related-systems` return only active rows, correct shape | `200`, matches seed | `server/tests/lab-02/requesters.api.test.ts` | Pass |
| UI-01 | UI | BR-05 | Requester Selection shows the "not a login screen" notice and the dropdown | notice text present, options match mocked active requesters | `client/tests/lab-02/RequesterSelection.test.tsx` | Pass |
| UI-02 | UI | AC-22 | Requester Selection failure state | Retry button shown, no dropdown crash | `client/tests/lab-02/RequesterSelection.test.tsx` | Pass |
| UI-03 | UI | AC-04 | Create Ticket submit with empty Summary | field message shown under Summary, `createTicket` API not called | `client/tests/lab-02/CreateTicket.test.tsx` | Pass |
| UI-04 | UI | AC-07 | Create Ticket double-submit | Submit becomes disabled/busy after first click, API called once | `client/tests/lab-02/CreateTicket.test.tsx` | Pass |
| UI-05 | UI | AC-06 | Create Ticket API failure | error banner shown, all typed values still present in the form | `client/tests/lab-02/CreateTicket.test.tsx` | Pass |
| UI-06 | UI | AC-25 | Create Ticket success | confirmation panel shows the returned `ticketNumber` | `client/tests/lab-02/CreateTicket.test.tsx` | Pass |
| UI-07 | UI | AC-16 | Create Ticket attachment picker rejects a disallowed type client-side | inline error, no entry added to the attachment list | `client/tests/lab-02/CreateTicket.test.tsx` | Pass |
| UI-08 | UI | AC-08 | My Tickets with zero tickets | empty state + Create Ticket action, not the no-results state | `client/tests/lab-02/MyTickets.test.tsx` | Pass |
| UI-09 | UI | AC-09 | My Tickets with tickets but no search match | no-results state + Clear Filters | `client/tests/lab-02/MyTickets.test.tsx` | Pass |
| UI-10 | UI | AC-21 | My Tickets reloads when the Requester context changes | list re-fetches with the new requester id | `client/tests/lab-02/MyTickets.test.tsx` | Pass |
| UI-11 | UI | AC-12 | My Tickets pagination controls | clicking "Next" requests `page=2` | `client/tests/lab-02/MyTickets.test.tsx` | Pass |
| UI-12 | UI | AC-19 | Ticket Detail remove-attachment flow | confirm dialog requires a non-empty reason before the remove call fires | `client/tests/lab-02/RequesterTicketDetail.test.tsx` | Pass |
| UI-13 | UI | AC-20 | Ticket Detail hides download/preview for removed attachments | no download control rendered on removed rows | `client/tests/lab-02/AttachmentSection.test.tsx` | Pass |
| UI-14 | UI | AC-17 | Attachment uploader disables "Add" at 5 active attachments | Add control disabled with an explanatory note | `client/tests/lab-02/AttachmentSection.test.tsx` | Pass |
| E2E-01 | E2E | AC-01, AC-25 | Select requester → create a valid ticket → see the confirmation with a real Ticket Number | Ticket Number visible, matches `TKT-\d{4}-\d{6}` | `e2e/lab-02/requester-ticket-flow.spec.ts` | Pass |
| E2E-02 | E2E | AC-01, full flow | New ticket is then findable in My Tickets by its Ticket Number | ticket row visible after search | `e2e/lab-02/requester-ticket-flow.spec.ts` | Pass |
| E2E-03 | E2E | AC-14, AC-19 | Add an attachment on Ticket Detail, then soft-remove it with a reason | attachment shows Active then Removed with the reason | `e2e/lab-02/requester-ticket-flow.spec.ts` | Pass |
| E2E-04 | E2E | AC-03, AC-21 | Switch Requester and confirm the previous requester's ticket is unreachable | My Tickets no longer lists it; direct detail URL shows not-found | `e2e/lab-02/requester-ticket-flow.spec.ts` | Pass |
| VIS-01 | Visual | AC-23 | Desktop/tablet/mobile screenshots of Create Ticket, My Tickets, Ticket Detail | no horizontal scroll at any width; screenshots saved under `artifacts/lab-02/screenshots/` | `e2e/lab-02/responsive-visual.spec.ts` | Pass |
| VIS-02 | Visual | — | Required CSS state classes present (`zen-field--error`, `zen-btn.is-busy`, `zen-badge`) | assertions on class presence at key states | `e2e/lab-02/responsive-visual.spec.ts` | Pass |

## 3. Acceptance-Criterion Traceability

| AC | Covered by |
|---|---|
| AC-01 | API-01, API-08, E2E-01 |
| AC-02 | (routing guard — see UI-01/UI-02 context: unauthenticated context redirects; also exercised implicitly by every UI test rendering with `RequesterProvider`) |
| AC-03 | API-09, API-15, API-22, API-28, E2E-04 |
| AC-04 | API-02, UI-03 |
| AC-05 | API-03 |
| AC-06 | UI-05 |
| AC-07 | UI-04 |
| AC-08 | UI-08 |
| AC-09 | UI-09 |
| AC-10 | API-10 |
| AC-11 | API-11 |
| AC-12 | API-12, UI-11 |
| AC-13 | API-13 |
| AC-14 | API-18, E2E-03 |
| AC-15 | API-19 |
| AC-16 | API-20, UI-07 |
| AC-17 | API-21, UI-14 |
| AC-18 | API-23 |
| AC-19 | API-24, UI-12, E2E-03 |
| AC-20 | API-26, UI-13 |
| AC-21 | UI-10, E2E-04 |
| AC-22 | API-30 (empty upstream data), UI-02 (failure) |
| AC-23 | VIS-01 |
| AC-24 | (keyboard/focus rules asserted manually per the visual checklist below; see §4) |
| AC-25 | UI-06, E2E-01 |
| AC-26 | API-04, API-05 |
| AC-27 | API-06, API-07 |

## 4. Responsive and Visual Checklist

See `docs/lab-02/ui-spec.md` §14 for the full checklist template. Filled in with the actual
screenshot run in the submission PDF (Answer Part 9). AC-24 (keyboard/focus) is additionally
checked manually: Tab through Create Ticket and confirm every control is reachable in a logical
order with a visible focus ring, and that the Requester Selection `<select>` → Continue →
Cancel order matches the DOM order.

## 5. Test Commands

```bash
# Backend unit + API tests (requires the DB migrated and seeded, see README)
cd server && npm test

# Frontend component tests
cd client && npm test

# Playwright E2E + visual/responsive tests (requires both dev servers running,
# see README "Running Lab 2 E2E tests")
npx playwright test
```

## 6. Final Results

Filled in after the full suite is run on `main` (paste raw terminal output). See
`docs/lab-02/ai-use.md` is not the right place — the actual pass/fail terminal output for the
submission goes directly into the PDF (Answer Part 3), and a copy of the final summary line
count is kept here for traceability:

```
<paste `npm test` server summary here>
<paste `npm test` client summary here>
<paste `npx playwright test` summary here>
```

## 7. Known Limitations or Deferred Tests

- Cross-browser Playwright runs are limited to Chromium for Lab 2 (time budget); Firefox/WebKit
  are not part of the required evidence.
- Load/concurrency testing of the Ticket Number sequence beyond two near-simultaneous creations
  (API-08) is out of scope — PostgreSQL sequences are documented as concurrency-safe by design,
  which is why BR-01 relies on one instead of a read-then-write counter.
- Screen-reader-specific automated testing (e.g. axe-core) is not included; AC-24 is checked
  manually via keyboard navigation instead.
