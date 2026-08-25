# Lab 2 Zen Green UI Specification

## 1. Color tokens

Defined as CSS custom properties in `client/src/zen-theme.css`, used everywhere — no
hard-coded hex values in component files.

| Token | Value | Used for |
|---|---|---|
| `--zen-primary` | `#006B3C` | App header background, primary buttons, strong emphasis, active nav |
| `--zen-primary-hover` | `#00552F` | Primary button hover/active (darkened primary) |
| `--zen-secondary` | `#0B7A46` | Active tab underline, focus accents, links, hover states |
| `--zen-pale` | `#EAF6EF` | Selected rows, success surfaces, subtle section emphasis, read-only field background |
| `--zen-bg` | `#F5F7F6` | Page background |
| `--zen-surface` | `#FFFFFF` | Cards, panels, table rows |
| `--zen-border` | `#D8E3DD` | Default card/input border |
| `--zen-text` | `#1E2B24` | Body text (dark charcoal-green, not pure black) |
| `--zen-text-muted` | `#54655C` | Secondary text, hints, placeholders |
| `--zen-error` | `#B3261E` | Error text/border |
| `--zen-error-bg` | `#FBEAE9` | Error banner background |
| `--zen-warning` | `#8A5A00` | Warning text |
| `--zen-warning-bg` | `#FFF4DE` | Warning callout/badge background |
| `--zen-success` | `#0B7A46` | Success text |
| `--zen-focus-ring` | `#2B8A5C` | `:focus-visible` outline color, 2px, 2px offset, on every interactive control |

## 2. Typography and spacing

- Font stack: system UI stack (`-apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif`) —
  no external font loading, keeps the app fast and self-contained.
- Base size 16px, `line-height: 1.5`. Headings step down: h1 28px/700, h2 22px/600, h3 18px/600,
  labels 14px/600, body 15px/400, help/error text 13px/400.
- Spacing scale (used for gaps/padding/margins): 4, 8, 12, 16, 24, 32, 48px
  (`--zen-space-1` … `--zen-space-6`). Cards use 24px padding on desktop, 16px on mobile.

## 3. Field states

One shared `.zen-field` wrapper (label + control + help/error) used by every input:

| State | Visual rule |
|---|---|
| Editable | White (`--zen-surface`) background, `1px solid --zen-border`, radius 8px |
| Read-only / system-generated | `--zen-pale` background, `--zen-border`, not focusable, no caret; a small "system-generated" hint under it the first time it appears (Ticket Number, Ticket Date, Requester on Create Ticket) |
| Focused | `--zen-border` → `--zen-secondary`, plus the shared `:focus-visible` ring |
| Invalid | Border and label text `--zen-error`; error message directly below the field, never only in a page-top banner (component rule from §8.3 of the handout) |
| Disabled | 60% opacity, `cursor: not-allowed`, no hover/focus styling — visually distinct from read-only (read-only looks intentional/permanent; disabled looks temporarily unavailable) |

Required fields: red asterisk (`--zen-error` colored `*`) immediately after the label text. The
asterisk never substitutes for the validation message (component rule, handout §8.3).

## 4. Button hierarchy

| Class | Look | Use |
|---|---|---|
| `.zen-btn-primary` | Solid `--zen-primary`, white text, hover `--zen-primary-hover` | Submit, Continue, Create Ticket |
| `.zen-btn-secondary` | White background, `--zen-secondary` border/text | Cancel, Back, Change Requester |
| `.zen-btn-tertiary` | Text-only, `--zen-secondary` | Clear Filters, inline links |
| `.zen-btn-destructive` | White background, `--zen-error` border/text; solid `--zen-error` on hover | Remove Attachment |
| `.zen-btn[disabled]` | 60% opacity, `cursor: not-allowed`, pointer-events none | Any button mid-validation-failure or otherwise inactive |
| `.zen-btn.is-busy` | Spinner + dimmed label, still same size (no layout shift), `disabled` | Submit while a request is in flight (BR-19) |

Every icon-only control (e.g. a small "i" info glyph, a table sort arrow acting as a button)
carries `aria-label` and a native `title` tooltip — text buttons are preferred everywhere else
(component rule, handout §8.3).

## 5. Badges

One shared `.zen-badge` component, shape only changes by variant, never by color alone (each
carries readable text, not a color swatch):

| Field | Value | Badge text | Color |
|---|---|---|---|
| Requested Priority | `LOW` | "Low" | pale surface, `--zen-secondary` text |
| Requested Priority | `MEDIUM` | "Medium" | `--zen-warning-bg` surface, `--zen-warning` text |
| Requested Priority | `HIGH` | "High" | `--zen-error-bg` surface, `--zen-error` text |
| Current Status | `NEW` | "New" | `--zen-pale` surface, `--zen-primary` text |
| Attachment state | active | "Active" | `--zen-pale` surface, `--zen-secondary` text |
| Attachment state | removed | "Removed" | neutral gray surface, `--zen-text-muted` text |

