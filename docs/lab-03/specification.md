# Lab 3 Sprint Engineering Specification

TokTickIT - Sprint 3. Author: Yohann Raphael Axel Moscato (69540460011).

This document extends the Lab 2 contract (`docs/lab-02/specification.md`). Rules from Lab 2 stay
in force unless a Lab 3 rule below replaces them. Lab 2 identifiers are written `L2-BR-xx` when
they are referenced; unprefixed `BR-xx` / `FR-xx` / `AC-xx` are Lab 3.

## 1. Sprint Goal

Replace the temporary Development Requester selector with real authentication and server-side
role-based authorization, and deliver the first operational IT Staff workflow plus a minimalist
Administrator user management screen. After this sprint the application has three roles
(Requester, IT Staff, Administrator), every Requester function from Lab 2 keeps working from the
authenticated account instead of a header, and IT Staff can actually work a shared queue of
tickets: claim it, prioritise it, talk to the Requester, record private notes, and move it
through a defined status workflow.

## 2. Stakeholder Request Interpretation

The stakeholder wants the development shortcut gone. Identity must come from a real login, not
from a value the client chooses, so the first job is to migrate the `RequesterUser` records into
a real `User` model with a password and a role, without losing a single existing Ticket or
Attachment. The second job is that hiding a button is not a security control: every protected
operation has to be refused by the backend even when the request is sent directly with curl, and
refusals must not leak whether the resource exists.

The third job is that IT Staff finally get to do work. Until now a Ticket could only be created
and read. Now it has an owner, an IT-side priority that is separate from what the Requester
asked for, a status workflow, a public conversation with the Requester, and a private note stream
that the Requester can never see. The Requester can say the problem looks fixed, but only IT
Staff decide that a Ticket is Resolved or Closed.

The fourth job is deliberately small: an Administrator screen that manages accounts and nothing
else. No deletion, no bulk import, no departments, no email. Accounts are deactivated, never
removed, and the system must never be left without a working Administrator.

## 3. Scope

### Included

Authentication with email and password; logout; current-user retrieval; mandatory password change
for accounts flagged with an initial password. Migration of the Lab 2 Development Requester
records into the `User` model, preserving Ticket and Attachment ownership. Server-side role-based
authorization for all three roles, applied per endpoint and per record. Role-specific navigation.
Continuation of every Lab 2 Requester screen using the authenticated identity, with the selector
and its session state removed. Public Comments on a Ticket, and a Requester action indicating the
problem appears resolved. IT Staff Ticket Queue with search, filters, sorting and pagination. IT
Staff Ticket Detail with ownership, IT Priority, permitted status transitions, Public Comments and
Internal Notes. Administrator User Management with list, search, optional role filter, create,
edit, activation state, and setting a new initial password.

### Excluded

Everything the labsheet excludes in section 4.2, in particular: password reset by email, email
invitations, multi-factor authentication, social login and single sign-on; self-registration;
Actions Taken by IT Staff (deferred to Lab 4); SLA calculation, escalation and notifications;
dashboards and KPI analytics; multi-tenant organisations and departments; production deployment.
Also excluded: more than one role per user; user deletion; bulk user operations; user import and
export; account history screens; pagination, multi-column sorting and multiple simultaneous
filters on the Administrator user list.

## 4. Functional Requirements

