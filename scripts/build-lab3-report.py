"""Builds the Lab 3 submission document.

Aptos 12 throughout, as little formatting as possible, and the nine "Answer
Part" headings the labsheet requires in section 14. Screenshots that only exist
in the GitHub interface are left as [TO ADD: ...] markers for me to paste in.

Run from the repository root:  python scripts/build-lab3-report.py
"""

import os
import subprocess
from docx import Document
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.shared import Cm, Pt, RGBColor

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SHOTS = os.path.join(REPO, "artifacts", "lab-03", "screenshots")
OUT_DIR = os.path.join(
    os.path.expanduser("~"),
    "OneDrive - Groupe ESIEA", "ESIEA", "KMUTT", "Software Engeneering", "homework",
)
OUT = os.path.join(OUT_DIR, "rendu_lab3_MOSCATO.docx")

REPO_URL = "https://github.com/Yosko91/toktickit"
BLOB = REPO_URL + "/blob/main"

doc = Document()

# Aptos 12 as the document default.
style = doc.styles["Normal"]
style.font.name = "Aptos"
style.font.size = Pt(12)
style.paragraph_format.space_after = Pt(8)
style.paragraph_format.line_spacing = 1.15

for section in doc.sections:
    section.top_margin = Cm(2)
    section.bottom_margin = Cm(2)
    section.left_margin = Cm(2.2)
    section.right_margin = Cm(2.2)


def para(text="", bold=False, size=None, space_after=None):
    p = doc.add_paragraph()
    run = p.add_run(text)
    run.bold = bold
    run.font.name = "Aptos"
    run.font.size = Pt(size or 12)
    if space_after is not None:
        p.paragraph_format.space_after = Pt(space_after)
    return p


def part(number, title):
    """The exact heading format the labsheet asks for."""
    doc.add_paragraph()
    p = doc.add_paragraph()
    run = p.add_run("Answer Part %d: %s" % (number, title))
    run.bold = True
    run.font.name = "Aptos"
    run.font.size = Pt(13)
    return p


def mono(text, size=9):
    """Console output and file trees, kept monospaced so they stay readable."""
    for line in text.rstrip().split("\n"):
        p = doc.add_paragraph()
        p.paragraph_format.space_after = Pt(0)
        p.paragraph_format.left_indent = Cm(0.4)
        run = p.add_run(line if line.strip() else " ")
        run.font.name = "Consolas"
        run.font.size = Pt(size)
    doc.add_paragraph().paragraph_format.space_after = Pt(6)


def todo(text):
    p = doc.add_paragraph()
    run = p.add_run("[TO ADD: %s]" % text)
    run.font.name = "Aptos"
    run.font.size = Pt(12)
    run.font.color.rgb = RGBColor(0xC0, 0x00, 0x00)
    run.bold = True
    return p


def shot(relative_path, width_cm=15.5, caption=None):
    path = os.path.join(SHOTS, relative_path)
    if not os.path.exists(path):
        todo("missing screenshot %s" % relative_path)
        return
    doc.add_picture(path, width=Cm(width_cm))
    doc.paragraphs[-1].alignment = WD_ALIGN_PARAGRAPH.CENTER
    if caption:
        p = doc.add_paragraph()
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        run = p.add_run(caption)
        run.italic = True
        run.font.name = "Aptos"
        run.font.size = Pt(10)


def table(rows, widths=None):
    t = doc.add_table(rows=0, cols=len(rows[0]))
    t.style = "Table Grid"
    for index, row in enumerate(rows):
        cells = t.add_row().cells
        for cell, value in zip(cells, row):
            cell.text = ""
            p = cell.paragraphs[0]
            p.paragraph_format.space_after = Pt(2)
            run = p.add_run(str(value))
            run.font.name = "Aptos"
            run.font.size = Pt(10)
            run.bold = index == 0
    if widths:
        for row in t.rows:
            for cell, width in zip(row.cells, widths):
                cell.width = Cm(width)
    doc.add_paragraph().paragraph_format.space_after = Pt(6)


def read(path, default=""):
    full = path if os.path.isabs(path) else os.path.join(REPO, path)
    try:
        with open(full, encoding="utf-8", errors="replace") as handle:
            return handle.read()
    except OSError:
        return default


def git(args, default=""):
    try:
        return subprocess.check_output(
            ["git"] + args, cwd=REPO, text=True, stderr=subprocess.DEVNULL
        ).strip()
    except Exception:
        return default


