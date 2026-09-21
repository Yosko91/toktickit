# Lab 3 REST API Specification

Base URL `http://localhost:3000`. Extends `docs/lab-02/api-spec.md`. Every Lab 2 endpoint still
exists, but the `X-Dev-Requester-Id` header is gone: identity now comes from the session cookie.

## 1. Authentication mechanism

Login creates a `Session` row keyed by 32 random bytes rendered as hex, and returns it in a cookie:

```
Set-Cookie: toktickit.sid=<token>; HttpOnly; SameSite=Lax; Path=/; Max-Age=28800
```

The cookie is `HttpOnly` so client JavaScript cannot read it, and `SameSite=Lax` so it is not sent
on cross-site requests, which is the CSRF control for this lab. `Secure` is not set because the
lab runs over plain HTTP on localhost; it must be set in any real deployment.

The client must send credentials on every call (`fetch(..., { credentials: "include" })`), and the
server must allow them (`cors({ origin: <client origin>, credentials: true })`).

Every request carrying a valid, unexpired session gets `req.user = { id, name, email, role,
mustChangePassword }`. Middleware chain:

| Middleware | Effect |
|---|---|
| `requireAuth` | `401` when there is no cookie, no matching session, or the session has expired. |
| `requirePasswordChanged` | `403` with `code: "PASSWORD_CHANGE_REQUIRED"` when `mustChangePassword` is set. Applied to everything except `GET /api/auth/me`, `POST /api/auth/change-password` and `POST /api/auth/logout` (BR-02). |
| `requireRole(...roles)` | `403` when the authenticated role is not in the list (BR-12). |

## 2. Error body

```json
{ "error": "Validation failed", "details": { "email": "A valid email address is required" } }
```

`details` is present only for field-level validation failures. `code` is present only on the
password-change-required response, so the client can redirect instead of showing an error.

| Status | Meaning |
|---|---|
| 400 | Malformed or invalid input |
| 401 | Not authenticated, or session expired / revoked |
| 403 | Authenticated but the role is not permitted, or a password change is pending |
| 404 | Not found, or hidden because it belongs to another Requester (BR-13) |
| 409 | Conflict: duplicate email, illegal status transition, last-administrator rule, already resolved |
| 413 / 415 | Attachment too large / type not permitted (unchanged from Lab 2) |
| 422 | Input is well formed but references something unusable (unknown category, owner who is not staff) |
| 500 | Unexpected server error |

## 3. Auth endpoints

### POST /api/auth/login

Public. Body `{ "email": string, "password": string }`.

`200` returns the user, and sets the session cookie:

```json
{ "id": 3, "name": "Jennifer Anderson", "email": "jennifer.anderson@toktickit.dev",
  "role": "REQUESTER", "mustChangePassword": false }
```

`400` when email or password is missing. `401` with the single message
`"Invalid email or password"` for an unknown email, a wrong password and an inactive account alike
(BR-05). A password hash is never returned by this or any other endpoint (BR-38).

### POST /api/auth/logout

Requires a session. Deletes the session row and clears the cookie. `204` with no body. Replaying
the old cookie afterwards answers `401` (BR-08, AC-06).

### GET /api/auth/me

Requires a session, but not a completed password change. `200` returns the same user shape as
login. `401` when unauthenticated.

### POST /api/auth/change-password

Requires a session. Body `{ "currentPassword": string, "newPassword": string }`.

`200` returns the updated user with `mustChangePassword: false`. Clears the flag and deletes the
user's other sessions, keeping the current one (BR-07).

`400` when `currentPassword` is wrong, or when `newPassword` fails BR-06, or when the new password
equals the current one. `details.newPassword` carries the specific rule that failed.

## 4. Requester ticket endpoints

All require `REQUESTER` unless stated. All are scoped to the authenticated user (BR-03); an id sent
in the body or in a leftover `X-Dev-Requester-Id` header is ignored (AC-03).

| Method | Path | Notes |
|---|---|---|
| POST | `/api/tickets` | Unchanged from Lab 2 except that the requester is taken from the session. `itPriority` is set equal to `requestedPriority` (BR-20). `201`. |
| GET | `/api/tickets` | Unchanged search / filter / sort / pagination, scoped to the session user. |
| GET | `/api/tickets/:id` | `404` when the Ticket belongs to somebody else. Response now also carries `itPriority`, `ownerName`, `requesterResolvedAt`, and `publicComments`. It never carries Internal Notes (BR-26). |
| POST | `/api/tickets/:id/attachments` | Unchanged from Lab 2. |
| GET | `/api/attachments/:id/download` | Unchanged. Permitted for the owning Requester and for staff. |
| DELETE | `/api/attachments/:id` | Unchanged. |

### POST /api/tickets/:id/comments

Permitted for the owning Requester, IT Staff and Administrator. Body `{ "body": string }`.

`201` returns `{ "id", "ticketId", "authorId", "authorName", "authorRole", "body", "createdAt" }`.
`400` when the body is empty, whitespace only, or longer than 2000 characters (BR-29). `404` for a
Requester who does not own the Ticket. Updates the Ticket's `updatedAt` (BR-30).

### POST /api/tickets/:id/requester-resolved

Requires `REQUESTER` and ownership. No body. `200` returns
`{ "id", "requesterResolvedAt", "currentStatus" }` with the status unchanged (BR-31, AC-10).
`409` when the Ticket is already `RESOLVED`, `CLOSED` or `CANCELLED`. `403` for staff, because
this action represents the Requester's own opinion.

