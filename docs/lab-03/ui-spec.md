# Lab 3 UI Specification

Extends `docs/lab-02/ui-spec.md`. The Zen Green design system is reused without change: the same
CSS custom properties in `client/src/styles/zen-theme.css`, the same card, field, badge, button and
table components, the same validation placement under the field, and the same breakpoints
(desktop >= 992px, tablet 768-991px, mobile < 768px). Nothing in Lab 3 introduces a second visual
system; every new screen is built from the components Lab 2 already established.

## 1. What changes in the shell

The Lab 2 header showed the selected Development Requester and a Change Requester action. Both are
removed (BR-42). The header now shows the authenticated user's name, a role badge next to it, and
a menu containing the email address, a Change Password link and Logout.

Navigation is role-specific (FR-05, AC-25). Links that the role cannot use are not rendered:

| Role | Navigation |
|---|---|
| Requester | My Tickets, Create Ticket |
| IT Staff | Ticket Queue |
| Administrator | Ticket Queue, Users |

Under 992px the navigation collapses into the existing hamburger control, unchanged from Lab 2.

## 2. Login screen

Outside the shell, centred card on the page background, maximum width 420px. Brand mark above the
card. Fields: Email address, Password. One primary Sign In button, full width.

States. Idle: both fields empty, button enabled. Validating: a missing or malformed email shows
the message under the field and the form is not submitted. Busy: the button shows "Signing in…"
and is disabled so a double submit cannot create two sessions. Failure: one red alert box above
the fields reading "Invalid email or password", with both values kept so the user does not retype
the email (BR-05 means the message is identical for a wrong password, an unknown account and an
inactive account). Server unreachable: the same alert box with "Unable to reach the TokTickIT
server", which is deliberately distinguishable from a credential failure because the user can act
on it.

There is no "forgot password" link, because password reset by email is out of scope (labsheet 4.2).

## 3. Change Password screen

Shown automatically after login when the account is flagged (FR-04, AC-02), and reachable from the
header menu at any time. Same centred card as Login, outside the shell, and when it is shown
because of the flag there is no navigation at all, so the only ways out are completing the change
or logging out.

Fields: Current password, New password, Confirm new password. Under the new password field, the
four rules from BR-06 are listed as a live checklist, each turning from grey to green as it is
satisfied: at least 8 characters, an upper case letter, a lower case letter, a digit, a special
character. The Continue button stays disabled until all rules pass and the two new values match.

A wrong current password shows the message under the Current password field, not as a page-level
alert, because the field is the thing the user has to fix.

## 4. Requester screens after Lab 3

My Tickets, Create Ticket and Ticket Detail keep the Lab 2 layout, columns, filters and states
unchanged (FR-07, AC-08). Two things are added to Ticket Detail.

A Public Comments panel below the attachment panel: a text area with a Post Comment button, and
the existing comments below it, oldest first, each showing the author name, a role badge and the
time. An empty panel shows "No comments yet." rather than nothing at all.

A "Problem appears resolved" button in the Ticket header area. Pressing it asks for confirmation
in the existing dialog component, then records the timestamp and replaces the button with the text
"You reported this looks resolved on <date>". The Ticket status badge does not change, and the
screen says so in small text under the button, because a Requester may reasonably expect it to
(BR-24, BR-31). The button is absent once the Ticket is Resolved, Closed or Cancelled.

The Requester never sees an Internal Notes panel, an owner control, an IT Priority control or a
status control.

## 5. IT Staff Ticket Queue

The working list over all Tickets. Header row: the screen title, then the result count.

Controls, in one row that wraps on narrow screens: a search box (ticket number or summary), and
filters for Category, Status, IT Priority and Owner. The Owner filter has an "Unassigned" option,
because finding unclaimed work is the main reason to open this screen.

Desktop table columns: Ticket No., Created, Summary, Category, Req. Priority, IT Priority, Status,
Owner. Sortable columns are Ticket No., Created, IT Priority and Status, with the existing sort
arrow indicator. Summary is truncated with an ellipsis at one line and carries the full text as a
tooltip. The Owner cell shows "Unassigned" in muted text when there is none, never an empty cell.
Clicking anywhere on the row opens the Ticket Detail.

