# Lab 4 Sprint Engineering Specification

TokTickIT - Sprint 4. Author: Yohann Raphael Axel Moscato (69540460011).

This document extends the Lab 3 contract (`docs/lab-03/specification.md`). Lab 3 rules stay in
force unless a rule below replaces them. Lab 3 ids are written `L3-BR-xx` when I reference them.
Unprefixed `FR-xx`, `BR-xx` and `AC-xx` are Lab 4.

## 1. Sprint Goal

IT Staff can now record the real work done on a Ticket as Actions Taken, and a Ticket can only be
resolved when that work is finished. Every role gets a short dashboard that links to the detailed
screens. All the Lab 1 to Lab 3 features keep working, and the whole application is checked again
for regression, responsive layout and accessibility before the final demonstration.

## 2. Stakeholder Request Interpretation

Until Lab 3, IT Staff could talk with the Requester and write private notes, but there was no
place to write what was actually done on the problem. The stakeholder wants a list of Actions
Taken under each Ticket. One action is one piece of work: when it was done, what was done, the
result, who did it, and if a follow-up is still needed. The person who did the action is not
always the Ticket Owner. The owner coordinates, but a colleague can do one part of the work.

The Requester can still say "it looks fixed", but this is only an opinion. IT Staff check the work
and change the status themselves, and the backend refuses to resolve a Ticket when the work is
not done, even if somebody calls the API directly.

The dashboards must stay small. They show a few numbers and short lists, and every number opens
the real list behind it. They do not replace My Tickets or the Ticket Queue. Finally, the
application must look like one product in Zen Green, and nothing from the earlier labs may break.

## 3. Scope

### Included

Actions Taken on a Ticket: create, view, edit, assign to another IT Staff member, start, complete
and cancel. Requesters can read the Actions Taken of their own Tickets. The final status
transition matrix with a backend resolution gate. An append-only status history. Detection of
stale updates on the Ticket workflow and on Actions Taken. Requester dashboard, IT Staff dashboard
and Administrator dashboard (the IT Staff one plus user counts), with drill-down links to filtered
lists. Prisma migration with backfill and a documented rollback, updated idempotent seed. Final
hardening: regression of Labs 1 to 3, consistent feedback states, duplicate-click protection,
README update, screenshots at desktop, tablet and mobile.

### Excluded

Everything in section 4.2 of the handout: SLA clocks, escalation and on-call, any email / SMS /
LINE / push notification, spare parts and inventory, time sheets and labour cost, approval
workflows and signatures, BI tools and report builders, multi-tenant organisations and cloud
production. Also excluded by my choice: deleting an Action Taken (it is cancelled instead), file
upload on an Action Taken (the Attachment Notes field only says which existing file to look at),
charts on the dashboards, and changing the landing page of each role.

## 4. Functional Requirements

| ID | Requirement |
|---|---|
| FR-01 | IT Staff and Administrators can create an Action Taken on a Ticket with Action Date/Time, Action Description, Result, Performed by, Action Status, Follow-Up Required, Follow-up Note and Attachment Notes. |
| FR-02 | Performed by is filled automatically with the signed-in user. It can be changed to another active IT Staff or Administrator user. |
| FR-03 | IT Staff and Administrators can edit an Action Taken that is not finished, including its assignee and its status (start, complete, cancel). |
| FR-04 | The IT Staff Ticket Detail shows an Actions Taken area with a list, a create mode and a view/edit mode. |
| FR-05 | A Requester sees all Actions Taken of their own Tickets on the Requester Ticket Detail, read only. |
| FR-06 | Ticket status changes follow the final transition matrix and the resolution gate (BR-17, BR-18). |
| FR-07 | Every Ticket status change is kept in a status history shown on both Ticket Detail screens. |
| FR-08 | A stale update of the Ticket workflow or of an Action Taken is refused with a clear message, so one user does not overwrite the change of another user without knowing it. |
| FR-09 | A Requester has a dashboard with their own active, waiting, resolved and closed counts, Tickets that need their attention, recently updated and recently resolved Tickets. |
| FR-10 | IT Staff have a dashboard with unassigned Tickets, Tickets owned by them, their open Actions Taken, Tickets by status and by IT Priority, urgent Tickets and recently updated Tickets. |
| FR-11 | An Administrator sees the IT Staff dashboard plus short user account counts. |
| FR-12 | Every dashboard count opens the matching filtered list. My Tickets and the Ticket Queue read their filters from the URL, including an "Active" status group. |
| FR-13 | Every role has a Dashboard item in the navigation, with the active page clearly marked. |
| FR-14 | Repeated clicks or a network retry on Save Action do not create two Actions Taken. |
| FR-15 | All Lab 1 to Lab 3 screens and APIs keep working for the permitted roles, with consistent loading, empty, validation, forbidden, conflict, not found and safe failure feedback. |

