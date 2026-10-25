# Lab 4 Test Plan and Results

Written before the implementation branches, together with `specification.md`. The `Final` column
starts as `Planned`. I only change it to `Pass` after the test really ran and passed.

## 1. Test strategy

Same layers as Lab 3, plus migration and performance smoke checks.

Unit tests cover the pure rules: the Action Taken status moves, the action field rules and the
resolution gate. API tests use Supertest on the real Express app and the real PostgreSQL database,
no mocks, because the backend is the authority for every Lab 4 rule. Component tests use Vitest and
Testing Library with the API module mocked. End-to-end tests use Playwright on the real client,
server and database. Visual tests take desktop (1440), tablet (768) and mobile (390) screenshots
and measure horizontal overflow. Migration checks compare the database before and after the Lab 4
migrations and test the rollback script on a copy of the database. A performance smoke test checks
that the dashboards answer fast with the real data.

Dashboard numbers are checked against SQL written by hand from the calculation table in
`api-spec.md`, not against the same Prisma code, so a mistake in the service cannot hide itself.

Regression is the complete Lab 1, Lab 2 and Lab 3 suites, run again on `main` without changes.

## 2. Planned tests

| Test ID | Type | Requirement / AC | What it tests | Expected result | Automated test file | Final |
|---|---|---|---|---|---|---|
| UNIT-01 | Unit | BR-08 | Action status moves | every permitted move accepted, every other refused, Completed and Cancelled final | `server/tests/lab-04/action-rules.unit.test.ts` | Pass |
| UNIT-02 | Unit | BR-05, BR-06, BR-07, BR-09 | Action field rules | description required and max 2000, note required with follow-up, result required when completed, future date only when planned | `server/tests/lab-04/action-rules.unit.test.ts` | Pass |
| UNIT-03 | Unit | BR-18 | Resolution gate | blocked without owner, without completed action, with an open action; allowed otherwise | `server/tests/lab-04/action-rules.unit.test.ts` | Pass |
| API-01 | API | AC-01 | Create a valid Action Taken | `201`, under the right Ticket, created by and performed by the session user | `server/tests/lab-04/actions-taken.api.test.ts` | Pass |
| API-02 | API | AC-03, BR-02 | Create for a colleague | performed by the colleague, created by the session user, colleague is not the owner | `server/tests/lab-04/actions-taken.api.test.ts` | Pass |
| API-03 | API | AC-04 | Inactive staff as performer | `422`, no row saved | `server/tests/lab-04/actions-taken.api.test.ts` | Pass |
| API-04 | API | AC-04 | Requester as performer | `422`, no row saved | `server/tests/lab-04/actions-taken.api.test.ts` | Pass |
| API-05 | API | AC-05 | Follow-up required without note | `400` with `details.followUpNote` | `server/tests/lab-04/actions-taken.api.test.ts` | Pass |
| API-06 | API | AC-06 | Completed without result, future date, date before the Ticket | `400` each; a Planned action in the future is accepted | `server/tests/lab-04/actions-taken.api.test.ts` | Pass |
| API-07 | API | AC-07, BR-10 | Planned, then In Progress, then Completed, then edit again | each step `200` with version + 1, last edit `409 ACTION_READ_ONLY` | `server/tests/lab-04/actions-taken.api.test.ts` | Pass |
| API-08 | API | AC-08, BR-13 | Edit with an old version | `409 STALE_UPDATE`, stored action unchanged | `server/tests/lab-04/actions-taken.api.test.ts` | Pass |
| API-09 | API | BR-08 | Illegal status move (In Progress back to Planned) and Cancelled at creation | `409 INVALID_TRANSITION` / `400` | `server/tests/lab-04/actions-taken.api.test.ts` | Pass |
| API-10 | API | AC-09, BR-03 | Requester calls create and edit directly | `403`, nothing saved | `server/tests/lab-04/actions-taken.api.test.ts` | Pass |
| API-11 | API | FR-05, BR-03 | Requester reads actions of own Ticket and of another Requester's Ticket | own: `200` with `actionsTaken`, other: `404` | `server/tests/lab-04/actions-taken.api.test.ts` | Pass |
| API-12 | API | AC-12, BR-11 | Create or edit on a Resolved, Closed or Cancelled Ticket | `409 TICKET_NOT_WORKABLE` | `server/tests/lab-04/actions-taken.api.test.ts` | Pass |
| API-13 | API | AC-15, BR-14 | Same create sent twice with one `clientRequestId` | first `201`, second `200` with same id, one row | `server/tests/lab-04/actions-taken.api.test.ts` | Pass |
| API-14 | API | BR-10 | `DELETE` an action | `405`, row still there | `server/tests/lab-04/actions-taken.api.test.ts` | Pass |
| API-15 | API | BR-01 | Edit an action through another Ticket id | `404` | `server/tests/lab-04/actions-taken.api.test.ts` | Pass |
| API-16 | API | BR-15 | Order of the list | actionAt asc, then id asc | `server/tests/lab-04/actions-taken.api.test.ts` | Pass |
| API-17 | API | BR-12 | Creating an action moves Ticket `updatedAt` but not `version` or status | as stated | `server/tests/lab-04/actions-taken.api.test.ts` | Pass |
| API-20 | API | AC-10 | Resolve with no completed action | `409 NO_COMPLETED_ACTION`, status unchanged | `server/tests/lab-04/ticket-workflow.api.test.ts` | Pass |
| API-21 | API | AC-10 | Resolve with an open action | `409 OPEN_ACTIONS`, status unchanged | `server/tests/lab-04/ticket-workflow.api.test.ts` | Pass |
| API-22 | API | AC-11 | Resolve with completed actions only | `200`, `resolvedAt` set, one history row | `server/tests/lab-04/ticket-workflow.api.test.ts` | Pass |
| API-23 | API | BR-21 | Reopen clears `resolvedAt`, Close keeps it | as stated | `server/tests/lab-04/ticket-workflow.api.test.ts` | Pass |
| API-24 | API | AC-13, BR-22 | Old version on status, owner and IT Priority | `409 STALE_UPDATE` each, nothing changed | `server/tests/lab-04/ticket-workflow.api.test.ts` | Pass |
| API-25 | API | BR-22 | Lab 3 call without `version` | still `200` | `server/tests/lab-04/ticket-workflow.api.test.ts` | Pass |
| API-26 | API | AC-14, BR-20 | Several changes, then read history; try to edit or delete history | ordered oldest first, one row per change, no route (`404`) | `server/tests/lab-04/ticket-workflow.api.test.ts` | Pass |
| API-27 | API | BR-23 | Requester calls the status endpoint | `403` | `server/tests/lab-04/ticket-workflow.api.test.ts` | Pass |
| API-28 | API | BR-19 | Requester says resolved, staff then resolve without actions | status unchanged by the Requester, gate still refuses | `server/tests/lab-04/ticket-workflow.api.test.ts` | Pass |
| API-29 | API | BR-22 | Version moves on owner, priority, status, not on a comment | as stated | `server/tests/lab-04/ticket-workflow.api.test.ts` | Pass |
| API-30 | API | FR-12, BR-25 | `statusGroup=active` on My Tickets and on the queue; bad value | only active statuses; `400` | `server/tests/lab-04/ticket-workflow.api.test.ts` | Pass |
| API-40 | API | AC-02, BR-26 | Requester dashboard counts own Tickets only | counts match the Requester's own Tickets, other Requester ignored | `server/tests/lab-04/requester-dashboard.api.test.ts` | Pass |
| API-41 | API | AC-20 | Requester with no Tickets | all counts 0, all lists empty | `server/tests/lab-04/requester-dashboard.api.test.ts` | Pass |
| API-42 | API | BR-27, BR-30, BR-32 | Lists: max 5, order, 30 day window | resolved 40 days ago not listed, max 5 rows | `server/tests/lab-04/requester-dashboard.api.test.ts` | Pass |
| API-43 | API | AC-18 | Staff on the Requester dashboard; no session | `403`; `401` | `server/tests/lab-04/requester-dashboard.api.test.ts` | Pass |
| API-44 | API | AC-19 | Each metric link used as a My Tickets filter | `totalItems` equals the metric | `server/tests/lab-04/requester-dashboard.api.test.ts` | Pass |
| API-50 | API | AC-16, BR-24 | Staff counts against hand written SQL | every metric equals its SQL count | `server/tests/lab-04/staff-dashboard.api.test.ts` | Pass |
| API-51 | API | FR-10, BR-28 | Assigned to Me and My Open Actions for a new staff user | exact numbers, only active Tickets | `server/tests/lab-04/staff-dashboard.api.test.ts` | Pass |
| API-52 | API | AC-17, BR-29 | Administrator vs IT Staff | `userCounts` only for the Administrator and equal to SQL | `server/tests/lab-04/staff-dashboard.api.test.ts` | Pass |
| API-53 | API | AC-18 | Requester on the staff dashboard; no session | `403`; `401` | `server/tests/lab-04/staff-dashboard.api.test.ts` | Pass |
| API-54 | API | AC-19 | Each staff metric link used as a queue filter | `totalItems` equals the metric | `server/tests/lab-04/staff-dashboard.api.test.ts` | Pass |
| API-55 | API | BR-28, BR-32 | Urgent list order and size | High and active only, oldest first, max 5 | `server/tests/lab-04/staff-dashboard.api.test.ts` | Pass |
| PERF-01 | Performance smoke | BR-24 | Both dashboards on the real database | under 500 ms per call (average of 5) | `server/tests/lab-04/staff-dashboard.api.test.ts` | Pass |
| MIG-01 | Migration | AC-21, BR-35 | Legacy Resolved and Closed Tickets | all have `resolvedAt`, every Ticket has `version` >= 1 | `server/tests/lab-04/migration.api.test.ts` | Pass |
| MIG-02 | Migration | AC-21, BR-34 | Legacy Ticket read through both detail endpoints | `actionsTaken: []`, `statusHistory: []`, everything else as before | `server/tests/lab-04/migration.api.test.ts` | Pass |
| MIG-03 | Migration (script) | AC-21, BR-33 | Row counts and checksums before and after `prisma migrate deploy` | identical for User, Ticket, Attachment, PublicComment, InternalNote | `server/scripts/lab-04-migration-check.ts` | Pass |
| MIG-04 | Migration (script) | Spec section 7 | Rollback script on a copy of the database | Lab 4 tables and columns gone, Lab 3 data identical, copy dropped | `server/scripts/lab-04-migration-check.ts` | Pass |
| SEED-01 | Seed (script) | BR-36 | Seed run twice | same counts after the second run, zero / one / several actions present | `server/prisma/seed.ts` | Pass |
| UI-01 | Component | FR-10, AC-19 | Staff dashboard cards | label, value and link with the right filter | `client/tests/lab-04/StaffDashboard.test.tsx` | Pass |
| UI-02 | Component | AC-17 | Administrator vs IT Staff | user counts card only for the Administrator | `client/tests/lab-04/StaffDashboard.test.tsx` | Pass |
| UI-03 | Component | BR-31, FR-15 | Loading, error with Retry, empty lists | spinner, safe failure panel, empty sentences, 0 still shown | `client/tests/lab-04/StaffDashboard.test.tsx` | Pass |
| UI-04 | Component | FR-09, AC-20 | Requester dashboard with data and with nothing | own metrics and lists; all 0 and empty sentences | `client/tests/lab-04/RequesterDashboard.test.tsx` | Pass |
| UI-05 | Component | FR-15 | Requester dashboard API failure | safe failure panel with Retry, Retry calls the API again | `client/tests/lab-04/RequesterDashboard.test.tsx` | Pass |
| UI-06 | Component | FR-04, BR-15 | Actions list | rows in API order, status badge text, follow-up marker, performer | `client/tests/lab-04/ActionsTaken.test.tsx` | Pass |
| UI-07 | Component | AC-05, FR-14 | Create form | performer defaults to me, note error under the field, button disabled while saving, `clientRequestId` sent | `client/tests/lab-04/ActionsTaken.test.tsx` | Pass |
| UI-08 | Component | BR-08, BR-10 | Edit mode | only permitted statuses offered, no Edit on finished rows | `client/tests/lab-04/ActionsTaken.test.tsx` | Pass |
| UI-09 | Component | AC-08, AC-24 | Stale save | warning with Reload, typed values kept | `client/tests/lab-04/ActionsTaken.test.tsx` | Pass |
| UI-10 | Component | AC-09 | Requester view | actions shown, no Add Action, no Edit | `client/tests/lab-04/ActionsTaken.test.tsx` | Pass |
| UI-11 | Component | AC-10 | Gate refusal on the status select | API message shown under the select | `client/tests/lab-04/TicketWorkflow.test.tsx` | Pass |
| UI-12 | Component | AC-13, BR-22 | Status change sends the version; stale answer | `version` in the call; conflict message with Reload | `client/tests/lab-04/TicketWorkflow.test.tsx` | Pass |
| UI-13 | Component | AC-14 | Status history card | rows oldest first with name; legacy message when empty | `client/tests/lab-04/TicketWorkflow.test.tsx` | Pass |
| UI-14 | Component | FR-13 | Navigation per role | Dashboard item for each role, Lab 3 items unchanged | `client/tests/lab-04/TicketWorkflow.test.tsx` | Pass |
| UI-15 | Component | FR-12 | Queue and My Tickets read the URL filter | first request uses the filter from the URL | `client/tests/lab-04/TicketWorkflow.test.tsx` | Pass |
| E2E-01 | E2E | AC-01, AC-03, AC-07, AC-09 | Actions Taken flow | staff record a completed action and a planned one for a colleague, start and complete it; Requester sees both read only | `e2e/lab-04/actions-taken-flow.spec.ts` | Pass |
| E2E-02 | E2E | AC-10, AC-11, AC-14 | Resolution flow | resolve refused while an action is open, accepted after, history shown, Requester sees Resolved | `e2e/lab-04/ticket-resolution.spec.ts` | Pass |
| E2E-03 | E2E | AC-13 | Two staff browsers on one Ticket | the second save gets the conflict message, nothing overwritten | `e2e/lab-04/ticket-resolution.spec.ts` | Pass |
| E2E-04 | E2E | AC-19, AC-16 | Staff dashboard drill-down | Unassigned card number equals the rows in the filtered queue | `e2e/lab-04/dashboards.spec.ts` | Pass |
| E2E-05 | E2E | AC-02, AC-20 | Requester dashboards | Jennifer sees own Tickets only, Priya sees zeros | `e2e/lab-04/dashboards.spec.ts` | Pass |
| VIS-01 | Visual | AC-23 | Staff and Administrator dashboard at 3 widths | screenshots, no horizontal overflow | `e2e/lab-04/responsive-visual.spec.ts` | Pass |
| VIS-02 | Visual | AC-23 | Requester dashboard at 3 widths | screenshots, no horizontal overflow | `e2e/lab-04/responsive-visual.spec.ts` | Pass |
| VIS-03 | Visual | AC-23 | Actions Taken list and form at 3 widths | screenshots, no horizontal overflow | `e2e/lab-04/responsive-visual.spec.ts` | Pass |
| A11Y-01 | Accessibility | AC-23 | Keyboard focus on dashboard links and action form | focus reaches each control with Tab and the outline is visible | `e2e/lab-04/responsive-visual.spec.ts` | Pass |
| REG-01 | Regression | AC-22 | Lab 1, 2 and 3 API and unit suites | all pass, unchanged | `server/tests/lab-01`, `lab-02`, `lab-03` | Pass |
| REG-02 | Regression | AC-22 | Lab 2 and 3 component suites | all pass, unchanged | `client/tests/lab-02`, `lab-03` | Pass |
| REG-03 | Regression | AC-22 | Lab 2 and 3 end-to-end and visual suites | all pass, unchanged | `e2e/lab-02`, `e2e/lab-03` | Pass |