| ID | Requirement |
|---|---|
| FR-01 | A user signs in with an email address and a password and receives an authenticated session. |
| FR-02 | An authenticated user can log out, which invalidates the session immediately. |
| FR-03 | The client can retrieve the currently authenticated user, including name, email and role. |
| FR-04 | A user whose account is flagged as requiring a password change must set a new password before any other screen or protected endpoint becomes usable. |
| FR-05 | Navigation shows only the destinations permitted for the authenticated user's role. |
| FR-06 | Every protected endpoint enforces authentication, role and record ownership on the server, independently of what the client sends or displays. |
| FR-07 | All Lab 2 Requester functions (Create Ticket, My Tickets, Ticket Detail, Attachment upload, download and soft removal) continue to work, scoped to the authenticated Requester. |
| FR-08 | A Requester, IT Staff user or Administrator can post a Public Comment on a Ticket they are permitted to see. |
| FR-09 | A Requester can indicate that the reported problem appears resolved, without changing the Ticket status. |
| FR-10 | IT Staff can list all Tickets in a shared queue with search, filters, sorting and pagination. |
| FR-11 | IT Staff can open the Ticket Detail of any Ticket from the queue. |
| FR-12 | IT Staff can claim an unassigned Ticket, reassign it to another permitted user, or release it. |
| FR-13 | IT Staff can set the IT Priority of a Ticket, independently of the Requested Priority. |
| FR-14 | IT Staff can move a Ticket to any status permitted by the transition matrix in section 5. |
| FR-15 | IT Staff can write Internal Notes on a Ticket, which a Requester can never read. |
| FR-16 | An Administrator can list users with search by name or email and an optional role filter. |
| FR-17 | An Administrator can create a user with a name, email address, one permitted role, an activation state and an initial password. |
| FR-18 | An Administrator can update a user's name, email address, role and activation state. |
| FR-19 | An Administrator can set a new initial password on an account, which the user must change at the next login. |
| FR-20 | The system refuses Administrator actions that would leave it without a usable Administrator account. |

## 5. Business Rules

### Accounts and authentication

| ID | Rule |
|---|---|
| BR-01 | Only an active user with valid credentials may authenticate. An inactive account is refused even when the password is correct. |
| BR-02 | A user flagged `mustChangePassword` cannot reach any application screen or protected endpoint except current-user retrieval, password change and logout, until a valid new password is saved. |
| BR-03 | The authenticated user identity, never an id supplied by the client, determines ownership for Requester operations. The Lab 2 `X-Dev-Requester-Id` header is removed and is ignored if sent. |
| BR-04 | Passwords are never stored or logged in plaintext. Only a salted bcrypt hash is persisted. |
| BR-05 | A failed login answers with one generic message for all causes (unknown email, wrong password, inactive account) so the response never reveals whether an account exists. |
| BR-06 | A new password must be at least 8 characters and contain an upper case letter, a lower case letter, a digit and a special character. The new password must differ from the current one. |
| BR-07 | Changing the password clears the `mustChangePassword` flag and invalidates all other sessions of that user. |
| BR-08 | Logout deletes the session record, so a copied session cookie stops working immediately. |
| BR-09 | A session expires 8 hours after it is created. An expired or unknown session is treated as unauthenticated. |
| BR-10 | Email addresses are unique and are compared case-insensitively, stored lower-cased. |

### Roles and authorization

| ID | Rule |
|---|---|
| BR-11 | A user has exactly one role: `REQUESTER`, `IT_STAFF` or `ADMINISTRATOR`. |
| BR-12 | An unauthenticated call to a protected endpoint answers `401`. An authenticated call that the role does not permit answers `403`. |
| BR-13 | A Requester reaching a Ticket, Attachment, Comment or Note that belongs to another Requester answers `404`, never `403`, so the response does not confirm that the record exists (carried over from L2-BR-13). |
| BR-14 | An Internal Note endpoint requested by a Requester answers `403` and returns no note content, not even a count. |
| BR-15 | Administrator user management endpoints are refused for every role other than `ADMINISTRATOR`. |
| BR-16 | IT Staff and Administrator share the same Ticket operation rights. This is stated explicitly here because the labsheet permits it only when the authorization matrix says so: labsheet BR-04 already gives an Administrator visibility of Internal Notes, and an Administrator may be a Ticket Owner, so an Administrator who owns a Ticket must be able to act on it. Administrators keep their separate user-management rights; IT Staff never gain them. |

Authorization matrix, where "own" means the authenticated Requester is the Ticket's requester:

| Operation | Requester | IT Staff | Administrator |
|---|---|---|---|
| Create Ticket | Yes | No | No |
| List own Tickets | Yes | n/a | n/a |
| Read Ticket | Own only | Any | Any |
| Upload / download / remove Attachment | Own only | Any | Any |
| Post Public Comment | Own only | Any | Any |
| Read Public Comments | Own only | Any | Any |
| Indicate problem appears resolved | Own only | No | No |
| Read IT Staff queue | No | Yes | Yes |
| Claim / assign / release ownership | No | Yes | Yes |
| Set IT Priority | No | Yes | Yes |
| Change status | No | Yes | Yes |
| Read / write Internal Notes | No | Yes | Yes |
| Manage users | No | No | Yes |

### Ticket ownership, priority and status

| ID | Rule |
|---|---|
| BR-17 | A Ticket has zero or one Ticket Owner. The owner must be an active user whose role is `IT_STAFF` or `ADMINISTRATOR`; assigning an inactive user or a Requester is refused with `422`. |
| BR-18 | Claiming assigns the Ticket to the caller. Reassigning sets another permitted user. Releasing sets the owner to none. All three are the same operation with a different target. |
| BR-19 | Requested Priority is set by the Requester at creation and is never editable afterwards by anybody. |
| BR-20 | IT Priority is copied from Requested Priority when the Ticket is created, and afterwards can only be changed by IT Staff or an Administrator. |
| BR-21 | The Ticket statuses are `NEW`, `OPEN`, `IN_PROGRESS`, `WAITING_FOR_REQUESTER`, `RESOLVED`, `CLOSED`, `REOPENED` and `CANCELLED`. The unused Lab 2 placeholder `PENDING` stays in the database enum for migration safety but is never assignable in Lab 3. |
| BR-22 | Status transitions follow the matrix below. A transition that is not listed answers `409` and changes nothing. |
| BR-23 | A Ticket cannot be moved to `RESOLVED` while it has no Ticket Owner, because somebody has to be accountable for the resolution. |
| BR-24 | A Requester can never change a Ticket status, including to `RESOLVED` or `CLOSED`. |
| BR-25 | `CLOSED` and `CANCELLED` are terminal. A Ticket leaves `RESOLVED` only by being closed or reopened. |

Status transition matrix (IT Staff and Administrator only):

| From | Permitted next status |
|---|---|
| NEW | OPEN, IN_PROGRESS, CANCELLED |
| OPEN | IN_PROGRESS, WAITING_FOR_REQUESTER, RESOLVED, CANCELLED |
| IN_PROGRESS | WAITING_FOR_REQUESTER, RESOLVED, CANCELLED |
| WAITING_FOR_REQUESTER | IN_PROGRESS, RESOLVED, CANCELLED |
| RESOLVED | CLOSED, REOPENED |
| REOPENED | IN_PROGRESS, WAITING_FOR_REQUESTER, RESOLVED, CANCELLED |
| CLOSED | none |
| CANCELLED | none |

### Public Comments, Internal Notes and Requester resolution

| ID | Rule |
|---|---|
| BR-26 | Public Comments are visible to the Ticket's Requester, to IT Staff and to Administrators. Internal Notes are visible only to IT Staff and Administrators. |
| BR-27 | Public Comments and Internal Notes are append-only in Lab 3. There is no edit and no delete. |
| BR-28 | Author and creation time are recorded by the backend from the session, never from the request body. |
| BR-29 | Comment and note text is rejected when it is empty or only whitespace, and when it is longer than 2000 characters. Text is rendered as text, never as HTML. |
| BR-30 | Posting a Public Comment or Internal Note updates the Ticket's `updatedAt` so the queue's last-updated column stays meaningful. |
| BR-31 | A Requester indicating that the problem appears resolved records a timestamp on the Ticket and posts nothing automatically. It does not change the status (BR-24). It is refused with `409` once the Ticket is already `RESOLVED`, `CLOSED` or `CANCELLED`. |