## 5. Business Rules

### Actions Taken

| ID | Rule |
|---|---|
| BR-01 | An Action Taken belongs to exactly one Ticket. The Ticket is set at creation and can never change. |
| BR-02 | The Ticket Owner coordinates the Ticket, but an Action Taken may be performed by a different IT Staff member. The performer does not need to be the owner. |
| BR-03 | Only IT Staff and Administrators create or update Actions Taken. A Requester gets `403` on those endpoints. A Requester can read Actions Taken only through their own Tickets (`404` for other Tickets, L3-BR-13). |
| BR-04 | Performed by is the signed-in user when the request does not name one. A named performer must be an active `IT_STAFF` or `ADMINISTRATOR` user, otherwise `422`. Created by is always the session user and never changes. |
| BR-05 | Action Description is required, 1 to 2000 characters after trimming. Result is at most 2000 characters, Follow-up Note at most 1000, Attachment Notes at most 500. All text is shown as text, never as HTML. |
| BR-06 | Follow-up Note is required when Follow-Up Required is yes. When it is no, the note is stored empty (null). |
| BR-07 | Action Date/Time is required. It cannot be before the Ticket was created. It cannot be in the future (5 minutes tolerance) unless the action is Planned. |
| BR-08 | Action Status is `PLANNED`, `IN_PROGRESS`, `COMPLETED` or `CANCELLED`. A new action is `COMPLETED` by default, because most actions are written after the work. Permitted changes: Planned to In Progress, Completed or Cancelled; In Progress to Completed or Cancelled. Anything else answers `409`. |
| BR-09 | A Completed action must have a Result. |
| BR-10 | Completed and Cancelled actions are read only. Actions Taken are never deleted (`DELETE` answers `405`). A wrong action is cancelled, so the record of work stays complete. |
| BR-11 | Actions Taken can be created or edited only while the Ticket is in a working status: New, Open, In Progress, Waiting for Requester or Reopened. On a Resolved, Closed or Cancelled Ticket the API answers `409`. To add work to a resolved Ticket, IT Staff reopen it first. |
| BR-12 | Creating or editing an Action Taken moves the Ticket `updatedAt` (same idea as L3-BR-30). It does not change the Ticket status or the Ticket version. |
| BR-13 | Editing an Action Taken needs the `version` the client last read. If the stored version is different, the API answers `409` with code `STALE_UPDATE` and saves nothing. |
| BR-14 | A create request carries a `clientRequestId`. A second request with the same id returns the action already saved (`200`) and does not create a duplicate. |
| BR-15 | Actions Taken are listed in a stable order: Action Date/Time ascending, then id ascending. |

### Ticket workflow and resolution

