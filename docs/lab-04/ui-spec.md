# Lab 4 UI Specification

Extends `docs/lab-03/ui-spec.md`. The Zen Green system is reused as it is: the custom properties
in `client/src/styles/zen-theme.css`, the card, field, badge, button, table, state panel and
banner components, validation under the field, and the same breakpoints (desktop >= 992px, tablet
768 to 991px, mobile < 768px). Lab 4 adds a few classes to the same stylesheet (metric card, action
row, history list) and no new design system.

## 1. Navigation

Every role gets a Dashboard item, first in the list (FR-13). The active item keeps the Lab 2
underline and bold style, so the current page is clear without colour alone.

| Role | Navigation |
|---|---|
| Requester | Dashboard, My Tickets, Create Ticket |
| IT Staff | Dashboard, Ticket Queue |
| Administrator | Dashboard, Ticket Queue, Users |

The landing page after login does not change (My Tickets for a Requester, Ticket Queue for staff),
see specification section 11. `/dashboard` shows the Requester dashboard or the staff dashboard
depending on the role. The server decides what data each role gets; the page only picks the layout.

## 2. Metric card

A white card with a short label at the top, the number in large bold text, and a "View" link at the
bottom. The whole card is not clickable, only the link, so keyboard users have one clear focus
target. The link has an accessible name with the number in it, for example "View 4 unassigned
tickets". A count of 0 is still shown with its link (BR-31). Cards sit in a grid: 4 per row on
desktop, 2 on tablet, 1 on mobile below 480px and 2 above.

## 3. Requester Dashboard

Title "Welcome, <first name>" and one line "Here is the latest on your requests." A Refresh button
on the right (secondary style).

Row of four metric cards (BR-27): My Active Tickets, Waiting for Me, Resolved, Closed. Each "View"
opens My Tickets with the filter already set.

Below, two columns on desktop and one column under 992px:
left a "Needs My Attention" card (Tickets waiting for the Requester) and a "Recently Updated" card;
right a "Recently Resolved" card and a "Quick Actions" card with Create Ticket and View My Tickets.
Each list row shows the ticket number, the summary, a status badge and the date, and opens the
Ticket Detail. Lists show at most 5 rows and a "View all" link.

States: loading uses the Lab 2 spinner panel. Error shows the safe failure panel with a Retry
button. A list with no rows shows a short muted sentence, for example "Nothing is waiting for you."
A Requester with no Tickets sees four 0 cards and the empty sentences, plus the Create Ticket quick
action (AC-20).

## 4. IT Staff Dashboard (and Administrator)

Title "Welcome back, <first name>" and the line "Here is what is happening in the queue today."
Refresh button.

First row: metric cards Unassigned, Assigned to Me, My Open Actions (BR-28). For an Administrator a
fourth card "Active Users" is added with the user counts in small text under the number and a link
to Users (BR-29).

Second row: "Tickets by Status" card with one small link per status (status badge and count), and
"Active by IT Priority" with High, Medium, Low. Each one opens the queue filtered.

Third row, two columns on desktop: "My Open Actions" list (ticket number, action description,
action status badge, date; opens the Ticket Detail), "Urgent Tickets" list (active and IT Priority
High, oldest first), "Recently Updated" list. Each list max 5 rows.

States: same as the Requester dashboard. A Requester opening a staff URL sees the Lab 3 forbidden
panel, and the API answers `403` anyway.

## 5. Drill-down into My Tickets and the Ticket Queue

Both list screens now read their filters from the URL the first time they load (FR-12):
`currentStatus`, `itPriority`, `ownerId` and `statusGroup`. The Status select gets one more option,
"Active (not finished)", which is `statusGroup=active`. So the number on the card and the number of
rows in the list are calculated with the same filter (AC-19). Changing a filter after that works as
in Lab 3.

## 6. Actions Taken on the IT Staff Ticket Detail

A new card "Actions Taken (n)" between the ticket information card and the Attachments card (FR-04).

List mode. One row per action, in the order of BR-15. A row shows: the Action Date/Time, an action
status badge with text (Planned, In Progress, Completed, Cancelled), the description in bold, the
result under it, "Performed by <name>" and, when it is different, "recorded by <name>", a "Follow-up
needed" marker with an icon and text when Follow-Up Required is yes plus the follow-up note, and
the Attachment Notes in muted text with a paperclip icon. Planned and In Progress rows have an Edit
button. Completed and Cancelled rows have no button, because they are read only (BR-10). With no
actions the card says "No actions recorded yet." (BR-34).

