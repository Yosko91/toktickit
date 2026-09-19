# Lab 3 Test Plan and Results

Written before the implementation branches, alongside `specification.md`. The `Final` column starts
as `Planned` and is only changed to `Pass` once that test has actually been executed and observed
passing, so this table is a record rather than a restatement of the plan.

## 1. Test strategy

Five layers, each answering a different question.

Unit tests cover the pure decision logic that would otherwise only be observable through HTTP: the
password complexity rule and the status transition matrix. These are the two places where a silent
mistake would be dangerous rather than merely visible.

API tests run against the real Express app and the real PostgreSQL database with Supertest, not
against mocks, because the point of Lab 3 is that the backend refuses things. A test that mocked
the database could not prove that a Requester is actually unable to read another Requester's
ticket. Each test creates the rows it needs and logs in through the real login endpoint, so the
session cookie path is exercised on every single authorization assertion.

Component tests use Vitest and Testing Library with the API module mocked, and cover what the
screens do with the answers they receive: validation, busy states, role-dependent rendering, and
the fact that permitted status transitions are the only ones offered.

End-to-end tests use Playwright against the real client, server and database, and cover the
journeys that cross screens: logging in, being forced to change an initial password, a staff
member working a ticket, and an administrator creating an account that then has to change its
password at first login.

Responsive and visual tests capture desktop (1440), tablet (768) and mobile (390) screenshots of
every new screen and assert there is no horizontal overflow.

Authorization is deliberately tested twice: once at the API layer by calling the endpoint directly
with the wrong role, and once in the interface by checking the control is not rendered. The
labsheet is explicit that hiding a button is not authorization, so the API assertion is the one
that matters and the UI assertion only confirms the feedback is consistent.

## 2. Planned tests