# ---------------------------------------------------------------- title block

para("CPE 334 Introduction to Software Engineering in the Age of AI Agents", bold=True, size=13)
para("Lab 3. TokTickIT Users, Roles, IT Staff Ticketing, and Admin Screens")
para("Yohann Raphael Axel Moscato - 69540460011")
para("Repository: " + REPO_URL)
para()
para(
    "Lab 3 replaces the Development Requester selector from Lab 2 with a real login. Users now "
    "sign in with an email and a password, and the server decides what each role is allowed to "
    "do. The sprint also adds the first IT Staff workflow and a small Administrator screen for "
    "managing accounts. All the Lab 2 Requester features still work, now using the account the "
    "user signed in with."
)

# --------------------------------------------------------------------- part 1

part(1, "Git Use with Engineering Workflow")

para(
    "I used the same branch flow as Lab 2. Six feature branches were merged into lab3-staging "
    "one after another, and then lab3-staging was merged into main through a release Pull "
    "Request. Each branch was created from the previous one, so every Pull Request only shows "
    "its own files. Nothing was developed directly on main."
)

para("Commits on the Lab 3 branches, in order:")
mono(read("/tmp/commits.txt", git(["log", "--format=%h  %ad  %s", "--date=format:%Y-%m-%d %H:%M",
                                   "--reverse", "lab3-staging..main"])))

para("Links", bold=True)
todo("paste the GitHub Project link and the Issue and Pull Request numbers here, for example:\n"
     "GitHub Project: https://github.com/users/Yosko91/projects/1\n"
     "Issue 1 - Sprint 3 engineering contract: " + REPO_URL + "/issues/NN\n"
     "PR #NN - feature/lab3-01-spec-and-test-plan: " + REPO_URL + "/pull/NN\n"
     "(repeat for the six Issues, the six Pull Requests, and the release Pull Request)")

para("Kanban board with all Issues in Done", bold=True)
todo("screenshot of the GitHub Project board, Done column, with the Lab 3 Issues readable")

para("Commit history showing the branches merged into lab3-staging and then main", bold=True)
todo("screenshot of the repository Insights > Network graph, or of the commit list on main, "
     "framed on the Lab 3 merges")

para("Repository structure", bold=True)
mono(
    "toktickit/\n"
    "  docs/lab-03/      specification.md, api-spec.md, ui-spec.md, tests.md,\n"
    "                    reviewer.md, ai-use.md\n"
    "  server/prisma/    schema.prisma, migrations/, seed.ts\n"
    "  server/src/       routes/ (auth, tickets, staff, admin users),\n"
    "                    middleware/auth.ts, services/\n"
    "  server/tests/     lab-01/, lab-02/, lab-03/, shared/auth.ts\n"
    "  client/src/       pages/, components/, context/AuthContext.tsx, api.ts, styles/\n"
    "  client/tests/     lab-02/, lab-03/\n"
    "  e2e/              lab-02/, lab-03/\n"
    "  artifacts/lab-03/screenshots/   authentication, staff-queue,\n"
    "                                  staff-ticket-detail, user-management\n"
    "  README.md, playwright.config.ts, .gitignore"
)

para(
    "The README explains how to run the project, lists the development accounts and their "
    "password, and gives the three test commands. The .gitignore keeps node_modules, the .env "
    "file and the uploaded attachment files out of the repository, so no secret and no uploaded "
    "file is committed."
)
para("README: " + BLOB + "/README.md")

para("Peer review", bold=True)
para("Reviewer: Heloise Savoye. The full record is in " + BLOB + "/docs/lab-03/reviewer.md")
todo("copy the filled review table from reviewer.md here (PR number, branch, link, verdict)")
todo("screenshot of a review comment I received on one of my Pull Requests, with my answer "
     "under it, both usernames visible")
todo("screenshot of a comment I left on one of my partner's Pull Requests, with their answer")

# --------------------------------------------------------------------- part 2

part(2, "Spec DD")

para("Specification: " + BLOB + "/docs/lab-03/specification.md")
para("API contract: " + BLOB + "/docs/lab-03/api-spec.md")
para("UI specification: " + BLOB + "/docs/lab-03/ui-spec.md")