### Administrator user management

| ID | Rule |
|---|---|
| BR-32 | Creating a user requires a name, a valid email address, one permitted role and an initial password meeting BR-06. The account is created with `mustChangePassword` set. |
| BR-33 | A duplicate email address is refused with `409`, on create and on edit. |
| BR-34 | An Administrator cannot deactivate their own account, and cannot change their own role. |
| BR-35 | The system refuses any change that would leave zero active Administrators, whether by deactivation or by role change. |
| BR-36 | Users are deactivated, never deleted. A deactivated user keeps their Tickets, comments and notes. |
| BR-37 | Setting a new initial password replaces the hash, sets `mustChangePassword`, and invalidates that user's existing sessions. |
| BR-38 | The user list never returns password hashes. No endpoint in the system ever returns a password hash. |

### Migration and regression

| ID | Rule |
|---|---|
| BR-39 | Every existing `RequesterUser` becomes a `User` with role `REQUESTER`, keeping the same primary key so all existing Ticket and Attachment foreign keys stay valid. |
| BR-40 | Migrated accounts receive an initial password hash and `mustChangePassword` set, because no real password existed before. The documented development password is applied by the seed, not by the migration. |
| BR-41 | Existing Tickets keep their Requester, their Attachments, their ticket number and their created date after migration. Their IT Priority is backfilled from their Requested Priority, and they stay unassigned. |
| BR-42 | The Development Requester selector, its route, its `sessionStorage` key and the `GET /api/requesters` endpoint are removed. |

## 6. UI Specification Summary

Full screen-by-screen detail is in `docs/lab-03/ui-spec.md`. Summary: the Zen Green design system
from Lab 2 is reused unchanged - same tokens, cards, badges, buttons, validation placement and
responsive breakpoints. Lab 3 adds a Login screen and a mandatory Change Password screen, both
outside the application shell, and three screens inside it: IT Staff Ticket Queue, IT Staff Ticket
Detail, and Administrator User Management.

The shell replaces the Lab 2 Change Requester control with the authenticated user's name, a role
badge, and a Logout action. Navigation is role-specific: a Requester sees My Tickets and Create
Ticket, IT Staff see Ticket Queue, an Administrator sees Ticket Queue and Users. A destination the
role cannot use is not rendered at all, and is refused by the backend anyway (BR-12). Public
Comments and Internal Notes appear as two visually distinct panels on Ticket Detail, with Internal
Notes carrying a permanent "not visible to the Requester" marker so private information is not
posted publicly by accident. Every screen keeps the Lab 2 state set: loading, saving, success,
validation, empty, no-results, forbidden and safe failure.

## 7. Data Changes

New enum `Role` with `REQUESTER`, `IT_STAFF`, `ADMINISTRATOR`. Enum `TicketStatus` gains
`WAITING_FOR_REQUESTER` and `REOPENED`.

`RequesterUser` is renamed to `User` in place rather than replaced, so that every existing foreign
key keeps pointing at the same row (BR-39). It gains `passwordHash`, `role`, `mustChangePassword`
and `updatedAt`. It keeps `id`, `name`, `email`, `isActive` and `createdAt`.

New model `Session`: an opaque random token as primary key, the user, a creation time and an
expiry. Sessions are rows so that logout and password change can invalidate them server-side
(BR-07, BR-08), which a self-contained JWT could not do.

`Ticket` gains `ownerId` (nullable, to `User`), `itPriority` (same enum as Requested Priority) and
`requesterResolvedAt` (nullable timestamp for BR-31). Indexes are added on `ownerId` and
`currentStatus` because the queue filters and sorts on them.

New models `PublicComment` and `InternalNote`, each with the Ticket, the author `User`, the body
text and a creation time, each indexed by Ticket. They are kept as two models rather than one
model with a visibility flag, because a single wrong boolean would expose private text to a
Requester, while two tables make the read path for a Requester structurally unable to reach
Internal Notes.