| Test ID | Type | Requirement / AC | What it tests | Expected result | Automated test file | Final |
|---|---|---|---|---|---|---|
| UNIT-01 | Unit | BR-06 | Password complexity validator | rejects under 8 chars, and each of missing upper / lower / digit / special; accepts a compliant value | `server/tests/lab-03/password.unit.test.ts` | Pass |
| UNIT-02 | Unit | BR-04 | bcrypt hash and verify | hash differs from the plaintext and from a second hash of the same value; verify accepts the right password and rejects a wrong one | `server/tests/lab-03/password.unit.test.ts` | Pass |
| UNIT-03 | Unit | BR-22 | Status transition matrix | every pair in the BR-22 table is permitted and every pair outside it is refused | `server/tests/lab-03/workflow.unit.test.ts` | Pass |
| UNIT-04 | Unit | BR-25 | Terminal statuses | `CLOSED` and `CANCELLED` permit no onward transition | `server/tests/lab-03/workflow.unit.test.ts` | Pass |
| API-01 | API | AC-01 | `POST /api/auth/login` with valid credentials | `200`, user with role, `Set-Cookie` present, no `passwordHash` field anywhere in the body | `server/tests/lab-03/auth.api.test.ts` | Pass |
| API-02 | API | AC-05 | Login with a wrong password | `401`, message `Invalid email or password` | `server/tests/lab-03/auth.api.test.ts` | Pass |
| API-03 | API | AC-05 | Login with an unknown email | `401`, identical message to API-02 | `server/tests/lab-03/auth.api.test.ts` | Pass |
| API-04 | API | AC-05 / BR-01 | Login to an inactive account with the correct password | `401`, identical message to API-02 | `server/tests/lab-03/auth.api.test.ts` | Pass |
| API-05 | API | AC-01 / FR-03 | `GET /api/auth/me` with a valid session | `200`, same user shape as login | `server/tests/lab-03/auth.api.test.ts` | Pass |
| API-06 | API | BR-12 | `GET /api/auth/me` with no cookie | `401` | `server/tests/lab-03/auth.api.test.ts` | Pass |
| API-07 | API | AC-06 / BR-08 | Logout, then replay the same cookie | logout `204`, replayed request `401` | `server/tests/lab-03/auth.api.test.ts` | Pass |
| API-08 | API | AC-07 / BR-06 | Change password to a value failing complexity | `400` with `details.newPassword`; the old password still logs in | `server/tests/lab-03/auth.api.test.ts` | Pass |
| API-09 | API | AC-07 | Change password with a wrong current password | `400`; nothing changes | `server/tests/lab-03/auth.api.test.ts` | Pass |
| API-10 | API | AC-02 / BR-02 | Flagged user calls a normal protected endpoint | `403` with `code: PASSWORD_CHANGE_REQUIRED` | `server/tests/lab-03/auth.api.test.ts` | Pass |
| API-11 | API | AC-02 | Flagged user changes the password, then retries | change `200`, flag cleared, the protected endpoint now answers `200` | `server/tests/lab-03/auth.api.test.ts` | Pass |
| API-12 | API | BR-07 | Password change invalidates the user's other sessions | the second session's cookie answers `401` afterwards, the current one still works | `server/tests/lab-03/auth.api.test.ts` | Pass |
| API-13 | API | AC-17 | Requester calls `GET /api/staff/tickets` | `403`, no ticket data | `server/tests/lab-03/authorization.api.test.ts` | Pass |
| API-14 | API | AC-23 | Requester calls `GET /api/admin/users` | `403`, no user data | `server/tests/lab-03/authorization.api.test.ts` | Pass |
| API-15 | API | AC-23 / BR-15 | IT Staff calls `GET /api/admin/users` | `403` | `server/tests/lab-03/authorization.api.test.ts` | Pass |
| API-16 | API | AC-03 / BR-03 | Requester sends another requester's id in `X-Dev-Requester-Id` and in the body | `200` but the data is the session user's own; the other requester's ticket ids are absent | `server/tests/lab-03/authorization.api.test.ts` | Pass |
| API-17 | API | BR-12 | Unauthenticated call to `GET /api/tickets` | `401` | `server/tests/lab-03/authorization.api.test.ts` | Pass |
| API-18 | API | AC-04 / BR-14 | Requester calls `GET /api/staff/tickets/:id/notes` on their own ticket | `403`, body contains no note text and no count | `server/tests/lab-03/authorization.api.test.ts` | Pass |
| API-19 | API | AC-11 | Staff `GET /api/staff/tickets` | `200`, contains tickets belonging to more than one requester | `server/tests/lab-03/staff-queue.api.test.ts` | Pass |
| API-20 | API | AC-11 | Queue `?search=<ticket number>` | `200`, exactly that ticket | `server/tests/lab-03/staff-queue.api.test.ts` | Pass |
| API-21 | API | FR-10 | Queue `?ownerId=unassigned` | `200`, every row has `ownerId: null` | `server/tests/lab-03/staff-queue.api.test.ts` | Pass |
| API-22 | API | FR-10 | Queue `?currentStatus=IN_PROGRESS` | `200`, every row has that status | `server/tests/lab-03/staff-queue.api.test.ts` | Pass |
| API-23 | API | FR-10 | Queue `?sortBy=itPriority&sortDir=asc` | `200`, ordering follows LOW, MEDIUM, HIGH | `server/tests/lab-03/staff-queue.api.test.ts` | Pass |
| API-24 | API | FR-10 | Queue `?page=2&pageSize=10` | `200`, correct `pagination` metadata and a disjoint page | `server/tests/lab-03/staff-queue.api.test.ts` | Pass |
| API-25 | API | FR-10 | Queue `?sortBy=notAField` | `400`, names the parameter | `server/tests/lab-03/staff-queue.api.test.ts` | Pass |
| API-26 | API | AC-12 | Claim an unassigned ticket | `200`, `ownerId` is the caller | `server/tests/lab-03/staff-ticket-detail.api.test.ts` | Pass |
| API-27 | API | BR-18 | Release ownership with `ownerId: null` | `200`, `ownerId` null | `server/tests/lab-03/staff-ticket-detail.api.test.ts` | Pass |
| API-28 | API | BR-17 | Assign a Requester as Ticket Owner | `422`, owner unchanged | `server/tests/lab-03/staff-ticket-detail.api.test.ts` | Pass |
| API-29 | API | BR-17 | Assign an inactive IT Staff user as Ticket Owner | `422` | `server/tests/lab-03/staff-ticket-detail.api.test.ts` | Pass |
| API-30 | API | AC-13 / BR-19 | Set IT Priority | `200`, `itPriority` changed, `requestedPriority` identical to what the Requester submitted | `server/tests/lab-03/staff-ticket-detail.api.test.ts` | Pass |
| API-31 | API | AC-14 / BR-22 | `NEW` straight to `RESOLVED` | `409`, status still `NEW` | `server/tests/lab-03/staff-ticket-detail.api.test.ts` | Pass |
| API-32 | API | AC-15 / BR-23 | Resolve a ticket that has no owner | `409`, status unchanged | `server/tests/lab-03/staff-ticket-detail.api.test.ts` | Pass |
| API-33 | API | BR-22 | Legal chain `NEW` to `OPEN` to `IN_PROGRESS` to `RESOLVED` on an owned ticket | each step `200`, final status `RESOLVED` | `server/tests/lab-03/staff-ticket-detail.api.test.ts` | Pass |
| API-34 | API | BR-25 | Any transition out of `CLOSED` | `409` | `server/tests/lab-03/staff-ticket-detail.api.test.ts` | Pass |
| API-35 | API | FR-12 | `GET /api/staff/assignable-users` | `200`, contains active staff and administrators only, no requester | `server/tests/lab-03/staff-ticket-detail.api.test.ts` | Pass |
| API-36 | API | AC-09 / BR-28 | Requester posts a Public Comment on their own ticket | `201`, author is the session user, timestamp from the server | `server/tests/lab-03/comments-notes.api.test.ts` | Pass |
| API-37 | API | BR-13 | Requester posts a comment on another Requester's ticket | `404` | `server/tests/lab-03/comments-notes.api.test.ts` | Pass |
| API-38 | API | BR-29 | Comment body that is whitespace only | `400` | `server/tests/lab-03/comments-notes.api.test.ts` | Pass |
| API-39 | API | BR-29 | Comment body of 2001 characters | `400` | `server/tests/lab-03/comments-notes.api.test.ts` | Pass |
| API-40 | API | BR-28 | Comment body that also supplies an `authorId` | `201`, the stored author is the session user, not the supplied id | `server/tests/lab-03/comments-notes.api.test.ts` | Pass |
| API-41 | API | AC-16 / BR-26 | Staff writes an Internal Note, then the Requester reads their own ticket detail | note stored; the Requester response contains neither the note text nor a note field | `server/tests/lab-03/comments-notes.api.test.ts` | Pass |
| API-42 | API | BR-30 | Posting a comment moves the ticket's `updatedAt` | `updatedAt` after is greater than before | `server/tests/lab-03/comments-notes.api.test.ts` | Pass |
| API-43 | API | AC-10 / BR-31 | Requester marks the problem as appearing resolved | `200`, timestamp set, `currentStatus` unchanged | `server/tests/lab-03/comments-notes.api.test.ts` | Pass |
| API-44 | API | BR-31 | The same call on an already resolved ticket | `409` | `server/tests/lab-03/comments-notes.api.test.ts` | Pass |
| API-45 | API | BR-24 | Requester attempts a status change endpoint directly | `403` | `server/tests/lab-03/comments-notes.api.test.ts` | Pass |
| API-46 | API | AC-18 | Administrator lists users | `200`, every user has name, email, role and status | `server/tests/lab-03/users-admin.api.test.ts` | Pass |
| API-47 | API | AC-18 | User list `?search=` and `?role=` | `200`, both narrow the result correctly | `server/tests/lab-03/users-admin.api.test.ts` | Pass |
| API-48 | API | BR-32 | Create a user | `201`, `mustChangePassword: true`, role as requested | `server/tests/lab-03/users-admin.api.test.ts` | Pass |
| API-49 | API | AC-19 / BR-33 | Create a user with an email that already exists | `409`, no new row | `server/tests/lab-03/users-admin.api.test.ts` | Pass |
| API-50 | API | BR-06 | Create a user with a weak initial password | `400`, no new row | `server/tests/lab-03/users-admin.api.test.ts` | Pass |
| API-51 | API | BR-33 | Edit a user to an email another user already has | `409` | `server/tests/lab-03/users-admin.api.test.ts` | Pass |
| API-52 | API | AC-22 / BR-34 | Administrator deactivates their own account | `403`, still active | `server/tests/lab-03/users-admin.api.test.ts` | Pass |
| API-53 | API | AC-21 / BR-35 | Deactivate the last active Administrator | `409`, still active | `server/tests/lab-03/users-admin.api.test.ts` | Pass |
| API-54 | API | AC-21 / BR-35 | Change the last active Administrator's role to Requester | `409`, role unchanged | `server/tests/lab-03/users-admin.api.test.ts` | Pass |
| API-55 | API | AC-20 / BR-37 | Set a new initial password, then log in as that user | `200`; the user's next `GET /api/auth/me` reports `mustChangePassword: true` and their previous session is `401` | `server/tests/lab-03/users-admin.api.test.ts` | Pass |
| API-56 | API | BR-38 | Scan every administrator response body for a password field | no `passwordHash` or `password` key in any response | `server/tests/lab-03/users-admin.api.test.ts` | Pass |
| API-57 | API | AC-08 | Create a ticket with a session instead of the Lab 2 header | `201`, `itPriority` equals `requestedPriority` | `server/tests/lab-03/lab2-regression.api.test.ts` | Pass |
| API-58 | API | AC-08 | My Tickets list under a session | `200`, only the session user's tickets | `server/tests/lab-03/lab2-regression.api.test.ts` | Pass |
| API-59 | API | AC-03 | Ticket detail of another Requester's ticket | `404` | `server/tests/lab-03/lab2-regression.api.test.ts` | Pass |
| API-60 | API | AC-08 | Attachment upload, download and soft removal under a session | `201`, `200` with matching bytes, `200` then `410` on download | `server/tests/lab-03/lab2-regression.api.test.ts` | Pass |
| API-61 | API | AC-24 / BR-41 | Tickets created before the migration | still present, still owned by the same requester, attachments intact, `itPriority` backfilled from `requestedPriority` | `server/tests/lab-03/lab2-regression.api.test.ts` | Pass |
| UI-01 | UI | AC-01 | Login screen submits the typed credentials | the API module is called once with the entered email and password | `client/tests/lab-03/Login.test.tsx` | Pass |
| UI-02 | UI | AC-05 | Login screen on a `401` | shows `Invalid email or password` and keeps the typed email | `client/tests/lab-03/Login.test.tsx` | Pass |
| UI-03 | UI | FR-01 | Login busy state | the button is disabled while the request is in flight, so a double submit is impossible | `client/tests/lab-03/Login.test.tsx` | Pass |
| UI-04 | UI | BR-06 | Change Password rule checklist | each rule is marked satisfied as it is met, and Continue stays disabled until all pass | `client/tests/lab-03/ChangePassword.test.tsx` | Pass |
| UI-05 | UI | AC-02 | Change Password confirmation mismatch | submit is blocked and the mismatch is shown | `client/tests/lab-03/ChangePassword.test.tsx` | Pass |
| UI-06 | UI | AC-11 | Ticket Queue renders the returned rows | ticket numbers, both priorities and owner names are shown; an unowned ticket reads `Unassigned` | `client/tests/lab-03/StaffTicketQueue.test.tsx` | Pass |
| UI-07 | UI | FR-10 | Ticket Queue no-results state | shows the no-results panel and a Clear filters control, not the empty-queue text | `client/tests/lab-03/StaffTicketQueue.test.tsx` | Pass |
| UI-08 | UI | AC-12 | Claim on Ticket Detail | calls the owner endpoint and shows the new owner without a page reload | `client/tests/lab-03/StaffTicketDetail.test.tsx` | Pass |
| UI-09 | UI | BR-22 | Status select on Ticket Detail | for a `NEW` ticket it offers only Open, In Progress and Cancelled | `client/tests/lab-03/StaffTicketDetail.test.tsx` | Pass |
| UI-10 | UI | BR-26 | The two comment panels | both are rendered, and the Internal Notes panel carries the not-visible-to-the-Requester warning | `client/tests/lab-03/StaffTicketDetail.test.tsx` | Pass |
| UI-11 | UI | AC-18 | User Management list and role filter | rows show name, email, role and status; filtering by role narrows the list | `client/tests/lab-03/UserManagement.test.tsx` | Pass |
| UI-12 | UI | AC-19 | User Management duplicate email | the `409` message is shown under the email field | `client/tests/lab-03/UserManagement.test.tsx` | Pass |
| UI-13 | UI | AC-25 | Role-specific navigation | a Requester sees My Tickets and Create Ticket only; IT Staff see Ticket Queue; an Administrator sees Ticket Queue and Users | `client/tests/lab-03/AppShellRoles.test.tsx` | Pass |
| UI-14 | UI | BR-42 | The Development Requester selector is gone | no Change Requester control is rendered for any role | `client/tests/lab-03/AppShellRoles.test.tsx` | Pass |
| E2E-01 | E2E | AC-01 / AC-06 | Log in, use the app, log out, then reopen a protected URL directly | the application opens after login and the direct URL returns to Login after logout | `e2e/lab-03/authentication.spec.ts` | Pass |
| E2E-02 | E2E | AC-02 | Initial-password login and change | the normal application opens only after a valid new password is saved | `e2e/lab-03/authentication.spec.ts` | Pass |
| E2E-03 | E2E | AC-05 | Invalid login | the generic error is shown and the user stays on Login | `e2e/lab-03/authentication.spec.ts` | Pass |
| E2E-04 | E2E | AC-11 to AC-14 | Staff works a ticket end to end | queue, open detail, claim, set IT Priority, move the status, all reflected after a reload | `e2e/lab-03/staff-ticket-flow.spec.ts` | Pass |
| E2E-05 | E2E | AC-16 | Internal note privacy across roles | staff writes a note, then the Requester opens the same ticket and the note text is nowhere on the page | `e2e/lab-03/staff-ticket-flow.spec.ts` | Pass |
| E2E-06 | E2E | AC-09 / AC-10 | Requester comments and marks the problem as appearing resolved | the comment appears with the author, and the status badge does not change | `e2e/lab-03/staff-ticket-flow.spec.ts` | Pass |
| E2E-07 | E2E | AC-18 to AC-20 | Administrator creates a user who must then change the password | the new account logs in and is forced onto the Change Password screen | `e2e/lab-03/user-administration.spec.ts` | Pass |
| E2E-08 | E2E | AC-21 | Last-administrator protection in the interface | the refusal message is shown and the account stays active | `e2e/lab-03/user-administration.spec.ts` | Pass |
| VIS-01 | Visual | AC-26 | Login and Change Password at 1440 / 768 / 390 | screenshots captured, no horizontal overflow | `e2e/lab-03/responsive-visual.spec.ts` | Pass |
| VIS-02 | Visual | AC-26 | Ticket Queue at 1440 / 768 / 390 | screenshots captured, no horizontal overflow, mobile uses the card layout | `e2e/lab-03/responsive-visual.spec.ts` | Pass |
| VIS-03 | Visual | AC-26 | Staff Ticket Detail at 1440 / 768 / 390 | screenshots captured, no horizontal overflow | `e2e/lab-03/responsive-visual.spec.ts` | Pass |
| VIS-04 | Visual | AC-26 | User Management at 1440 / 768 / 390 | screenshots captured, no horizontal overflow | `e2e/lab-03/responsive-visual.spec.ts` | Pass |