| ID | Rule |
|---|---|
| BR-16 | The statuses stay New, Open, In Progress, Waiting for Requester, Resolved, Closed, Reopened and Cancelled. `PENDING` stays in the database enum only and is never assignable (L3-BR-21). |
| BR-17 | The transition matrix below is final. Only IT Staff and Administrators change a status. Anything not in the matrix answers `409` and changes nothing. |
| BR-18 | Resolution gate. A Ticket can move to Resolved only when it has a Ticket Owner (L3-BR-23), at least one Completed Action Taken, and no Planned or In Progress Action Taken. Otherwise the API answers `409` with the reason. The check is in the backend, so it also applies when the screen is bypassed. |
| BR-19 | The Requester "problem appears resolved" action stays advisory (L3-BR-31). It records a time only. It does not change the status and does not count for the gate. |
| BR-20 | Every status change appends one status history row: from status, to status, changed by, changed at. History rows are never edited or deleted. They are shown oldest first (changed at, then id). |
| BR-21 | `resolvedAt` is set when the Ticket moves to Resolved and cleared when it moves to Reopened. Closed keeps it. |
| BR-22 | Owner, IT Priority and status changes increase the Ticket `version` by one. When the request carries a `version` that is not the stored one, the API answers `409` with code `STALE_UPDATE`. The Lab 4 client always sends it. A request without `version` is still accepted, so the Lab 3 API and its tests keep working. Comments, notes and attachments do not change the version, because they add something and never overwrite. |
| BR-23 | A Requester can never change a status (L3-BR-24). |

Final status transition matrix (IT Staff and Administrator only):

| From | Permitted next status | Extra condition |
|---|---|---|
| New | Open, In Progress, Cancelled | |
| Open | In Progress, Waiting for Requester, Resolved, Cancelled | Resolved needs the gate (BR-18) |
| In Progress | Waiting for Requester, Resolved, Cancelled | Resolved needs the gate |
| Waiting for Requester | In Progress, Resolved, Cancelled | Resolved needs the gate |
| Resolved | Closed, Reopened | Reopened clears `resolvedAt` |
| Reopened | In Progress, Waiting for Requester, Resolved, Cancelled | Resolved needs the gate |
| Closed | none (final) | |
| Cancelled | none (final) | |

I reviewed the Lab 3 matrix again for this sprint and kept it. The only new thing is the gate on
Resolved. I did not add Reopened from Closed: a closed Ticket is finished, and new work needs a new
Ticket (L3-BR-25).

### Dashboards

| ID | Rule |
|---|---|
| BR-24 | Dashboard numbers are calculated by the backend on every request, from the database. There is no cache and no counting in the browser. |
| BR-25 | An "active" Ticket is a Ticket in New, Open, In Progress, Waiting for Requester or Reopened. The same group is used by the drill-down filter `statusGroup=active`. |
| BR-26 | The Requester dashboard only counts and lists Tickets whose requester is the session user. |
| BR-27 | Requester metrics: My Active Tickets (own, active group), Waiting for Me (own, Waiting for Requester), Resolved (own, Resolved), Closed (own, Closed). Lists: Needs My Attention (own Waiting for Requester, oldest update first, max 5), Recently Updated (own, `updatedAt` desc, max 5), Recently Resolved (own, `resolvedAt` in the last 30 days, newest first, max 5). |
| BR-28 | IT Staff metrics: Unassigned (active, no owner), Assigned to Me (active, owner is me), My Open Actions (Actions Taken Planned or In Progress, performed by me, on an active Ticket), one count per active status and Resolved, one count per IT Priority over active Tickets. Lists: My Open Actions (oldest action first, max 5), Urgent (active and IT Priority High, oldest Ticket first, max 5), Recently Updated (`updatedAt` desc, max 5). |
| BR-29 | The Administrator dashboard is the IT Staff dashboard plus user counts: active Requesters, active IT Staff, active Administrators and inactive accounts. IT Staff never receive the user counts. |
| BR-30 | Times are stored in UTC. "Last 30 days" is a rolling window of 30 x 24 hours ending at the request time on the server. The browser shows times in its local time zone (Asia/Bangkok on the lab machines). |
| BR-31 | A count of zero is still shown, as 0, and its link still opens the (empty) filtered list. An empty list shows a short message. A card is never hidden. |
| BR-32 | Dashboard endpoints return counts and at most 5 items per list, never whole Ticket collections. |