para(
    "The specification has 20 numbered functional requirements, 42 numbered business rules, an "
    "authorization matrix for the three roles, a status transition matrix, 26 acceptance "
    "criteria and a Definition of Done. It also records the choices the handout left open and "
    "why I made them."
)

para(
    "The main decisions were these. Sessions are rows in the database behind an httpOnly cookie, "
    "not a JWT, because logout has to stop a session immediately and a self contained token "
    "cannot do that without a deny list that ends up being the same table. An ownership failure "
    "answers 404 while a role failure answers 403, because a 403 on a ticket id would tell a "
    "curious Requester that the id exists and belongs to someone else. Administrators share the "
    "IT Staff ticket rights, which the handout allows only if the matrix says so, because an "
    "Administrator can be a Ticket Owner and it would make no sense for an owner to be unable to "
    "act on their own ticket."
)

para(
    "One rule changed after I tried to test it. BR-35 protects the last active Administrator. "
    "Writing its test showed that it cannot be reached in a normal request, because BR-34 "
    "already refuses the only path to it: if one active Administrator is left, the only account "
    "that could deactivate it is itself, and that is refused first. The rule is kept for the "
    "case where two Administrators act at the same moment, and it is tested as a race instead of "
    "with a test that would pass without proving anything. This is written in section 11 of the "
    "specification."
)

para("Evidence that the specification was written before the implementation", bold=True)
para(
    "The contract was committed on its own branch before any implementation branch existed. The "
    "first commit that touches specification.md and the first commit that touches application "
    "code are 14 minutes apart:"
)
mono(
    "$ git log --reverse --format=\"%h %ad %s\" --date=format:\"%Y-%m-%d %H:%M\" \\\n"
    "        -- docs/lab-03/specification.md\n"
    + read("/tmp/spec-evidence.txt").split("\n")[0] + "\n\n"
    "$ git log --reverse --format=\"%h %ad %s\" --date=format:\"%Y-%m-%d %H:%M\" \\\n"
    "        -- server/src client/src\n"
    "8677dbe  2026-09-18 16:41  feat: Lab 3 authentication foundation and User migration"
)
para(
    "The file was edited again later, at 17:13, to add the BR-35 finding described above. That "
    "is the second commit shown by git for this file."
)
todo("screenshot of " + REPO_URL + "/commits/main/docs/lab-03/specification.md showing the "
     "first commit and its date")

# --------------------------------------------------------------------- part 3

part(3, "Test DD and Traceability")

para("Test plan and results: " + BLOB + "/docs/lab-03/tests.md")

para(
    "The plan was written next to the specification, before the implementation branches. It "
    "lists 91 planned tests with the requirement or acceptance criterion each one covers, the "
    "file it lives in, and its final status. Every one of the 26 acceptance criteria maps to at "
    "least one test, and the mapping table is in section 3 of tests.md."
)

para(
    "There are five layers. Unit tests cover the password rule and the status transition matrix, "
    "which are the two places where a silent mistake would be dangerous rather than visible. API "
    "tests run against the real Express app and the real PostgreSQL database, not mocks, because "
    "the point of this lab is that the backend refuses things, and a mocked database cannot prove "
    "that a Requester really cannot read someone else's ticket. Component tests check what the "
    "screens do with the answers they get. End to end tests cover the journeys that cross "
    "screens. Visual tests capture desktop, tablet and mobile screenshots and check there is no "
    "horizontal overflow."
)

para(
    "Authorization is tested twice on purpose: once by calling the endpoint directly with the "
    "wrong role, and once by checking the control is not rendered. The handout says hiding a "
    "button is not authorization, so the API test is the one that counts and the interface test "
    "only confirms the feedback matches."
)

para("Test output from main", bold=True)
para("Backend, all three labs:")
mono(read("/tmp/server-test.txt"))
para("Frontend component tests:")
mono(read("/tmp/client-test.txt"))
para("End to end, responsive and visual tests:")
mono(read("/tmp/e2e-test.txt"))

para(
    "That is 255 tests in total, with nothing skipped and nothing disabled. The Lab 1 and Lab 2 "
    "suites are inside those numbers rather than run separately, because they are the regression "
    "evidence: the Lab 2 features still work after identity moved from a request header to a "
    "session."
)

para(
    "Two Lab 2 expectations were changed on purpose. A request with no identity answered 400 in "
    "Lab 2 and answers 401 now, because there is no session rather than a missing header. A "
    "request naming an inactive or unknown user answered 403 and 404, and both answer 401 now, "
    "because an account that cannot authenticate is simply not authenticated. The old test for "
    "GET /api/requesters became a check that the endpoint is gone."
)