## 3. Acceptance criterion traceability

Every Acceptance Criterion in `specification.md` section 9 maps to at least one test above.

| AC | Covered by |
|---|---|
| AC-01 | API-01, API-05, UI-01, E2E-01 |
| AC-02 | API-10, API-11, UI-05, E2E-02 |
| AC-03 | API-16, API-59 |
| AC-04 | API-18 |
| AC-05 | API-02, API-03, API-04, UI-02, E2E-03 |
| AC-06 | API-07, E2E-01 |
| AC-07 | API-08, API-09 |
| AC-08 | API-57, API-58, API-60, UI-14 |
| AC-09 | API-36, API-42, E2E-06 |
| AC-10 | API-43, E2E-06 |
| AC-11 | API-19 to API-25, UI-06, E2E-04 |
| AC-12 | API-26, UI-08, E2E-04 |
| AC-13 | API-30, E2E-04 |
| AC-14 | API-31, UI-09, E2E-04 |
| AC-15 | API-32 |
| AC-16 | API-41, UI-10, E2E-05 |
| AC-17 | API-13 |
| AC-18 | API-46, API-47, UI-11, E2E-07 |
| AC-19 | API-49, UI-12 |
| AC-20 | API-55, E2E-07 |
| AC-21 | API-53, API-54, E2E-08 |
| AC-22 | API-52 |
| AC-23 | API-14, API-15 |
| AC-24 | API-61 |
| AC-25 | UI-13 |
| AC-26 | VIS-01 to VIS-04 |