## 6. Screen states (all three main screens)

Every data screen (Create Ticket reference data, My Tickets list, Ticket Detail) implements the
same five states so behavior is predictable:

1. **Loading** — centered spinner + "Loading…" text, `role="status"`.
2. **Empty** — first-use state (no data ever existed for this Requester/Ticket) with a primary
   action forward (e.g. Create Ticket).
3. **No-results** — data exists but the current filter/search matches nothing; primary action is
   Clear Filters, not Create Ticket.
4. **Error** — safe message + Retry button; never a raw stack trace or backend error string.
5. **Populated** — the normal content state.

## 7. Application shell

- Header: `--zen-primary` background, white text. Left: clock-badge icon + "TokTickIT"
  wordmark. Center/left nav: "My Tickets", "Create Ticket" — active item gets a
  `--zen-secondary` bottom border and slightly bolder text (clear active-page indication,
  handout §8). Right: current Requester name + chevron, opens a small menu with "Change
  Requester".
- Below 992px: nav collapses behind a hamburger button (`aria-expanded`, `aria-label="Open
  navigation"`), full-width menu on open, still keyboard reachable.
- Breadcrumb row under the header on My Tickets / Create Ticket / Ticket Detail, e.g.
  `My Tickets > Ticket Details`.

## 8. Requester Selection screen (`/select-requester`)

- Centered card, max-width 480px, on `--zen-bg`.
- Icon, "Select Development Requester" h1, one-sentence notice (exact text from handout §8.1):
  *"Select a Development Requester to test requester-specific ticket behavior. This is not a
  login screen. Authentication and role-based access will be introduced in Lab 3."*
- `<select>` labeled "Development Requester", populated from `GET /api/requesters`.
- Info callout: "Only active development requesters are shown."
- Secondary callout: "Authentication coming in Lab 3."
- Primary button "Continue" (disabled until a Requester is chosen), secondary "Cancel" (no-op /
  stays on screen — there is nowhere else to go without a selection).
- States: loading (spinner in place of the select), empty (`GET /api/requesters` returns `[]` →
  message "No active development requesters are available. Contact an administrator." + no
  Continue), failure (network/500 → safe message + Retry).
- Fully keyboard operable: `<label for>` on the select, `Tab` reaches select → Continue →
  Cancel in order, `Enter` on the select's parent form submits when a value is chosen.

## 9. Create Ticket screen (`/tickets/new`)

Layout, top to bottom (desktop, two-column where noted):
1. System-generated row (read-only fields, shown once the Ticket exists — see success state
   below; before creation this row is omitted rather than shown blank, since there is nothing
   generated yet): Ticket Number, Ticket Date, Requester.
2. Classification row (2-3 columns on desktop, stacked on mobile): Category (`<select>`),
   Related System (`<select>`), Requested Priority (segmented control or `<select>`, pre-set to
   `MEDIUM`).
3. Summary — single-line text input, full width, 120 char counter.
4. Description — `<textarea>`, full width, resizable vertically only, 2000 char counter.
5. Attachments — drag/drop + browse button, list of selected files with size + a per-file
   remove (✕) before submit, inline error per rejected file (wrong type / too large / limit
   reached).
6. Actions — `.zen-btn-primary` "Submit Ticket" (busy state per BR-19), `.zen-btn-secondary`
   "Cancel" (returns to My Tickets, confirmation if fields are dirty).

States:
- **Initial**: all fields empty/default, Requester field pre-filled read-only from context.
- **Validation failure**: per-field messages under each invalid field (BR-14 to BR-17); Submit
  re-enabled; nothing cleared.
- **Submitting**: Submit shows `.is-busy`, all fields disabled, no double-submit possible.
- **Success**: replaced by a confirmation panel — large Ticket Number, `--zen-pale` success
  surface, "View Ticket" (`.zen-btn-primary`) and "Back to My Tickets" (`.zen-btn-secondary`);
  if any attachment upload failed after Ticket creation (BR-25), a `--zen-warning-bg` callout
  lists which file(s) failed with a "Retry from Ticket Detail" link.
- **API failure**: `--zen-error-bg` banner above the form, all entered values retained
  (BR-20/AC-06), Submit re-enabled.
- **Invalid attachment**: the offending file is not added to the list; an inline message
  explains why (type/size/count), the rest of the form is untouched.

## 10. My Tickets screen (`/tickets`)

- Header row: "My Tickets" h1 + subtitle, "Clear Filters" (`.zen-btn-tertiary`) and "+ Create
  Ticket" (`.zen-btn-primary`) top-right.
- Controls row: search input (placeholder "Search by ticket number or summary…"), Category
  filter, Requested Priority filter, Current Status filter — each a `<select>` defaulting to
  "All …". Changing any control re-queries `GET /api/tickets` (debounced 300ms for the search
  box, immediate for selects).