### Migration and seed

| ID | Rule |
|---|---|
| BR-33 | The Lab 4 migrations only add tables, columns and indexes. No existing row is deleted. The only rows written are the backfill in BR-35. |
| BR-34 | Legacy Tickets have zero Actions Taken and show "No actions recorded yet". The gate applies to new status changes only, so a legacy Resolved or Closed Ticket stays as it is. |
| BR-35 | Backfill: `version` is 1 for every existing Ticket. `resolvedAt` is set to `updatedAt` for existing Resolved and Closed Tickets, because it is the best time we know. Legacy Tickets have no status history; the history starts with their first Lab 4 change. |
| BR-36 | The seed stays idempotent. It adds Actions Taken (natural key: Ticket summary plus description), one Reopened and one Cancelled Ticket, and Tickets with zero, one and several actions. |

### Authorization matrix for the Lab 4 operations

| Operation | Requester | IT Staff | Administrator |
|---|---|---|---|
| Read Actions Taken | Own Tickets only | Any Ticket | Any Ticket |
| Create / edit / assign / complete / cancel Action Taken | No (`403`) | Yes | Yes |
| Delete Action Taken | No | No (`405`) | No (`405`) |
| Change Ticket status | No (`403`) | Yes | Yes |
| Read status history | Own Tickets only | Any Ticket | Any Ticket |
| Requester dashboard | Yes | No (`403`) | No (`403`) |
| IT Staff dashboard | No (`403`) | Yes | Yes, plus user counts |

## 6. UI Specification Summary

Details are in `docs/lab-04/ui-spec.md`. The Zen Green system from Labs 2 and 3 is reused: same
tokens, cards, badges, buttons, fields, state panels and breakpoints. New parts: a metric card
(label, big number, "View" link), a dashboard page per role, an Actions Taken card on both Ticket
Detail screens, an action form with create and edit modes, and a status history list.

Navigation gets a Dashboard item for every role. The landing page after login does not change
(My Tickets for a Requester, Ticket Queue for staff), so the journeys of Labs 2 and 3 stay the
same. On the IT Staff Ticket Detail the status select still offers only the permitted moves, and a
refused move (gate or stale version) shows its message under the select. On the Requester side the
Actions Taken card is read only and has no buttons at all. Every screen keeps the state set:
loading, saving, success, validation, empty, no results, forbidden, conflict and safe failure.

## 7. Data Changes

New enum `ActionStatus` with `PLANNED`, `IN_PROGRESS`, `COMPLETED`, `CANCELLED`.

New model `ActionTaken`: `id`, `ticketId` (required, to `Ticket`), `actionAt`, `description`,
`result` (nullable), `status`, `performedById` (to `User`), `createdById` (to `User`),
`followUpRequired` (boolean, default false), `followUpNote` (nullable), `attachmentNotes`
(nullable), `clientRequestId` (nullable, unique), `version` (int, default 1), `createdAt`,
`updatedAt`. Indexes on `(ticketId, actionAt)` for the Ticket Detail list and on
`(performedById, status)` for the My Open Actions metric.

New model `TicketStatusChange`: `id`, `ticketId`, `fromStatus`, `toStatus`, `changedById`,
`changedAt`, with an index on `(ticketId, changedAt)`. It has no `updatedAt` because a row is never
changed.

`Ticket` gains `version` (int, default 1) and `resolvedAt` (nullable timestamp), plus an index on
`updatedAt` for the recently updated lists.

Two migrations: `lab4_actions_taken` (enum, `ActionTaken`, `Ticket.version`, `Ticket.resolvedAt`
and the backfill) and `lab4_status_history` (`TicketStatusChange`). Rollback is a written script,
`server/prisma/rollback/lab4_down.sql`, that drops only what Lab 4 added and removes the two
migration rows. It was tested on a copy of the database (see `tests.md`). The seed is updated as in
BR-36.