## 4. Results

Run on the merged Lab 3 code with all three suites executed in full.

| Suite | Command | Result |
|---|---|---|
| Server, all labs | `cd server && npm test` | 19 files, 162 tests, all passing |
| Client, all labs | `cd client && npm test` | 10 files, 53 tests, all passing |
| End-to-end and visual | `npx playwright test` | 40 tests, all passing |

255 automated tests in total, none skipped and none disabled. The Lab 1 and
Lab 2 suites are included in those totals rather than run separately, because
they are the regression evidence required by the Definition of Done: the Lab 2
increment still works after identity moved from a request header to a session.

Two Lab 2 expectations were deliberately changed rather than preserved, and both
are contract changes rather than regressions. An unidentified request answered
`400` in Lab 2 because the identity header was missing; it now answers `401`,
because there is no session. A request naming an inactive or unknown requester
answered `403` and `404`; both now answer `401`, since an account that cannot
authenticate is simply not authenticated, and saying "not found" would confirm
which user ids exist. The `GET /api/requesters` test became a check that the
endpoint is gone (BR-42).

The Playwright run takes roughly two minutes against a warm dev server. A first
run immediately after editing CSS or components is noticeably slower because
Vite recompiles, and that alone pushed two tests past the 30-second timeout
once; re-running with the server warm passed all 40.