Create mode. "Add Action" (primary) opens the form inside the same card, above the list. Fields:
Action Date/Time (datetime-local, default now), Status (Completed by default, Planned, In Progress),
Performed by (select of active staff, default the signed-in user, marked "(me)"), Action
Description (textarea, required), Result (textarea, required when Completed), Follow-Up Required
(checkbox), Follow-up Note (textarea, only shown and required when the box is checked), Attachment
Notes (text input with the hint "Which file to look at, for example screenshot-error.png").
Buttons: Save Action (primary) and Cancel (tertiary).

View/edit mode. Edit opens the same form with the values of the action. The Status select only
offers the current status and the permitted moves (BR-08), so for a Planned action it offers
Planned, In Progress, Completed and Cancelled.

Feedback. Field errors appear under the field (Lab 2 rule). While saving the button reads
"Saving..." and is disabled (FR-14). Success closes the form, reloads the Ticket and shows "Action
saved" in the card header for a few seconds. A stale version (`409 STALE_UPDATE`) shows a warning
banner in the form, "This action was changed by someone else", with a Reload button; the typed
values stay in the form until the user reloads (AC-24). A Ticket that is Resolved, Closed or
Cancelled hides the Add Action button and shows "Reopen the ticket to record more work." (BR-11).

## 7. Actions Taken on the Requester Ticket Detail

Same card and same rows, read only: no Add Action button, no Edit button, no form (FR-05, AC-09).
The card title is "Work done by IT".

## 8. Status control and status history

The status select on the IT Staff Ticket Detail works like in Lab 3 and offers only the permitted
moves. When the gate refuses Resolved, the reason from the API is shown under the select in the
error style, for example "Complete or cancel the open actions before resolving this ticket." A
stale version shows "This ticket was changed by someone else" with a Reload button. After a
successful change the ticket is reloaded, so the status badge and the summary update (handout
8.4).

A "Status History" card on both Ticket Detail screens lists the changes oldest first: "In Progress
to Resolved - Michael Brown - 26 Oct 2026, 11:00". Legacy Tickets say "No status changes recorded
since Lab 4."

## 9. Responsive and accessibility rules

Same as Labs 2 and 3. No horizontal page scroll at 1440, 768 and 390 pixels. Metric grids and list
columns collapse as described above. Action rows stack their meta line under the text on mobile and
the Edit button becomes full width. Every form control has a visible label. Focus ring
`--zen-focus-ring` stays on every new link and button. Status, priority and follow-up are always
shown with text, never colour alone. The action form is not a modal, so there is no focus trap to
get wrong.

## 10. Visual and accessibility checklist

Filled in at the end of the sprint from the visual test run (`e2e/lab-04/responsive-visual.spec.ts`)
and a manual look at every screenshot.

| Check | Result |
|---|---|
| Same Zen Green tokens, cards, buttons and badges on all Lab 4 screens | Pass, only new classes in the same stylesheet |
| Dashboard navigation item for each role, active page marked | Pass, UI-14 |
| Metric cards: label, value, accessible "View" link, zero shown | Pass, UI-01, UI-03, UI-04 |
| Actions Taken: editable rows vs read only rows clearly different | Pass, Edit button only on Planned and In Progress rows, UI-08 |
| Requester view has no action controls | Pass, UI-10 and E2E-01 |
| Validation messages under their field | Pass, UI-07 and the create-form-validation screenshots |
| Keyboard: every new control reachable with Tab, focus ring visible | Pass, A11Y-01 |
| No clipping or overlap at 1440, 768, 390 | Pass after one fix: the Internal Notes card was lower than the Public Comments card |
| No horizontal overflow at 1440, 768, 390 | Pass, measured by VIS-01 to VIS-03 |
| No console error on the Lab 4 screens | Pass, checked in VIS-01 to VIS-03 |
| No leftover placeholder text or temporary controls | Pass after two fixes: the My Tickets status filter only had "New", and its Retry button did nothing |

## 11. Screenshot evidence

Captured by `e2e/lab-04/responsive-visual.spec.ts` into `artifacts/lab-04/screenshots/`:
`staff-dashboard/`, `requester-dashboard/` and `actions-taken/`, each with `desktop/`, `tablet/`
and `mobile/`.
