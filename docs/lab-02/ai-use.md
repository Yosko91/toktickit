# Lab 2 - AI Use and Reflection

**IDE / agent used:** Claude Code (VS Code extension), driving the repository directly - spec
agent and coding agent in the same session, unlike Lab 1's separate Windsurf conversations.
**LLM used:** Claude Sonnet 5.

Lab 2 was run as one continuous engineering session rather than many isolated prompts: I gave
the agent the Lab 2 labsheet and my Lab 1 submission for context, then directed it phase by
phase (spec first, then the backend as one foundation, then one screen per Issue), reviewing
output at each phase before moving to the next. The table below is the sequence of directions
that actually shaped the work, in order.

## Selected key prompts

| # | Prompt Name | Actual Prompt Text | My Reflection |
|---|-------------|--------------------|---------------|
| 1 | Continue Lab 2 from the repo | Continue the Lab 2 work in this repository. Do as much as possible so everything is complete and functional, then prepare the final submission as closely as possible to the required format. Leave clear placeholders and step-by-step instructions for anything only I can do (screenshots, GitHub UI actions). | Gave the agent room to plan the whole sprint instead of one screen at a time, which produced a more internally consistent spec than prompting screen-by-screen would have. |
| 2 | Explore before planning | (Implicit, via tool use) Inspect the existing repository, Lab 1 branches, and the Lab 1 submission PDF before writing anything. | This caught that `main` was missing `server/tsconfig.json` and had two client dotfiles committed with a leading underscore (`_gitignore`, `_oxlintrc.json`) instead of a dot, so they were never actually active. Both were quietly broken since Lab 1 and had to be fixed as part of the Lab 2 foundation. |
| 3 | Resolve workflow ambiguity | (Asked back to me) How should Git/GitHub work split between agent and student, and who is the Lab 2 peer reviewer? | The agent asked instead of assuming `gh` CLI access it didn't have (it isn't installed), and instead of guessing my reviewer stayed consistent with Lab 1. |
| 4 | Write the engineering contract first | Write `docs/lab-02/specification.md`, `tests.md`, `ui-spec.md`, and `api-spec.md`, resolving every ambiguity in the labsheet (identity header, ticket number generation, ownership-failure status codes, attachment storage strategy) before touching code. | This is the step that forced concrete decisions the labsheet deliberately left open - e.g. 404-not-403 for ownership failures, and a dedicated Postgres sequence for Ticket Numbers instead of deriving the number from the row id. |
| 5 | Implement the backend as one foundation | Implement the full Lab 2 Prisma schema, seed, and REST API (categories/related systems/requesters/tickets/attachments) in one Issue, with ownership enforced on every route, then write the planned API/unit tests against it before moving to the frontend. | Correct on effectively the first pass against my own spec, which just confirms the spec was precise enough - not that the code was risk-free. The real value was in the manual curl smoke tests before the automated ones: they caught nothing wrong, but forced me to actually read every response shape once. |
| 6 | Build the frontend screen by screen | Implement Requester Selection + the app shell first, then Create Ticket, then My Tickets, then Ticket Detail + Attachments, each on its own branch, each with its own Vitest component tests before moving on. | The agent had already written all four screens together (they share a router and components), then split the already-working code across four commits by curating which files landed in which commit - a reasonable shortcut, but it means the branches were not independently developed and tested in isolation, only independently reviewable. I noted this rather than pretending each branch was built blind to the others. |
| 7 | Fix what the test run actually found | Run every test suite for real and fix whatever fails - don't just report the plan as passing. | This is where the agent caught its own mistakes: `vi.clearAllMocks()` doesn't reset a mock's configured return value (only its call history), which let a leftover `mockResolvedValueOnce` queue from one test silently answer the next test's requests. Switching to `vi.resetAllMocks()` fixed two flaky-looking failures that were actually deterministic once understood. |
| 8 | Verify against the real running app, not just mocks | Run the Playwright E2E and screenshot suite against the real client, server, and database, and inspect the actual generated screenshots rather than only the pass/fail line. | Caught a real bug the component tests couldn't see: two screenshots (Create Ticket "initial", My Tickets "populated") were captured mid-loading-spinner because the test clicked through before the data had actually arrived. The component tests all mock the API instantly, so this class of timing bug only showed up once real network/DB latency was in the loop. |
| 9 | Completion review | Audit the finished implementation against every Business Rule, Acceptance Criterion, and planned test in the contract. List anything missing, skipped, or deviating from `ui-spec.md` before calling this done. | Confirmed all 105 tests (67 backend, 22 frontend, 16 E2E/visual) pass with none skipped or disabled, and that every AC in the traceability table has real coverage - see `docs/lab-02/tests.md` section 3. |

## Reflection

Directing the agent by sprint phase (contract, then backend, then one screen per Issue) worked
better than I expected for keeping the code internally consistent - because the API contract was
fully decided in `api-spec.md` before any implementation, the frontend never had to guess a
response shape. The place I actually had to intervene was testing discipline, not application
logic: the agent's first test run had real, reproducible failures (the `resetAllMocks` bug, a
`userEvent.upload()` vs. the input's `accept` attribute mismatch, and two mistimed Playwright
screenshots), and it would have been easy to accept a summary claiming "all tests pass" without
actually reading the failure output and the generated screenshots myself. The screenshot review
in particular is the clearest case: nothing in the automated assertions caught the loading-spinner
screenshots, because the assertions were about DOM state, not about what the picture actually
showed. That is the concrete argument for the labsheet's rule of judging completion on evidence,
not on the agent's own claim.