Eight columns is close to the mega-grid the labsheet warns about, so Requester, Related System and
Last Updated are deliberately left out of the table and shown only on the detail screen. Both
priorities are kept because the whole point of IT Priority is that it can differ from what the
Requester asked for, and a queue that showed only one of them would hide that.

Tablet drops the Category and Req. Priority columns. Mobile replaces the table with the Lab 2 card
list: ticket number and status badge on the first line, summary on the second, then category, IT
Priority and owner as small labelled values.

States: loading spinner; empty ("No tickets in the queue yet."); no-results ("No tickets match
these filters." with a Clear filters button); failure (alert box with Retry). Pagination is the
existing component, default page size 20.

## 6. IT Staff Ticket Detail

Same three-column information grid as the Lab 2 Requester detail so the two screens read as the
same application, with the operational controls made editable.

Read-only: Ticket No., Category, Related System, Requester, Requested Priority, Created,
Summary, Description, and the attachment list with the Lab 2 download and removal behaviour.

Editable: Ticket Owner (a select listing active IT Staff and Administrators, plus "Unassigned",
with a Claim button beside it as a shortcut for assigning to yourself), IT Priority (a select),
and Current Status (a select offering only the statuses permitted from the current one, so an
illegal transition is not offered at all - while the backend still refuses it if sent anyway,
which is the point of BR-22). Editable fields use the Zen Green input styling; read-only fields
use the flat grey styling from Lab 2, so the difference is visible at a glance.

If the Requester has indicated the problem appears resolved, a notice sits at the top of the
screen with the date. It is a notice, not a status.

Below the grid, two clearly different panels side by side on desktop and stacked on mobile.

Public Comments: white card, green accent, header "Public Comments - visible to the Requester".

Internal Notes: grey-tinted card, amber accent, header "Internal Notes - never visible to the
Requester", and the same warning repeated as placeholder text inside the text area. The two panels
never share a submit button and are never in the same form, so a note cannot be posted into the
public stream by a mis-click.

Saving any control shows the button in a busy state and then a short inline confirmation next to
that control, not a page-level banner, so it is obvious which field was saved. A refused status
transition shows the server message under the status select and reverts the select to the stored
value.

## 7. Administrator User Management

One screen, deliberately minimal. Left side: the user list. Right side: a panel that is either
empty, creating, or editing.

List: a search box over name and email, an optional Role filter, and a Create User button. The
table shows Name, Email, Role badge, Status badge and an Edit action. There is no pagination and
no multi-column sorting, by scope decision (labsheet 4.2). Inactive rows show the status badge in
the muted removed-style from Lab 2, so a deactivated account is visible without reading the text.

Create panel: Full Name, Email Address, Role (one select, single choice only), Active toggle,
Initial Password with the same live rule checklist as the Change Password screen, and a note that
the user will be asked to change it at first login.

Edit panel: the same fields except the password, plus a "Set new initial password" section with
its own field and its own button, kept separate from Save so the two actions cannot be confused.
A Deactivate button sits at the bottom in the destructive styling, and is replaced by Activate for
an inactive account.

Validation and refusals are shown where they belong: a duplicate email under the email field; the
last-administrator refusal and the self-deactivation refusal as an alert box at the top of the
panel, because they are about the operation rather than about one field. The Deactivate button is
also disabled for the Administrator's own row, with a tooltip, but the backend refuses it anyway.

Success shows a short green confirmation above the list and the list reloads in place.

## 8. Responsive and accessibility rules

Unchanged from Lab 2 and applied to every new screen. Every screen is checked at 1440, 768 and
390 pixels wide with no horizontal overflow and no clipped or overlapping control (AC-26). Badges
always carry text, never colour alone. Every input has a real label. The focus ring from the Lab 2
theme is kept on all new controls. Comment and note text is rendered as text, never as HTML
(BR-29). Alert boxes use `role="alert"` and loading panels use `role="status"`, as in Lab 2.

## 9. Screenshot evidence

Committed under `artifacts/lab-03/screenshots/`, in `authentication/`, `staff-queue/`,
`staff-ticket-detail/` and `user-management/`, each with `desktop/`, `tablet/` and `mobile/`
versions, generated by `e2e/lab-03/responsive-visual.spec.ts`.