## 3. Acceptance criterion traceability

| AC | Tests |
|---|---|
| AC-01 | API-01, E2E-01 |
| AC-02 | API-40, E2E-05 |
| AC-03 | API-02, E2E-01 |
| AC-04 | API-03, API-04 |
| AC-05 | API-05, UI-07 |
| AC-06 | API-06, UNIT-02 |
| AC-07 | API-07, UNIT-01, E2E-01 |
| AC-08 | API-08, UI-09 |
| AC-09 | API-10, UI-10, E2E-01 |
| AC-10 | API-20, API-21, UNIT-03, UI-11, E2E-02 |
| AC-11 | API-22, E2E-02 |
| AC-12 | API-12 |
| AC-13 | API-24, UI-12, E2E-03 |
| AC-14 | API-26, UI-13, E2E-02 |
| AC-15 | API-13 |
| AC-16 | API-50, E2E-04 |
| AC-17 | API-52, UI-02 |
| AC-18 | API-43, API-53 |
| AC-19 | API-44, API-54, UI-01, E2E-04 |
| AC-20 | API-41, UI-04, E2E-05 |
| AC-21 | MIG-01, MIG-02, MIG-03 |
| AC-22 | REG-01, REG-02, REG-03 |
| AC-23 | VIS-01, VIS-02, VIS-03, A11Y-01 |
| AC-24 | UI-09 |

