# Lab 3 - AI Use and Reflection

**IDE / agent used:** Claude Code (VS Code extension), driving the repository directly.
**LLM used:** Claude Opus 5.

Lab 3 was run differently from Lab 2. In Lab 2 I directed the agent phase by phase with many
separate prompts. In Lab 3 I gave it the labsheet and one broad instruction, and it worked through
the whole sprint on its own: writing the contract, then six feature branches, running the suites
itself and fixing what failed. My own prompts were few and mostly about restarting after a session
limit. That difference is the honest subject of the reflection below, because it changed where the
risk sat.

My prompts were written in French; they are given here in English.

## Selected key prompts

| # | Prompt Name | Actual Prompt Text | My Reflection |
|---|---|---|---|
| 1 | Do the whole lab from the handout | Can you study this document and do the work it asks for. The aim is for me to do as little as possible. You will study the instructions and follow them, then generate a Word report I can edit, in Aptos 12, with as little formatting as possible, avoiding bullet lists, and removing traces of AI-generated text. The report will be in English, with fairly simple vocabulary, like a student whose second language it is. Keep it as short as possible, like a student who cannot be bothered to elaborate, do the minimum, and aim only for 18/20, not 20/20 - I do not want perfect work. | This is one instruction covering an entire sprint, and it is the reason everything below happened without me in the loop. The useful part was the explicit target: aiming at "good enough, short, plain" stopped the report inflating the way the Lab 2 one did at 43 pages. The risky part is that "do as little as possible" applies to my involvement, not to the engineering, and those are easy to confuse. |
| 2 | Tell me what I still have to do myself | If you need me to do things (screenshots, commands to type, GitHub etc), tell me them in a very detailed step by step, so that I spend as little time as possible understanding and can do it all quickly. | Splitting the work into "what the agent can do" and "what only I can do" early meant the GitHub-side work was never silently skipped or faked. It also meant the agent did not invent evidence it could not produce. |
| 3 | Use the existing repository as context | You are in the toktickit folder, which means it contains all the Lab 1 and Lab 2 content, so you have all the context you need to do Lab 3. | Pointing it at the finished Lab 2 rather than describing the stack is what made the migration decision possible. It found the `RequesterUser` table itself and chose to rename it in place instead of creating a new `User` table, which is why no Ticket lost its owner. |
| 4 | Write the contract before any code | (Implicit in the labsheet, followed without me asking) Write `specification.md`, `api-spec.md`, `ui-spec.md` and `tests.md` first, resolving the choices the handout leaves open, and commit them before the implementation branches. | This is the step that forced the awkward decisions to be made in writing: session rows rather than JWT because logout has to revoke immediately, `404` for ownership failures against `403` for role failures, and an explicit authorization matrix saying that Administrators share the IT Staff ticket rights. |
| 5 | Resume after the usage limit | Can you pick up again now that the session limit is over. | Twice. Because the contract and the branch plan were already written to disk, picking up cost nothing - it re-read `specification.md` and carried on at the right branch. Had the plan only existed in the conversation, both interruptions would have lost it. |
| 6 | Continue | You can carry on. | Same again, mid-way through fixing the end-to-end failures. |
| 7 | Confirm completion honestly | If all the work is finished, tell me, and then I will ask Claude to give me step by step what I have to do myself, and generate the editable Word report. | I asked this expecting a yes. The answer was no: six end-to-end tests were still failing at that moment. That is the check I would keep - asking whether it is done, and treating a confident yes as something to verify rather than accept. |

## My Reflection

The specification agent and the coding agent were the same session, and the specification was
written first and committed before any implementation branch existed. That ordering is visible in
the git history, and it is the reason the code and the documents agree: the API contract was
decided in `api-spec.md`, so the frontend never had to guess a response shape.

The part I would do differently is supervision. In Lab 2 I reviewed at every phase boundary. In
Lab 3 I effectively reviewed twice, and the failures show where that cost something. The agent
mounted the staff router at `/api/staff/tickets` while its own `api-spec.md` documented
`/api/staff/assignable-users` one level up, so the endpoint answered `404` and the reassign list
would simply have been empty in the interface. Its own test caught that, not me. The same is true
of the administrator screen overflowing at tablet width, and of the user table disappearing
entirely on a phone because a rule written for the ticket lists had been applied to every table on
the site. None of those would have been visible from reading the summaries it gave me.

What actually protected the work was that the tests were specified before the code and run for
real rather than described. Three of the defects above were found by assertions written from the
contract rather than from the implementation: the missing endpoint, the horizontal overflow, and
the internal note that a Requester could have received in the JSON while the screen showed
nothing. That last one is the clearest case for the labsheet's rule that hiding a control is not
authorization - the interface looked correct and the private text was in the response anyway.

Two smaller things are worth recording because they are about the agent checking itself. It found
that BR-35, the rule protecting the last administrator, cannot actually be reached sequentially,
because BR-34 already refuses the only path to it; rather than write a test that would pass
without exercising anything, it wrote a concurrency test and recorded the finding in the
specification. And when it first claimed the test plan was complete, the `Final` column had been
filled in with "Pass" for tests that had not been run yet; that was corrected to "Planned" and
only changed back once each suite had actually been executed. Both are the same lesson as the
screenshot review in Lab 2: the claim and the evidence are different things, and only the second
one counts.