## 5. IT Staff endpoints

All require `IT_STAFF` or `ADMINISTRATOR` (BR-16). A `REQUESTER` gets `403` (AC-17).

### GET /api/staff/tickets

The shared queue over all Tickets from all Requesters.

| Parameter | Values | Default |
|---|---|---|
| `search` | free text, matched against ticket number and summary, case-insensitive | none |
| `categoryId` | positive integer | none |
| `currentStatus` | any status from BR-21 | none |
| `itPriority` | `LOW` / `MEDIUM` / `HIGH` | none |
| `ownerId` | user id, or the literal `unassigned` | none |
| `sortBy` | `createdAt`, `updatedAt`, `ticketNumber`, `itPriority`, `currentStatus` | `createdAt` |
| `sortDir` | `asc` / `desc` | `desc` |
| `page` | integer >= 1 | 1 |
| `pageSize` | 10, 20 or 50 | 20 |

`200`:

```json
{ "data": [ { "id": 12, "ticketNumber": "TKT-2026-000012", "summary": "VPN drops every hour",
              "categoryName": "Network", "requesterName": "Sarah Johnson",
              "requestedPriority": "HIGH", "itPriority": "HIGH", "currentStatus": "IN_PROGRESS",
              "ownerId": 21, "ownerName": "Michael Brown",
              "createdAt": "...", "updatedAt": "..." } ],
  "pagination": { "page": 1, "pageSize": 20, "totalItems": 87, "totalPages": 5 } }
```

`400` for an invalid parameter value, naming the parameter in `details`.

### GET /api/staff/tickets/:id

`200` returns the full Ticket including `description`, `attachments`, `publicComments`,
`internalNotes`, `requesterResolvedAt`, both priorities and the owner. `404` for an unknown id.

### PATCH /api/staff/tickets/:id/owner

Body `{ "ownerId": number | null }`. Claiming is the caller's own id, releasing is `null`,
reassigning is somebody else's id (BR-18). `200` returns `{ "id", "ownerId", "ownerName" }`.
`422` when the target user does not exist, is inactive, or is a Requester (BR-17).

### PATCH /api/staff/tickets/:id/it-priority

Body `{ "itPriority": "LOW" | "MEDIUM" | "HIGH" }`. `200` returns
`{ "id", "itPriority", "requestedPriority" }`, where `requestedPriority` is unchanged (BR-19,
AC-13). `400` for an unknown value.

### PATCH /api/staff/tickets/:id/status

Body `{ "currentStatus": <status> }`. `200` returns `{ "id", "currentStatus" }`.

`409` when the transition is not in the BR-22 matrix, and `409` with
`"A ticket must have an owner before it can be resolved"` when resolving an unassigned Ticket
(BR-23, AC-14, AC-15). Nothing is written in either case.

### GET and POST /api/staff/tickets/:id/notes

Internal Notes. `GET` returns the notes oldest first; `POST` takes `{ "body": string }` and
answers `201` with the same shape as a Public Comment. A `REQUESTER` calling either gets `403`
with no note content and no count (BR-14, AC-04).

### GET /api/staff/assignable-users

Returns the active `IT_STAFF` and `ADMINISTRATOR` accounts, so the reassign control can offer a
list. `200` returns `[ { "id", "name", "role" } ]`.

## 6. Administrator endpoints

All require `ADMINISTRATOR`. Any other role gets `403` and no user data (BR-15, AC-23).

### GET /api/admin/users

| Parameter | Values |
|---|---|
| `search` | free text, matched against name and email, case-insensitive |
| `role` | `REQUESTER` / `IT_STAFF` / `ADMINISTRATOR` |

`200` returns the whole matching list, ordered by name. There is no pagination, by scope decision
of the labsheet section 4.2.

```json
[ { "id": 21, "name": "Michael Brown", "email": "michael.brown@toktickit.dev",
    "role": "IT_STAFF", "isActive": true, "mustChangePassword": false, "createdAt": "..." } ]
```

### POST /api/admin/users

Body `{ "name", "email", "role", "isActive", "initialPassword" }`. `201` returns the created user.
The account always gets `mustChangePassword: true` (BR-32). `400` for a missing field, an invalid
email, an unknown role, or an initial password failing BR-06. `409` for a duplicate email (BR-33,
AC-19).

### PATCH /api/admin/users/:id

Body may contain any of `name`, `email`, `role`, `isActive`. `200` returns the updated user.

`409` for a duplicate email; `409` with `"The last active administrator cannot be deactivated or
demoted"` for any change that would leave zero active Administrators (BR-35, AC-21); `403` when an
Administrator targets their own account with `isActive: false` or a role change (BR-34, AC-22).
`404` for an unknown id.

### POST /api/admin/users/:id/initial-password

Body `{ "initialPassword": string }`. `200` returns the updated user with
`mustChangePassword: true`. Replaces the hash and deletes that user's sessions (BR-37), so the
next login lands on the mandatory change screen (AC-20). `400` when the password fails BR-06.

## 7. Removed in Lab 3

`GET /api/requesters` is deleted together with the Development Requester selector (BR-42). The
`X-Dev-Requester-Id` header is no longer read anywhere; sending it has no effect.
