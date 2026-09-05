# Lab 2 API Contract

Base URL: `http://localhost:3000`. All bodies are JSON unless noted. All responses are JSON,
including errors, in the shape `{ "error": "<safe message>", "details"?: {...} }`.

## Authentication / identity header

Every endpoint under `/api/tickets*` and `/api/attachments*` requires:

```
X-Dev-Requester-Id: <integer requesterId>
```

This is the Lab 2 testing mechanism (BR-05/BR-08), not authentication. Behavior:

| Condition | Status | Body |
|---|---|---|
| Header missing or not a positive integer | `400` | `{ "error": "X-Dev-Requester-Id header is required" }` |
| Header value does not match any Requester | `404` | `{ "error": "Requester not found" }` |
| Header value matches a Requester with `isActive = false` | `403` | `{ "error": "Requester is inactive" }` |

Reference-data endpoints (`/api/categories`, `/api/related-systems`, `/api/requesters`) do not
require this header.

---

## GET /api/categories

Active Categories, for the Create Ticket and My Tickets filter dropdowns.

**200 OK**
```json
[{ "id": 1, "name": "Account and Access" }, { "id": 2, "name": "Hardware" }]
```
Ordered by `id` ascending. Only `isActive: true` rows. `500` on unexpected failure:
`{ "error": "Unable to load categories" }`.

## GET /api/related-systems

Same shape/behavior as above, for Related Systems: `[{ "id": 1, "name": "Email" }, ...]`.

## GET /api/requesters

Active Development Requesters, for the Requester Selection dropdown.

**200 OK**
```json
[{ "id": 1, "name": "Jennifer Anderson", "email": "jennifer.anderson@example.com" }]
```
Ordered by `name` ascending. Only `isActive: true` rows. Empty array (not an error) when none
exist — the frontend renders the empty state for that case. `500` on unexpected failure.

---

## POST /api/tickets

Create one Ticket for the Requester identified by `X-Dev-Requester-Id`.

**Request body**
```json
{
  "categoryId": 2,
  "relatedSystemId": 6,
  "summary": "Laptop battery drains quickly",
  "description": "My laptop battery is draining much faster than usual even when the system is idle.",
  "requestedPriority": "MEDIUM"
}
```

**Validation (BR-14 to BR-17)**
| Field | Rule |
|---|---|
| `categoryId` | required, integer, must reference an active `Category` |
| `relatedSystemId` | required, integer, must reference an active `RelatedSystem` |
| `summary` | required, trimmed length 5-120 |
| `description` | required, trimmed length 20-2000 |
| `requestedPriority` | required, one of `LOW`, `MEDIUM`, `HIGH` |

**201 Created**
```json
{
  "id": 42,
  "ticketNumber": "TKT-2026-000042",
  "requesterId": 1,
  "categoryId": 2,
  "relatedSystemId": 6,
  "summary": "Laptop battery drains quickly",
  "description": "My laptop battery is draining much faster than usual even when the system is idle.",
  "requestedPriority": "MEDIUM",
  "currentStatus": "NEW",
  "createdAt": "2026-08-25T09:14:00.000Z",
  "updatedAt": "2026-08-25T09:14:00.000Z"
}
```

**Errors**
| Status | Cause | Body |
|---|---|---|
| `400` | one or more fields fail validation | `{ "error": "Validation failed", "details": { "summary": "Summary must be 5-120 characters" } }` (one entry per invalid field) |
| `422` | `categoryId`/`relatedSystemId` well-formed but references an unknown/inactive row | `{ "error": "Validation failed", "details": { "categoryId": "Unknown or inactive category" } }` |
| `403`/`404` | identity header problem, see above | as above |
| `500` | unexpected | `{ "error": "Unable to create ticket" }` |

Attachments are **not** part of this request. The client uploads each selected file with
separate `POST /api/tickets/:id/attachments` calls right after this response returns
`ticketNumber`, per BR-25.

---

## GET /api/tickets

List the current Requester's own Tickets (never another Requester's, regardless of query
params — the header identity always scopes the query, BR-13).

**Query parameters**
| Param | Type | Default | Notes |
|---|---|---|---|
| `search` | string | — | matches `ticketNumber` (contains, case-insensitive) OR `summary` (contains, case-insensitive) |
| `categoryId` | integer | — | filter |
| `requestedPriority` | `LOW`\|`MEDIUM`\|`HIGH` | — | filter |
| `currentStatus` | `TicketStatus` | — | filter (only `NEW` occurs in Lab 2 data, param accepted generically) |
| `sortBy` | `createdAt`\|`ticketNumber`\|`summary`\|`requestedPriority` | `createdAt` | invalid value → `400` |
| `sortDir` | `asc`\|`desc` | `desc` | invalid value → `400` |
| `page` | integer ≥ 1 | `1` | non-integer/`<1` → `400` |
| `pageSize` | `10`\|`20`\|`50` | `10` | any other value → `400` |

Secondary sort is always `id asc` (stable ordering when the primary sort key ties, e.g. two
Tickets created in the same millisecond).