## 4. Results

Run on `main` after the release merge. Every planned test above ran and passed. Nothing is skipped
and nothing is disabled.

| Suite | Command | Files | Tests | Of which Lab 4 |
|---|---|---|---|---|
| Backend unit and API (Labs 1 to 4) | `cd server && npm test` | 25 | 220 passed | 58 |
| Frontend components (Labs 2 to 4) | `cd client && npm test` | 14 | 72 passed | 19 |
| End-to-end and visual (Labs 2 to 4) | `npx playwright test` | 10 | 57 passed | 17 |
| Total | | | 349 passed | 94 |

The Lab 1 to Lab 3 tests are inside these numbers (162 backend, 53 frontend, 40 end-to-end), the
same count as at the end of Lab 3. They are the regression evidence for AC-22.

PERF-01 measured 14 ms on average per dashboard call with the real development database (257
tickets), far under the 500 ms limit.

Migration evidence (MIG-03), counts and checksums of the Lab 3 data before and after the first Lab
4 migration, from `server/scripts/lab-04-migration-check.ts`:

```
User              77 ->    77  same
Ticket           250 ->   250  same
Attachment        90 ->    90  same
PublicComment     53 ->    53  same
InternalNote      42 ->    42  same
No data lost or changed
```

Rollback evidence (MIG-04), on a copy of the database made with `CREATE DATABASE ... TEMPLATE`:

```
Copied toktickit to toktickit_rollback_check
Lab 4 objects left after rollback: 0
Lab 3 data before vs after the rollback:
User              77 ->    77  same
Ticket           252 ->   252  same
Attachment        90 ->    90  same
PublicComment     53 ->    53  same
InternalNote      42 ->    42  same
Rollback OK
Dropped toktickit_rollback_check
```

Seed evidence (SEED-01), the seed run twice in a row prints the same counts both times:

```
Seed complete - 77 users (71 requesters, 4 IT staff, 2 administrators), 257 tickets,
54 public comments, 43 internal notes, 11 actions taken.
```

## 5. Defects found by these tests

The Requester filter list from Lab 2 never got the two statuses added in Lab 3. `GET
/api/tickets?currentStatus=WAITING_FOR_REQUESTER` answered `400`, so the "Waiting for Me" card
would have opened an error. Found by API-44 (link of each card used as a filter). Fixed in
`ticketQuery.ts`.

The status select of My Tickets only had "All Statuses" and "New" since Lab 2. Found while writing
UI-15. It now lists every status plus "Active (not finished)".

The seed found its own tickets by the summary only. End-to-end tests had created tickets with the
same summary ("Cannot connect to VPN from home") for another Requester, so the seed skipped its
Waiting for Requester ticket and the dashboard showed 0 for that status. Found on the first
screenshot of the dashboard. The natural key is now summary plus requester.