Seed data, idempotent as in Lab 2: the six existing active Requesters and one inactive Requester
are kept, three active IT Staff and one inactive IT Staff are added, plus two Administrators (one
active, so User Management can be exercised, and a second active one so that deactivating the
first is a legitimate operation to test against BR-35). One extra Requester account is seeded with
`mustChangePassword` set, so the first-login flow always has data. Seeded tickets are spread
across requesters, statuses, priorities and assigned/unassigned ownership, with a few example
Public Comments and Internal Notes. All seeded credentials are local development values, listed in
`README.md`, and are not real passwords.

## 8. API Contract

Full request and response shapes are in `docs/lab-03/api-spec.md`. Summary of the mechanism:

Authentication uses an opaque session token in an `httpOnly`, `sameSite=lax` cookie named
`toktickit.sid`. The token is 256 bits from `crypto.randomBytes`, stored as a `Session` row. It is
not readable by client JavaScript, which is why it is preferred over holding a token in
`sessionStorage`. Because the client and the API are both on `localhost` they are same-site, so a
`sameSite=lax` cookie is sent on the API calls while still being refused on genuine cross-site
requests; that is the CSRF control for this lab, and it is the reason no separate CSRF token is
introduced. Passwords are hashed with bcrypt at cost 10.

Endpoint groups: `/api/auth` (login, logout, current user, change password); the existing
`/api/tickets` group, now session-authenticated and extended with comments and the problem-appears-
resolved action; `/api/staff/tickets` for the queue and the IT Staff operations; and
`/api/admin/users` for user management.

Status codes: `400` invalid input, `401` unauthenticated, `403` authenticated but forbidden by
role, `404` not found or hidden by ownership, `409` conflict (duplicate email, illegal status
transition, last-administrator rule), `422` unprocessable reference (unknown category, owner who
is not permitted staff), `500` unexpected. Error bodies are `{ "error": string, "details"?:
{ field: message } }` as in Lab 2.

## 9. Acceptance Criteria

| ID | Criterion |
|---|---|
| AC-01 | Given an active user with valid credentials, when the user logs in, then the backend establishes an authenticated session and returns the user identity and role without any password field. |
| AC-02 | Given a user who must change the initial password, when login succeeds, then normal application screens stay unavailable until a valid new password is saved. |
| AC-03 | Given an authenticated Requester, when the client supplies another requester's id in the body or in the old header, then the backend still applies the authenticated identity and does not return another Requester's data. |
| AC-04 | Given a Requester account, when an Internal Note endpoint is requested, then the operation is rejected with `403` and no note content is returned. |
| AC-05 | Given a wrong password, an unknown email, or an inactive account, when login is attempted, then all three answer `401` with the same generic message. |
| AC-06 | Given an authenticated session, when the user logs out and the same cookie is replayed, then the replayed request answers `401`. |
| AC-07 | Given a new password that fails the complexity rule, when the change is submitted, then it is rejected with `400` and the old password still works. |
| AC-08 | Given an authenticated Requester, when My Tickets, Create Ticket, Ticket Detail and the Attachment actions are used, then they behave as in Lab 2 with no Development Requester selector present anywhere. |
| AC-09 | Given a Requester viewing their own Ticket, when they post a Public Comment, then it appears with their name and the server's timestamp, and the Ticket's last-updated time moves. |
| AC-10 | Given a Requester viewing their own Ticket that is not resolved, when they indicate the problem appears resolved, then a timestamp is recorded and the Ticket status is unchanged. |
| AC-11 | Given an IT Staff user, when the Ticket Queue is opened, then Tickets from all Requesters are listed with search, filters, sorting and pagination available. |
| AC-12 | Given an unassigned Ticket, when an IT Staff user claims it, then the Ticket Owner becomes that user and the change is visible to other staff. |
| AC-13 | Given a Ticket, when IT Staff set the IT Priority, then the IT Priority changes and the Requested Priority stays exactly as the Requester submitted it. |
| AC-14 | Given a Ticket in `NEW`, when IT Staff move it to `RESOLVED` directly, then the request is refused with `409` and the status is unchanged. |
| AC-15 | Given a Ticket with no owner, when IT Staff try to resolve it, then the request is refused with `409`. |
| AC-16 | Given an IT Staff user, when an Internal Note is posted, then it is stored with the author and is absent from every response a Requester can obtain for that Ticket. |
| AC-17 | Given a Requester account, when the IT Staff queue endpoint is called directly, then it answers `403`. |
| AC-18 | Given an Administrator, when the user list is opened, then all users are listed with name, email, role and status, and search and the role filter narrow the list. |
| AC-19 | Given an Administrator, when a user is created with an email that already exists, then it is refused with `409` and no account is created. |
| AC-20 | Given an Administrator, when they set a new initial password on an account, then that user's next login forces the password change screen. |
| AC-21 | Given the only active Administrator, when an attempt is made to deactivate that account or change its role, then it is refused with `409`. |
| AC-22 | Given an Administrator, when they try to deactivate their own account, then it is refused. |
| AC-23 | Given a non-Administrator, when any user management endpoint is called directly, then it answers `403` and no user data is returned. |
| AC-24 | Given the Lab 2 database, when the Lab 3 migration runs, then every existing Ticket keeps its Requester, ticket number, attachments and created date, and every migrated Requester can log in after the seed sets the documented development password. |
| AC-25 | Given any authenticated role, when the application shell is rendered, then only the destinations permitted for that role are present in the navigation. |
| AC-26 | Given the Login, Ticket Queue, Ticket Detail and User Management screens at 1440, 768 and 390 pixels wide, then no horizontal overflow occurs and no control is clipped or overlapped. |