## 5. Defects found by these tests

Recorded because they are the argument for testing at the layer where the rule
actually lives. Only genuine defects are listed; test mistakes of my own are
marked as such.

**The assignable-users endpoint was unreachable.** API-35 asked for
`GET /api/staff/assignable-users` and got `404`. The router had been mounted at
`/api/staff/tickets`, so the route was really answering at
`/api/staff/tickets/assignable-users` while `api-spec.md` documented it one
level up. The router was remounted at `/api/staff`. Nothing in the interface
would have shown this, because the reassign control simply rendered an empty
list and looked like a ticket nobody could be assigned to.

**The administrator screen overflowed the viewport at tablet width.** VIS-04
measured a document 986 pixels wide inside a 768 pixel viewport. Two separate
causes, both real. A grid track declared `1fr` cannot shrink below its
min-content, so the five-column user table pushed the whole grid past the
screen and the `overflow-x: auto` wrapper never got the chance to scroll; the
tracks are now `minmax(0, 1fr)`. Underneath that, the visually-hidden span used
for the "Actions" column header was absolutely positioned without a positioned
ancestor, so it sat at x=927 and extended the document on its own. The utility
was hardened and that header is now simply visible text.

**The administrator user list disappeared on a phone.** The rule that hides a
table below 768 pixels was written for the ticket lists, which swap to cards at
that width, but it was scoped to every `.zen-table-wrap` on the site. The user
table has no card alternative, so it rendered as nothing at all. The rule now
applies only to the lists that opt in.