**200 OK**
```json
{
  "data": [
    { "id": 42, "ticketNumber": "TKT-2026-000042", "summary": "Laptop battery drains quickly",
      "categoryName": "Hardware", "requestedPriority": "MEDIUM", "currentStatus": "NEW",
      "createdAt": "2026-08-25T09:14:00.000Z", "updatedAt": "2026-08-25T09:14:00.000Z" }
  ],
  "pagination": { "page": 1, "pageSize": 10, "totalItems": 1, "totalPages": 1 }
}
```
Empty `data` array with `totalItems: 0` is a normal `200`, not an error (BR-31 — the frontend
decides empty-vs-no-results from whether any filter/search param was supplied).

**Errors**: `400` invalid query parameter (`{ "error": "Invalid query parameter", "details": { "sortBy": "must be one of createdAt, ticketNumber, summary, requestedPriority" } }`), identity errors as above, `500` unexpected.

---

## GET /api/tickets/:id

One Ticket owned by the current Requester, including its Attachments (active and removed).

**200 OK**
```json
{
  "id": 42,
  "ticketNumber": "TKT-2026-000042",
  "requesterId": 1,
  "requesterName": "Jennifer Anderson",
  "categoryId": 2,
  "categoryName": "Hardware",
  "relatedSystemId": 6,
  "relatedSystemName": "Corporate Laptop",
  "summary": "Laptop battery drains quickly",
  "description": "My laptop battery is draining much faster than usual even when the system is idle.",
  "requestedPriority": "MEDIUM",
  "currentStatus": "NEW",
  "createdAt": "2026-08-25T09:14:00.000Z",
  "updatedAt": "2026-08-25T09:14:00.000Z",
  "attachments": [
    { "id": 5, "originalName": "screenshot.png", "mimeType": "image/png", "sizeBytes": 204800,
      "uploadedAt": "2026-08-25T09:15:00.000Z", "removedAt": null, "removedReason": null }
  ]
}
```

**Errors**: `404` if the id does not exist **or** is not owned by the current Requester
(BR-13/AC-03 — identical response either way), identity errors as above, `500` unexpected.

---

## POST /api/tickets/:id/attachments

Upload one Attachment to a Ticket owned by the current Requester. `multipart/form-data`, field
name `file`.

**Validation (BR-22 to BR-24)**
- MIME type + extension must be one of: `image/jpeg` (.jpg/.jpeg), `image/png` (.png),
  `image/webp` (.webp), `application/pdf` (.pdf).
- Size ≤ 5 MB (5 * 1024 * 1024 bytes).
- The Ticket must currently have fewer than 5 **active** Attachments.

**201 Created**
```json
{ "id": 5, "ticketId": 42, "originalName": "screenshot.png", "mimeType": "image/png",
  "sizeBytes": 204800, "uploadedAt": "2026-08-25T09:15:00.000Z" }
```

**Errors**
| Status | Cause |
|---|---|
| `400` | no file part in the request |
| `404` | Ticket not found / not owned |
| `409` | Ticket already has 5 active Attachments |
| `413` | file exceeds 5 MB |
| `415` | disallowed type/extension |
| `500` | unexpected (e.g. disk write failure) |

## GET /api/attachments/:id

Metadata for one Attachment on a Ticket owned by the current Requester (active or removed).

**200 OK**: same attachment shape as embedded in `GET /api/tickets/:id`, plus `ticketId`,
`removedById`.

**Errors**: `404` not found / not owned, identity errors as above.

## GET /api/attachments/:id/download

Binary download of one **active** Attachment owned by the current Requester.
`Content-Disposition: attachment; filename="<originalName>"`, correct `Content-Type`.

**Errors**: `404` not found / not owned, `410 Gone` (`{ "error": "Attachment has been removed" }`)
if the Attachment exists, is owned, but `removedAt` is set (BR-28/AC-20).

## DELETE /api/attachments/:id

Soft-remove one Attachment owned by the current Requester.

**Request body**
```json
{ "reason": "Wrong screenshot, replaced by the correct one" }
```
`reason` required, trimmed length 3-200 (BR-27).

**200 OK**
```json
{ "id": 5, "removedAt": "2026-08-25T10:00:00.000Z", "removedReason": "Wrong screenshot, replaced by the correct one" }
```

**Errors**: `400` missing/invalid `reason`, `404` not found / not owned, `409` if already
removed (`{ "error": "Attachment already removed" }`), identity errors as above.

---

## HTTP status summary

| Status | Used for |
|---|---|
| 200 | successful GET, successful soft-remove |
| 201 | Ticket created, Attachment uploaded |
| 400 | malformed body / missing required field / invalid query param / missing identity header |
| 403 | identity header refers to an inactive Requester |
| 404 | unknown Requester id in header; Ticket/Attachment not found or not owned |
| 409 | max active Attachments reached; Attachment already removed |
| 410 | download requested for a removed Attachment |
| 413 | uploaded file exceeds 5 MB |
| 415 | uploaded file type not permitted |
| 422 | well-formed but semantically invalid reference (unknown/inactive `categoryId`/`relatedSystemId`) |
| 500 | unexpected server error (generic client message, full detail logged server-side only) |