## 10. Definition of Done

The sprint is done when: every FR above is implemented and reachable in the running application;
every BR is enforced by the backend, not only by the interface; every AC has at least one
automated test in `docs/lab-03/tests.md` and that test passes on `main`; the full test suite
(Lab 1, Lab 2 and Lab 3, unit, API, component and end-to-end) passes with nothing skipped or
disabled, proving the Lab 2 increment did not regress; the Lab 3 migration has run against the
existing database with the existing Tickets still present and still owned by the same people; the
Development Requester selector is gone from the code, the routes and the interface; desktop,
tablet and mobile screenshots of every new screen are committed under `artifacts/lab-03/`; the
six documents in `docs/lab-03/` are complete and consistent with the code; and all work has
reached `main` through feature branches and reviewed Pull Requests into `lab3-staging`.

## 11. Assumptions and Decisions

The labsheet leaves the session mechanism open. Server-side session rows behind an `httpOnly`
cookie were chosen over JWT because FR-02 and BR-07 require immediate invalidation, which a
stateless token cannot do without adding a denylist that would end up being the same table.

The labsheet allows an Administrator to hold IT Staff ticket rights only if the authorization
matrix states it. BR-16 states it, for the reason given there. The alternative, an Administrator
who can be a Ticket Owner but cannot change their own Ticket, was rejected as incoherent.

Ownership failures answer `404` and role failures answer `403`. This looks inconsistent at first
glance but it is deliberate: `403` on a Ticket id would tell a curious Requester that the id
exists and belongs to somebody else, whereas the role check leaks nothing because the existence of
the endpoint itself is public knowledge.

`PENDING` is kept in the `TicketStatus` enum although Lab 3 does not use it. Removing a value from
a PostgreSQL enum requires recreating the type and rewriting the column, which is a real migration
risk for no benefit; it is simply never assignable.

The last-Administrator rule (BR-35) is enforced by counting active Administrators inside the same
transaction as the update, not by a prior read, so two concurrent deactivations cannot both pass
the check.

Requested Priority is immutable after creation (BR-19). The labsheet says it remains the value
submitted by the Requester, which is read here as immutable rather than merely defaulted.