para("Defects the tests found", bold=True)
para(
    "One endpoint was unreachable. The test for the assignable users list got a 404 because the "
    "router had been mounted one level too deep, so the route answered at a different URL from "
    "the one in api-spec.md. In the interface this would only have shown as an empty dropdown, "
    "which looks like a ticket nobody can be assigned to rather than a bug."
)
para(
    "The Administrator screen overflowed the screen at tablet width. The visual test measured a "
    "page 986 pixels wide inside a 768 pixel viewport. There were two causes. A grid column "
    "declared 1fr cannot shrink below its content, so the five column table pushed the whole "
    "layout past the screen and the scrolling wrapper never got a chance to work. Under that, "
    "the hidden span used for the Actions column header was absolutely positioned and stretched "
    "the document on its own. Both are fixed, and that header is now normal visible text."
)
para(
    "The user table disappeared on a phone. The rule that hides a table below 768 pixels was "
    "written for the ticket lists, which swap to cards at that size, but it applied to every "
    "table in the app. The user table has no card version, so it rendered as nothing. The rule "
    "now only applies to the lists that have a card version."
)
para(
    "Two of the failures were my own test mistakes, and I kept them in tests.md because they "
    "were worth learning from. A Prisma filter written as equals: undefined means no filter at "
    "all, so a check meant to count rows with a missing value counted all 86 of them. And a "
    "pagination test assumed the number of tickets would not change between two requests, which "
    "was false while other test files were inserting rows at the same time, so it passed alone "
    "and failed in a full run."
)

# --------------------------------------------------------------------- part 4

part(4, "AI Use with Reflection")

para("LLM used: Claude Opus 5, through Claude Code in the VS Code extension.")
para("Full prompt list and reflection: " + BLOB + "/docs/lab-03/ai-use.md")

para(
    "Lab 3 was run differently from Lab 2. In Lab 2 I directed the agent phase by phase with many "
    "separate prompts. In Lab 3 I gave it the handout and one broad instruction, and it worked "
    "through the sprint on its own: the contract first, then six feature branches, running the "
    "test suites itself and fixing what failed. My own prompts were few and mostly about "
    "restarting after a usage limit. The specification agent and the coding agent were the same "
    "session, but the specification was written and committed before any code existed, which is "
    "visible in the git history."
)

para("My Reflection", bold=True)
para(
    "The part I would do differently is supervision. In Lab 2 I reviewed at every phase. In Lab 3 "
    "I effectively reviewed twice, and the defects above show what that cost. The agent mounted a "
    "router at the wrong path while its own API specification said something else, and I would "
    "not have seen it from reading its summaries. The same is true of the tablet overflow and of "
    "the user table vanishing on mobile."
)
para(
    "What protected the work was that the tests were specified before the code and then actually "
    "run, not described. Three defects were found by assertions written from the contract rather "
    "than from the implementation. The clearest one is the internal note: an early version of the "
    "Requester ticket response included the note text in the JSON while the screen displayed "
    "nothing, so the screen looked correct and the private text was being sent anyway. That is "
    "exactly what the handout means when it says hiding a control is not authorization."
)
para(
    "Two smaller things are worth recording because they are about the agent checking itself. It "
    "found that BR-35 cannot be reached sequentially and wrote a concurrency test plus a note in "
    "the specification, instead of writing a test that would pass without exercising the rule. "
    "And when it first said the test plan was complete, the status column said Pass for tests "
    "that had not been run; that was corrected to Planned and only changed back once each suite "
    "had really been executed. Both are the same lesson: the claim and the evidence are different "
    "things, and only the evidence counts."
)

# --------------------------------------------------------------------- part 5

part(5, "Working Login and Password Change UI")

para(
    "Sign in uses an email and a password. A wrong password, an unknown email and a deactivated "
    "account all give the same message, so the screen cannot be used to find out which addresses "
    "have an account. A server that cannot be reached gives a different message, because the "
    "user can do something about that one."
)
shot("authentication/desktop/login-idle.png", caption="Login screen")
shot("authentication/desktop/login-invalid.png", caption="Refused credentials, one generic message")