- **Desktop (≥992px)**: table — columns Ticket No., Created Date, Summary, Category, Requested
  Priority, Current Status, Last Updated. Ticket No./Created Date/Summary/Requested Priority
  headers are clickable to sort (arrow indicator for current `sortBy`/`sortDir`); row click (and
  `Enter` when focused) opens Ticket Detail.
- **Tablet (768-991px)**: same table, Category column hidden to keep row height sane;
  visible again ≥1200px is fine too, but must not clip at 768px.
- **Mobile (<768px)**: one card per Ticket — Ticket No. + Requested Priority badge on the first
  line, Summary as the title, Category / Current Status / Last Updated as small meta rows;
  whole card is the tap target.
- Pagination footer: "Showing X to Y of Z tickets" + Previous / page numbers / Next
  (`.zen-btn-tertiary`, current page visually distinct with `--zen-primary` fill).
- States: loading (skeleton rows/cards), empty (BR-31, "You haven't created any tickets yet" +
  Create Ticket), no-results (BR-31, "No tickets match your filters" + Clear Filters), failure
  (safe message + Retry, filters/search preserved for the retry).

## 11. Requester Ticket Detail screen (`/tickets/:id`)

- Breadcrumb "My Tickets > Ticket Details" + "← Back to My Tickets" top-right.
- Read-only header grid (2-3 columns desktop, 1 column mobile), visually distinct
  read-only styling throughout (§3 above): Ticket No., Ticket Date, Category, Related System,
  Requester, Requested Priority (badge), Current Status (badge), Summary (full width),
  Description (full width, preserves line breaks).
- Attachments panel, clearly separated (bordered card) from the ticket fields above it, so
  "current ticket information" and "attachment actions" are never visually mixed (handout
  §8.5):
  - "+ Add Attachment" control (same validation as Create Ticket's uploader) — hidden/disabled
    once 5 active Attachments exist, with a note why.
  - List of Attachments, active first then removed, each row: file-type icon, original name,
    size, upload date, "Active"/"Removed" badge; active rows get Download and Remove
    (`.zen-btn-destructive`, opens a small confirm dialog requiring a non-empty reason,
    BR-27); removed rows show the removal date + reason instead of actions, download/preview
    controls are not rendered at all for them (not just disabled).
- No Public Comments, Internal Notes, Actions Taken, or status controls anywhere on this screen
  (explicit exclusion, handout §8.5).
- States: loading, failure (Ticket not found/not owned → the same "not found" message,
  BR-13/AC-03 — this screen never distinguishes "doesn't exist" from "not yours").

## 12. Responsive rules

| Viewport | Behavior |
|---|---|
| Desktop ≥ 992px | Multi-column layouts as described per screen above; content max-width 1140px, centered |
| Tablet 768-991px | Two-column classification/detail grids; My Tickets table keeps Ticket No./Summary/Priority/Status/Updated, drops Category |
| Mobile < 768px | Everything single column; My Tickets becomes cards; nav collapses to hamburger; buttons full-width and ≥44px tall (touch target); no horizontal page scroll anywhere |
| All sizes | No clipped labels, no overlapping messages, no hidden buttons, attachment names truncate with `text-overflow: ellipsis` + full name in a `title` attribute rather than being cut off unreadably |

## 13. Accessibility

- Every input has a real `<label for>` (not placeholder-only labeling).
- `:focus-visible` ring (`--zen-focus-ring`, 2px, 2px offset) on every interactive element —
  never `outline: none` without a visible replacement.
- Non-color indicators everywhere color is used: badges carry text, error fields carry a
  message + red border (not red alone), success carries a checkmark glyph + text.
- Dialogs (remove-attachment confirm) trap focus and close on `Escape`, returning focus to the
  control that opened them.
- Live regions: `role="status"` on loading text, `role="alert"` on error banners, so screen
  readers announce state changes.

## 14. Visual inspection checklist (used for §8.8/§9 of the handout, filled in per run)

- [ ] Desktop (1280×800), tablet (834×1112), mobile (390×844) screenshots captured for Create
      Ticket (initial + validation-failure + success), My Tickets (populated + empty +
      no-results), Ticket Detail (populated with mixed active/removed attachments).
- [ ] No clipped labels or truncated buttons at any captured width.
- [ ] No unintended horizontal scroll on the page body at any captured width.
- [ ] Priority/Status/Attachment badges render consistently across all three screens.
- [ ] Read-only fields are visually distinguishable from editable fields without relying on the
      label text alone.
- [ ] Filters, pagination, and attachment controls remain operable (not just visible) at mobile
      width.

Screenshot paths: `artifacts/lab-02/screenshots/create-ticket/`,
`artifacts/lab-02/screenshots/my-tickets/`, `artifacts/lab-02/screenshots/ticket-detail/`, one
subfolder per viewport (`desktop/`, `tablet/`, `mobile/`) inside each.