Database design decisions:

Decision 1 - a `version` integer for concurrency, not `updatedAt`. Comments and notes already move
`updatedAt` (L3-BR-30). If `updatedAt` was the check, a staff member changing the status would get
a conflict only because the Requester posted a comment, which is not a real conflict. A separate
counter that only moves on changes that overwrite something gives fewer false alarms. The check is
an atomic `UPDATE ... WHERE id = ? AND version = ?`, so two requests cannot both pass it.

Decision 2 - a `resolvedAt` column instead of reading the status history. The "recently resolved"
list would otherwise need the latest Resolved row per Ticket from the history table, and legacy
Tickets have no history at all. One nullable column is easy to index, easy to backfill from
`updatedAt`, and easy to explain.

Decision 3 - `ActionTaken` is a child table with a required foreign key, not a JSON column on
`Ticket`. Each action is edited on its own with its own version, it is counted per performer on
the dashboard, and the foreign key is what enforces BR-01 in the database itself.

Decision 4 - `clientRequestId` is unique but nullable. The unique index is what stops a duplicate
when two retries arrive at the same moment, which a "check then insert" in the code could not stop.
Old rows and test rows without it are allowed.

## 8. API Contract

Details are in `docs/lab-04/api-spec.md`. New endpoints: `POST` and `PATCH` under
`/api/staff/tickets/:id/actions`, `DELETE` there answering `405`, `GET /api/dashboard/requester`
and `GET /api/dashboard/staff`. Changed endpoints: both Ticket Detail responses now include
`actionsTaken`, `statusHistory`, `version` and `resolvedAt`; the three Lab 3 workflow `PATCH`
endpoints accept an optional `version` and answer `409 STALE_UPDATE`; the status endpoint applies
the gate; `GET /api/tickets` and `GET /api/staff/tickets` accept `statusGroup=active`. All other
Lab 2 and Lab 3 endpoints are unchanged. Error bodies stay `{ error, details?, code? }`.

## 9. Acceptance Criteria

