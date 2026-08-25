# Lab 2 - AI Use and Reflection

**IDE / agent used:** Claude Code (VS Code extension), driving the repository directly (spec
agent and coding agent in the same session, unlike Lab 1's separate Windsurf conversations).
**LLM used:** Claude Sonnet 5.

Lab 2 was run as one continuous engineering session rather than many isolated prompts: I gave
the agent the Lab 2 labsheet and my Lab 1 submission for context, then directed it phase by
phase (spec first, then one Issue at a time), reviewing the output of each phase before moving
to the next. The table below is the sequence of directions/prompts that actually shaped the
work, in order.

## Selected key prompts

| # | Prompt Name | Actual Prompt Text | My Reflection |
|---|-------------|--------------------|---------------|
| 1 | Continue Lab 2 from the repo | Continue the Lab 2 work in this repository. Do as much as possible so everything is complete and functional, then prepare the final submission as closely as possible to the required format. Leave clear placeholders and step-by-step instructions for anything only I can do (screenshots, GitHub UI actions). | Gave the agent room to plan the whole sprint instead of one screen at a time, which produced a more internally consistent spec than prompting screen-by-screen would have. |
| 2 | Explore before planning | (Implicit, via tool use) Inspect the existing repository, Lab 1 branches, and the Lab 1 submission PDF before writing anything. | This caught that `main` and `lab1-staging` had actually diverged by a few files, and confirmed the exact peer-review identity and repo conventions to reuse instead of guessing. |
| 3 | Resolve workflow ambiguity | (Asked back to me) How should Git/GitHub work split between agent and student, and who is the Lab 2 peer reviewer? | The agent asked instead of assuming `gh` CLI access it didn't have, and instead of guessing my reviewer stayed consistent with Lab 1. |
| 4 | Write the engineering contract first | Write `docs/lab-02/specification.md`, `tests.md`, `ui-spec.md`, and `api-spec.md` resolving every ambiguity in the labsheet (identity header, ticket number generation, ownership-failure status codes, attachment storage strategy) before touching code. | This is the step that forced concrete decisions - e.g. 404-not-403 for ownership failures, and a dedicated Postgres sequence for Ticket Numbers - that the labsheet deliberately left open. |
| 5 | Implement one Issue at a time | Implement the Development Requester schema, seed, active-Requester API, Selection screen, and Requester context for Issue 2 only. Do not start Create Ticket until this is committed and tested. | Kept each feature branch reviewable in isolation instead of one enormous diff. |
| 6 | Implement Create Ticket against the contract | Implement `POST /api/tickets` and the Create Ticket screen exactly as specified in `api-spec.md`/`ui-spec.md`, with backend-authoritative validation, the busy/success/failure states, and Ticket Number display. | <fill in after reviewing the diff: did validation match the spec table exactly on the first pass?> |
| 7 | Implement My Tickets query behavior | Implement `GET /api/tickets` with search, filters, sort, pagination exactly per `api-spec.md`, plus the My Tickets screen with its empty vs. no-results distinction. | <fill in: any query-param edge case the agent got wrong initially?> |
| 8 | Implement attachments end-to-end | Implement upload/download/soft-removal with the type/size/count limits and the 404-not-410-not-403 status rules from the spec, plus the Ticket Detail attachment panel. | <fill in: was the soft-removal reason validation correct without a follow-up correction?> |
| 9 | Write tests from the plan, not after | Implement the planned tests in `tests.md` for the current Issue before/alongside the feature, and report which Acceptance Criteria they cover. Do not report an Issue done with a failing or skipped test. | Kept the agent from claiming "done" prematurely - the completion review step below is what this discipline is checked by. |
| 10 | Completion review | Audit the finished implementation against every Business Rule, Acceptance Criterion, and planned test in the contract. List anything missing, skipped, or deviating from `ui-spec.md` before I call this done. | <fill in: what did the audit actually catch?> |

## Reflection

<Two or three sentences once you've reviewed the diffs: what made directing the agent by
sprint-phase rather than by screen work well or not, and one concrete place where you had to
correct or reject something it produced - name the file/behavior.>