A Lab 3 test (count of users before and after a refused create) failed once in the very first run
of this sprint, before any Lab 4 code. Vitest ran the files in parallel on the same database, so
another file was creating users at the same moment. The new dashboard test that compares counts
with SQL (API-50) would have had the same problem. Test files now run one after another.

The Lab 2 component test of the Requester Ticket Detail still sends a ticket without
`actionsTaken`, and the screen crashed on `undefined.length`. The screens now accept a ticket
without the field, so the Lab 2 test is unchanged.

The My Tickets Retry button did nothing: it called `setPage(p => p)`, which does not change the
state, so React never sent the request again. Found while reviewing the safe failure states.

Two visual defects from the screenshot review: the Internal Notes card sat lower than the Public
Comments card next to it (the stacked-card margin was also applied side by side), and links styled
as buttons were underlined.

Some failures were my own test mistakes. The first rollback check compared the copy with the
snapshot taken before the migration, but the seed had added two tickets since, so it compared two
different moments. The keyboard test expected one Tab to leave the date field, but Tab also walks
the day, month and time parts of a `datetime-local` input. The console check counted Chrome's
"Failed to load resource" lines, which are expected here (401 of the session check on the login
page, 400 of the validation we trigger). And the status count links had no separator, so their
accessible name was "New3"; they now say "New: 3".

## 6. Lab 3 tests changed on purpose

Three Lab 3 assertions changed because Lab 4 changed a rule, the same way Lab 3 changed two Lab 2
expectations. API-33 of Lab 3 walks a ticket to Resolved; it now records one completed action
first, because of the resolution gate (BR-18). Two component tests of the Lab 3 Staff Ticket Detail
checked the exact arguments of `setTicketOwner` and `setTicketStatus`; they now also expect the
ticket version (BR-22). Nothing else in the Lab 1 to Lab 3 suites was touched.

## 7. Database state note

The development database keeps the tickets and accounts created by the end-to-end runs of Labs 2
to 4, so the dashboard numbers in the screenshots are large (for example more than 200 New tickets).
The numbers are still correct: API-50 and E2E-04 check them against the database. A clean state is
`npx prisma migrate reset` then `npm run prisma:seed`, which deletes everything else.