**BR-35 is unreachable on its own.** Writing the test for the last-administrator
rule showed that BR-34 already refuses the only sequential path to it, so the
rule can only fire when two administrators act at the same moment. It is tested
as a race instead of with a sequential test that would have passed without
exercising anything. This is recorded in `specification.md` section 11 rather
than quietly left as a rule with a misleading test.

**Two mistakes of my own in the tests, worth keeping.** The migration regression
check used `itPriority: { equals: undefined }` as a Prisma filter, which means
"no filter at all", so it counted all 86 tickets instead of the null ones and
failed loudly; it is raw SQL now, because the generated type will not express
`null` on a non-nullable column. And the staff queue pagination test asserted
that page 1 and page 2 share no rows, which is only true if the result set does
not grow between the two requests - the other suites were inserting tickets
concurrently, so it passed alone and failed in a full run. That suite now works
over its own 12-row fixture behind a unique marker.

**Playwright's text matcher reads textarea values.** The visual test waited for
a posted comment with `getByText`, which matched the text still sitting in the
textarea and so passed before the post had happened. The reload that follows a
successful post then wiped the next panel while it was being typed into, and the
failure surfaced as an unrelated disabled button. The test now waits for the
textarea to clear, which is the signal that the post actually went through.

## 6. Database state note

As in Lab 2, the development database keeps the rows created by the API and end-to-end tests, so
the ticket count grows every run. This is intentional: the tests create their own data and never
assume an empty table. `npx prisma migrate reset` followed by `npm run prisma:seed` returns the
database to the documented seed if a clean state is wanted, at the cost of the ticket numbers
visible in the committed screenshots.