para(
    "An account created by an Administrator starts with an initial password and must replace it "
    "before anything else opens. While the change is pending there is no navigation at all, so "
    "the only ways out are finishing it or signing out. The rules update live as the user types "
    "and Continue stays disabled until all of them pass and the two fields match."
)
shot("authentication/desktop/change-password.png", caption="Mandatory password change at first login")

para(
    "Logout deletes the session row, so a copied cookie stops working straight away. Test API-07 "
    "logs in, logs out, then replays the same cookie and gets 401. Test E2E-01 does the same "
    "through the browser and then opens a protected URL directly, which returns to the login "
    "screen."
)

para("The header shows who is signed in and their role, and the navigation depends on the role.")
shot("authentication/desktop/shell-requester.png", width_cm=15.5, caption="Requester navigation")
shot("authentication/desktop/shell-staff.png", width_cm=15.5, caption="IT Staff navigation")
shot("authentication/desktop/shell-administrator.png", width_cm=15.5, caption="Administrator navigation")

# --------------------------------------------------------------------- part 6

part(6, "Working IT Staff Ticket Queue UI")

para(
    "The queue shows every ticket from every Requester. It has a search over ticket number and "
    "summary, filters for category, status, IT priority and owner, sortable columns, and "
    "pagination. The owner filter has an Unassigned option, because finding work nobody has "
    "claimed is the main reason to open this screen. An unowned ticket shows Unassigned in the "
    "owner column instead of an empty cell."
)
shot("staff-queue/desktop/populated.png", caption="Ticket Queue with real data")

para(
    "Both priorities are in the table. That is on purpose: the whole point of IT Priority is that "
    "it can differ from what the Requester asked for, and a queue showing only one of them would "
    "hide that. Requester, Related System and Last Updated are left out of the table and shown on "
    "the detail screen instead, to avoid the unreadable grid the handout warns about."
)

para("The empty state and the no results state are different, and no results offers a way back.")
shot("staff-queue/desktop/no-results.png", caption="No results, with a Clear filters button")

# --------------------------------------------------------------------- part 7

part(7, "Working IT Staff Ticket Detail UI")

para(
    "The detail screen uses the same three column layout as the Requester screen, so the two read "
    "as one application. The ticket number, category, related system, requester, requested "
    "priority, summary and description are read only. The owner, the IT priority and the status "
    "are editable, and each one reports its own result next to itself rather than through a "
    "banner at the top, so it is obvious which field was saved."
)
shot("staff-ticket-detail/desktop/populated.png", caption="IT Staff Ticket Detail with both message panels")

para(
    "Claim assigns the ticket to the person clicking. The same control reassigns it to someone "
    "else or releases it. Only active IT Staff and Administrators appear in the list, and the "
    "server refuses a Requester or a deactivated account with 422 even if the request is sent "
    "directly."
)

para(
    "The status dropdown only offers the transitions allowed from the current status, so an "
    "illegal move is never presented. The server still refuses it if it is sent anyway, which is "
    "the point. A ticket also cannot be resolved while nobody owns it."
)

para(
    "The two message panels look different on purpose. Public Comments is a white card with a "
    "green edge and a header saying it is visible to the Requester. Internal Notes is a grey card "
    "with an amber edge and a header saying it is never visible to the Requester, and the same "
    "warning is repeated inside the text box. They are never in the same form and never share a "
    "submit button, so a note cannot be posted publicly by a mis-click."
)

para("Direct API authorization evidence", bold=True)
para(
    "These are tested by calling the endpoints directly, not by checking the interface. A "
    "Requester calling the queue, the staff operations, or the internal notes of their own ticket "
    "gets 403 with no data in the body, not even a count. The tests are in "
    "server/tests/lab-03/authorization.api.test.ts, and the relevant rows of the plan are API-13 "
    "to API-18 and API-45."
)
mono(
    "API-13  Requester -> GET /api/staff/tickets                403, no ticket data\n"
    "API-14  Requester -> GET /api/admin/users                  403, no user data\n"
    "API-15  IT Staff  -> GET /api/admin/users                  403\n"
    "API-16  Requester sends another id in header and body      200, own data only\n"
    "API-17  No session -> /api/tickets                         401\n"
    "API-18  Requester -> staff notes of own ticket             403, no note text, no count\n"
    "API-45  Requester -> PATCH staff status endpoint           403, status unchanged"
)

