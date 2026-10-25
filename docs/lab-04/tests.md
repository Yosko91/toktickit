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
| UNIT-01 | Unit | BR-08 | Action status moves | every permitted move accepted, every other refused, Completed and Cancelled final | `server/tests/lab-04/action-rules.unit.test.ts` | Planned |
| UNIT-02 | Unit | BR-05, BR-06, BR-07, BR-09 | Action field rules | description required and max 2000, note required with follow-up, result required when completed, future date only when planned | `server/tests/lab-04/action-rules.unit.test.ts` | Planned |
| UNIT-03 | Unit | BR-18 | Resolution gate | blocked without owner, without completed action, with an open action; allowed otherwise | `server/tests/lab-04/action-rules.unit.test.ts` | Planned |
| API-01 | API | AC-01 | Create a valid Action Taken | `201`, under the right Ticket, created by and performed by the session user | `server/tests/lab-04/actions-taken.api.test.ts` | Planned |
| API-02 | API | AC-03, BR-02 | Create for a colleague | performed by the colleague, created by the session user, colleague is not the owner | `server/tests/lab-04/actions-taken.api.test.ts` | Planned |
| API-03 | API | AC-04 | Inactive staff as performer | `422`, no row saved | `server/tests/lab-04/actions-taken.api.test.ts` | Planned |
| API-04 | API | AC-04 | Requester as performer | `422`, no row saved | `server/tests/lab-04/actions-taken.api.test.ts` | Planned |
| API-05 | API | AC-05 | Follow-up required without note | `400` with `details.followUpNote` | `server/tests/lab-04/actions-taken.api.test.ts` | Planned |
| API-06 | API | AC-06 | Completed without result, future date, date before the Ticket | `400` each; a Planned action in the future is accepted | `server/tests/lab-04/actions-taken.api.test.ts` | Planned |
| API-07 | API | AC-07, BR-10 | Planned, then In Progress, then Completed, then edit again | each step `200` with version + 1, last edit `409 ACTION_READ_ONLY` | `server/tests/lab-04/actions-taken.api.test.ts` | Planned |
| API-08 | API | AC-08, BR-13 | Edit with an old version | `409 STALE_UPDATE`, stored action unchanged | `server/tests/lab-04/actions-taken.api.test.ts` | Planned |
| API-09 | API | BR-08 | Illegal status move (In Progress back to Planned) and Cancelled at creation | `409 INVALID_TRANSITION` / `400` | `server/tests/lab-04/actions-taken.api.test.ts` | Planned |
| API-10 | API | AC-09, BR-03 | Requester calls create and edit directly | `403`, nothing saved | `server/tests/lab-04/actions-taken.api.test.ts` | Planned |
| API-11 | API | FR-05, BR-03 | Requester reads actions of own Ticket and of another Requester's Ticket | own: `200` with `actionsTaken`, other: `404` | `server/tests/lab-04/actions-taken.api.test.ts` | Planned |
| API-12 | API | AC-12, BR-11 | Create or edit on a Resolved, Closed or Cancelled Ticket | `409 TICKET_NOT_WORKABLE` | `server/tests/lab-04/actions-taken.api.test.ts` | Planned |
| API-13 | API | AC-15, BR-14 | Same create sent twice with one `clientRequestId` | first `201`, second `200` with same id, one row | `server/tests/lab-04/actions-taken.api.test.ts` | Planned |
| API-14 | API | BR-10 | `DELETE` an action | `405`, row still there | `server/tests/lab-04/actions-taken.api.test.ts` | Planned |
| API-15 | API | BR-01 | Edit an action through another Ticket id | `404` | `server/tests/lab-04/actions-taken.api.test.ts` | Planned |
| API-16 | API | BR-15 | Order of the list | actionAt asc, then id asc | `server/tests/lab-04/actions-taken.api.test.ts` | Planned |
| API-17 | API | BR-12 | Creating an action moves Ticket `updatedAt` but not `version` or status | as stated | `server/tests/lab-04/actions-taken.api.test.ts` | Planned |
| API-20 | API | AC-10 | Resolve with no completed action | `409 NO_COMPLETED_ACTION`, status unchanged | `server/tests/lab-04/ticket-workflow.api.test.ts` | Planned |
| API-21 | API | AC-10 | Resolve with an open action | `409 OPEN_ACTIONS`, status unchanged | `server/tests/lab-04/ticket-workflow.api.test.ts` | Planned |
| API-22 | API | AC-11 | Resolve with completed actions only | `200`, `resolvedAt` set, one history row | `server/tests/lab-04/ticket-workflow.api.test.ts` | Planned |
| API-23 | API | BR-21 | Reopen clears `resolvedAt`, Close keeps it | as stated | `server/tests/lab-04/ticket-workflow.api.test.ts` | Planned |
| API-24 | API | AC-13, BR-22 | Old version on status, owner and IT Priority | `409 STALE_UPDATE` each, nothing changed | `server/tests/lab-04/ticket-workflow.api.test.ts` | Planned |
| API-25 | API | BR-22 | Lab 3 call without `version` | still `200` | `server/tests/lab-04/ticket-workflow.api.test.ts` | Planned |
| API-26 | API | AC-14, BR-20 | Several changes, then read history; try to edit or delete history | ordered oldest first, one row per change, no route (`404`) | `server/tests/lab-04/ticket-workflow.api.test.ts` | Planned |
| API-27 | API | BR-23 | Requester calls the status endpoint | `403` | `server/tests/lab-04/ticket-workflow.api.test.ts` | Planned |
| API-28 | API | BR-19 | Requester says resolved, staff then resolve without actions | status unchanged by the Requester, gate still refuses | `server/tests/lab-04/ticket-workflow.api.test.ts` | Planned |
| API-29 | API | BR-22 | Version moves on owner, priority, status, not on a comment | as stated | `server/tests/lab-04/ticket-workflow.api.test.ts` | Planned |
| API-30 | API | FR-12, BR-25 | `statusGroup=active` on My Tickets and on the queue; bad value | only active statuses; `400` | `server/tests/lab-04/ticket-workflow.api.test.ts` | Planned |
| API-40 | API | AC-02, BR-26 | Requester dashboard counts own Tickets only | counts match the Requester's own Tickets, other Requester ignored | `server/tests/lab-04/requester-dashboard.api.test.ts` | Planned |
| API-41 | API | AC-20 | Requester with no Tickets | all counts 0, all lists empty | `server/tests/lab-04/requester-dashboard.api.test.ts` | Planned |
| API-42 | API | BR-27, BR-30, BR-32 | Lists: max 5, order, 30 day window | resolved 40 days ago not listed, max 5 rows | `server/tests/lab-04/requester-dashboard.api.test.ts` | Planned |
| API-43 | API | AC-18 | Staff on the Requester dashboard; no session | `403`; `401` | `server/tests/lab-04/requester-dashboard.api.test.ts` | Planned |
| API-44 | API | AC-19 | Each metric link used as a My Tickets filter | `totalItems` equals the metric | `server/tests/lab-04/requester-dashboard.api.test.ts` | Planned |
| API-50 | API | AC-16, BR-24 | Staff counts against hand written SQL | every metric equals its SQL count | `server/tests/lab-04/staff-dashboard.api.test.ts` | Planned |
| API-51 | API | FR-10, BR-28 | Assigned to Me and My Open Actions for a new staff user | exact numbers, only active Tickets | `server/tests/lab-04/staff-dashboard.api.test.ts` | Planned |
| API-52 | API | AC-17, BR-29 | Administrator vs IT Staff | `userCounts` only for the Administrator and equal to SQL | `server/tests/lab-04/staff-dashboard.api.test.ts` | Planned |
| API-53 | API | AC-18 | Requester on the staff dashboard; no session | `403`; `401` | `server/tests/lab-04/staff-dashboard.api.test.ts` | Planned |
| API-54 | API | AC-19 | Each staff metric link used as a queue filter | `totalItems` equals the metric | `server/tests/lab-04/staff-dashboard.api.test.ts` | Planned |
| API-55 | API | BR-28, BR-32 | Urgent list order and size | High and active only, oldest first, max 5 | `server/tests/lab-04/staff-dashboard.api.test.ts` | Planned |
| PERF-01 | Performance smoke | BR-24 | Both dashboards on the real database | under 500 ms per call (average of 5) | `server/tests/lab-04/staff-dashboard.api.test.ts` | Planned |
| MIG-01 | Migration | AC-21, BR-35 | Legacy Resolved and Closed Tickets | all have `resolvedAt`, every Ticket has `version` >= 1 | `server/tests/lab-04/migration.api.test.ts` | Planned |
| MIG-02 | Migration | AC-21, BR-34 | Legacy Ticket read through both detail endpoints | `actionsTaken: []`, `statusHistory: []`, everything else as before | `server/tests/lab-04/migration.api.test.ts` | Planned |
| MIG-03 | Migration (script) | AC-21, BR-33 | Row counts and checksums before and after `prisma migrate deploy` | identical for User, Ticket, Attachment, PublicComment, InternalNote | `server/scripts/lab-04-migration-check.ts` | Planned |
| MIG-04 | Migration (script) | Spec section 7 | Rollback script on a copy of the database | Lab 4 tables and columns gone, Lab 3 data identical, copy dropped | `server/scripts/lab-04-migration-check.ts` | Planned |
| SEED-01 | Seed (script) | BR-36 | Seed run twice | same counts after the second run, zero / one / several actions present | `server/prisma/seed.ts` | Planned |
| UI-01 | Component | FR-10, AC-19 | Staff dashboard cards | label, value and link with the right filter | `client/tests/lab-04/StaffDashboard.test.tsx` | Planned |
| UI-02 | Component | AC-17 | Administrator vs IT Staff | user counts card only for the Administrator | `client/tests/lab-04/StaffDashboard.test.tsx` | Planned |
| UI-03 | Component | BR-31, FR-15 | Loading, error with Retry, empty lists | spinner, safe failure panel, empty sentences, 0 still shown | `client/tests/lab-04/StaffDashboard.test.tsx` | Planned |
| UI-04 | Component | FR-09, AC-20 | Requester dashboard with data and with nothing | own metrics and lists; all 0 and empty sentences | `client/tests/lab-04/RequesterDashboard.test.tsx` | Planned |
| UI-05 | Component | FR-15 | Requester dashboard API failure | safe failure panel with Retry, Retry calls the API again | `client/tests/lab-04/RequesterDashboard.test.tsx` | Planned |
| UI-06 | Component | FR-04, BR-15 | Actions list | rows in API order, status badge text, follow-up marker, performer | `client/tests/lab-04/ActionsTaken.test.tsx` | Planned |
| UI-07 | Component | AC-05, FR-14 | Create form | performer defaults to me, note error under the field, button disabled while saving, `clientRequestId` sent | `client/tests/lab-04/ActionsTaken.test.tsx` | Planned |
| UI-08 | Component | BR-08, BR-10 | Edit mode | only permitted statuses offered, no Edit on finished rows | `client/tests/lab-04/ActionsTaken.test.tsx` | Planned |
| UI-09 | Component | AC-08, AC-24 | Stale save | warning with Reload, typed values kept | `client/tests/lab-04/ActionsTaken.test.tsx` | Planned |
| UI-10 | Component | AC-09 | Requester view | actions shown, no Add Action, no Edit | `client/tests/lab-04/ActionsTaken.test.tsx` | Planned |
| UI-11 | Component | AC-10 | Gate refusal on the status select | API message shown under the select | `client/tests/lab-04/TicketWorkflow.test.tsx` | Planned |
| UI-12 | Component | AC-13, BR-22 | Status change sends the version; stale answer | `version` in the call; conflict message with Reload | `client/tests/lab-04/TicketWorkflow.test.tsx` | Planned |
| UI-13 | Component | AC-14 | Status history card | rows oldest first with name; legacy message when empty | `client/tests/lab-04/TicketWorkflow.test.tsx` | Planned |
| UI-14 | Component | FR-13 | Navigation per role | Dashboard item for each role, Lab 3 items unchanged | `client/tests/lab-04/TicketWorkflow.test.tsx` | Planned |
| UI-15 | Component | FR-12 | Queue and My Tickets read the URL filter | first request uses the filter from the URL | `client/tests/lab-04/TicketWorkflow.test.tsx` | Planned |
| E2E-01 | E2E | AC-01, AC-03, AC-07, AC-09 | Actions Taken flow | staff record a completed action and a planned one for a colleague, start and complete it; Requester sees both read only | `e2e/lab-04/actions-taken-flow.spec.ts` | Planned |
| E2E-02 | E2E | AC-10, AC-11, AC-14 | Resolution flow | resolve refused while an action is open, accepted after, history shown, Requester sees Resolved | `e2e/lab-04/ticket-resolution.spec.ts` | Planned |
| E2E-03 | E2E | AC-13 | Two staff browsers on one Ticket | the second save gets the conflict message, nothing overwritten | `e2e/lab-04/ticket-resolution.spec.ts` | Planned |
| E2E-04 | E2E | AC-19, AC-16 | Staff dashboard drill-down | Unassigned card number equals the rows in the filtered queue | `e2e/lab-04/dashboards.spec.ts` | Planned |
| E2E-05 | E2E | AC-02, AC-20 | Requester dashboards | Jennifer sees own Tickets only, Priya sees zeros | `e2e/lab-04/dashboards.spec.ts` | Planned |
| VIS-01 | Visual | AC-23 | Staff and Administrator dashboard at 3 widths | screenshots, no horizontal overflow | `e2e/lab-04/responsive-visual.spec.ts` | Planned |
| VIS-02 | Visual | AC-23 | Requester dashboard at 3 widths | screenshots, no horizontal overflow | `e2e/lab-04/responsive-visual.spec.ts` | Planned |
| VIS-03 | Visual | AC-23 | Actions Taken list and form at 3 widths | screenshots, no horizontal overflow | `e2e/lab-04/responsive-visual.spec.ts` | Planned |
| A11Y-01 | Accessibility | AC-23 | Keyboard focus on dashboard links and action form | focus reaches each control with Tab and the outline is visible | `e2e/lab-04/responsive-visual.spec.ts` | Planned |
| REG-01 | Regression | AC-22 | Lab 1, 2 and 3 API and unit suites | all pass, unchanged | `server/tests/lab-01`, `lab-02`, `lab-03` | Planned |
| REG-02 | Regression | AC-22 | Lab 2 and 3 component suites | all pass, unchanged | `client/tests/lab-02`, `lab-03` | Planned |
| REG-03 | Regression | AC-22 | Lab 2 and 3 end-to-end and visual suites | all pass, unchanged | `e2e/lab-02`, `e2e/lab-03` | Planned |

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

To be filled with the real output from `main` at the end of the sprint.