| ID | Criterion |
|---|---|
| AC-01 | Given a permitted IT Staff user and valid data, when an Action Taken is created, then it is saved under the correct Ticket with the authenticated creator and the approved performer. |
| AC-02 | Given an authenticated Requester, when dashboard data is retrieved, then only metrics and recent Tickets owned by that Requester are returned. |
| AC-03 | Given an IT Staff user, when they record an action for a colleague, then Performed by is the colleague and Created by is still the signed-in user. |
| AC-04 | Given an inactive IT Staff user or a Requester as performer, when the action is saved, then it is refused with `422` and nothing is saved. |
| AC-05 | Given Follow-Up Required set to yes and no note, when the action is saved, then it is refused with `400` and the field error is shown under the Follow-up Note field. |
| AC-06 | Given a Completed action without a Result, or a non planned action dated in the future, when it is saved, then it is refused with `400`. |
| AC-07 | Given a Planned action, when IT Staff start it and then complete it with a result, then each step is saved and the action becomes read only. |
| AC-08 | Given an action edited by someone else since it was loaded, when the old version is saved, then the API answers `409 STALE_UPDATE`, nothing is saved, and the screen asks the user to reload. |
| AC-09 | Given a Requester account, when the Actions Taken create or edit endpoint is called directly, then it answers `403`, and the Requester screen shows the actions with no edit control. |
| AC-10 | Given a Ticket with no Completed action, or with an open action, when IT Staff move it to Resolved, then it is refused with `409` and the status is unchanged. |
| AC-11 | Given an owned Ticket with Completed actions only, when IT Staff resolve it, then the status becomes Resolved, `resolvedAt` is set and one history row is appended. |
| AC-12 | Given a Resolved, Closed or Cancelled Ticket, when an action is created, then it is refused with `409`. |
| AC-13 | Given two staff members on the same Ticket, when the second one saves a status change based on an old version, then it is refused with `409 STALE_UPDATE`. |
| AC-14 | Given several status changes, when the Ticket Detail is opened, then the history shows every change once, oldest first, and no endpoint can edit or delete it. |
| AC-15 | Given the same create request sent twice with the same `clientRequestId`, then only one action exists. |
| AC-16 | Given an IT Staff user, when the staff dashboard is retrieved, then every count equals the result of its documented query on the database. |
| AC-17 | Given an IT Staff user, when the dashboard is retrieved, then it contains no user counts; given an Administrator, it contains them. |
| AC-18 | Given a Requester or an IT Staff user, when the dashboard endpoint of the other role is called, then it answers `403`, and without a session `401`. |
| AC-19 | Given a dashboard card, when it is clicked, then the matching filtered list opens and shows the same number of Tickets as the card. |
| AC-20 | Given a Requester with no Tickets, when the dashboard opens, then every count is 0 and the lists show their empty message. |
| AC-21 | Given the Lab 3 database, when the Lab 4 migrations run, then every Ticket, User, Attachment, Public Comment and Internal Note is still there, legacy Tickets have zero actions, and legacy Resolved/Closed Tickets have `resolvedAt`. |
| AC-22 | Given the complete Lab 1 to Lab 3 test suites, when they run on `main` after Lab 4, then they all pass. Only the assertions that a Lab 4 rule changes on purpose may be updated, and each one is listed in `tests.md` section 6. |
| AC-23 | Given the dashboards and the Ticket Detail with Actions Taken at 1440, 768 and 390 pixels, then there is no horizontal overflow, no clipped or overlapping control, and keyboard focus is visible. |
| AC-24 | Given a failed save of the action form (network or conflict), then the values typed by the user are still in the form. |

## 10. Definition of Done

Prepared with the AI agent and checked by me at the end. The sprint is done when every FR works in
the running application; every BR is enforced by the backend and not only by the interface; every
AC maps to at least one automated test in `docs/lab-04/tests.md` and this test passes on `main`;
the complete suite of Labs 1 to 4 (unit, API, component, end-to-end and visual) passes on `main`
with nothing skipped; the migrations ran on the existing Lab 3 database with no data lost and the
rollback was tested on a copy; the seed runs twice without duplicates; there is no console error,
broken link, placeholder text or unfinished control on the Lab 4 screens; desktop, tablet and
mobile screenshots of the dashboards and Actions Taken are in `artifacts/lab-04/screenshots/`; the
README explains setup, migration, seed, tests and the demo; the six files in `docs/lab-04/` agree
with the code; and all work reached `main` through feature branches and Pull Requests into
`lab4-staging`.

## 11. Assumptions and Decisions

The handout says Performed by is automatic, but the grading also asks for assigning an action and
refusing an inactive assignee. I joined both: Performed by is filled automatically with the
signed-in user, and it can be changed to another active staff member. This also covers the case
where an action is planned for a colleague.

Actions Taken have their own small status (Planned, In Progress, Completed, Cancelled). Without it
the gate in BR-18 could only check "there is at least one action", which says nothing about the
work being finished.

The landing page after login is not changed to the dashboard. Several Lab 2 and Lab 3 end-to-end
tests check where a user lands, and the regression suite is the main evidence of this sprint, so I
kept them unchanged and put Dashboard first in the navigation instead.

The `version` field is optional on the three Lab 3 workflow endpoints and required on the new
Action Taken edit endpoint. Making it required everywhere would break the Lab 3 API contract for no
real gain, because the only client of those endpoints, the Lab 4 interface, always sends it.

Dashboards are not cached. The data is small, and a cached count that is older than the list it
opens would look like a bug. This follows the idea from the architecture lecture that the simplest
layered design is the default until there is a measured need for a cache tier.