para(
    "The Requester side of the same ticket has a Public Comments panel and a button to say the "
    "problem appears resolved. That button records a date and does not change the status, and the "
    "screen says so, because a Requester could reasonably expect the badge to move. Only IT Staff "
    "resolve or close a ticket."
)

# --------------------------------------------------------------------- part 8

part(8, "Working Administrator User Management UI")

para(
    "The Administrator screen is deliberately small. The list shows name, email, role, status and "
    "an Edit action, with a search over name and email and an optional role filter. There is no "
    "pagination and no multi column sorting, which the handout lists as not required. A "
    "deactivated account shows a muted status badge, so it is visible without reading the text."
)
shot("user-management/desktop/list.png", caption="User list with search and role filter")

para(
    "Creating a user takes a name, an email, one role, an activation state and an initial "
    "password. The password rules update live, the same as on the change password screen, and "
    "Save stays disabled until they all pass. The new account always has to change that password "
    "at first login."
)
shot("user-management/desktop/create-panel.png", caption="Create user panel")

para(
    "Editing changes the name, email, role and activation state. Setting a new initial password "
    "has its own field and its own button, kept away from Save so the two cannot be confused, and "
    "it also ends that user's sessions. Deactivate sits at the bottom in the destructive style, "
    "and becomes Activate for an inactive account. There is no delete anywhere: users are "
    "deactivated instead, and the DELETE endpoint answers 405 and says why."
)

para(
    "A duplicate email is refused and shown under the email field. The two safety rules are shown "
    "as a message about the operation instead, because they are not about one field. An "
    "Administrator cannot deactivate their own account or change their own role, and the controls "
    "for that are disabled on their own row with the reason written next to them, although the "
    "server refuses it anyway. The system also refuses any change that would leave no active "
    "Administrator, checked inside one serialisable transaction so two people doing it at the "
    "same time cannot both get through."
)

# --------------------------------------------------------------------- part 9

part(9, "Zen Green UI and Responsive Evidence")

para("UI specification: " + BLOB + "/docs/lab-03/ui-spec.md")

para(
    "Lab 3 reuses the Zen Green system from Lab 2 without changing it. The same tokens, cards, "
    "fields, badges, buttons, validation placement and breakpoints are used, so the new screens "
    "look like part of the same application rather than a second design. Every screen was "
    "captured at 1440, 768 and 390 pixels by the visual test suite, which also measures the "
    "document width against the viewport width and fails if anything overflows."
)

para("Tablet, 768 pixels", bold=True)
shot("staff-queue/tablet/populated.png", width_cm=12, caption="Ticket Queue, tablet")
shot("user-management/tablet/list.png", width_cm=12, caption="User Management, tablet")

para("Mobile, 390 pixels", bold=True)
shot("staff-queue/mobile/populated.png", width_cm=7.5, caption="Ticket Queue, mobile, card layout")
shot("user-management/mobile/list.png", width_cm=7.5, caption="User Management, mobile")
shot("authentication/mobile/login-idle.png", width_cm=7.5, caption="Login, mobile")

para("Visual checklist", bold=True)
table([
    ["Check", "Result"],
    ["Design consistent with Lab 2 (tokens, cards, buttons)", "Pass, same stylesheet, no new system"],
    ["Role based navigation, no unauthorized destination shown", "Pass, UI-13 and E2E tests"],
    ["Badges for status, requested priority, IT priority and role", "Pass, all carry text, never colour alone"],
    ["Editable and read only fields visually different", "Pass, inputs against flat grey read only fields"],
    ["Validation shown under the field it belongs to", "Pass, rule failures under the field, operation failures as an alert"],
    ["Focus ring kept on all new controls", "Pass, inherited from the Lab 2 theme"],
    ["No clipping or overlap at 1440, 768 and 390", "Pass, VIS-01 to VIS-04"],
    ["No horizontal overflow", "Pass, measured, two real defects found and fixed"],
], widths=[10, 7])

para(
    "The overflow check is the one that earned its place. It found the Administrator screen 218 "
    "pixels too wide at tablet size and the user table missing entirely on a phone. Neither was "
    "visible in the screenshots themselves, which is why the test measures the page instead of "
    "only taking a picture of it."
)

doc.save(OUT)
print("Written: %s" % OUT)
print("Placeholders left for me to fill: %d" % sum(
    1 for p in Document(OUT).paragraphs if p.text.startswith("[TO ADD:")
))
