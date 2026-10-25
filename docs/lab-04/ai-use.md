# Lab 4 - AI Use and Reflection

**Agent used:** Claude Code, in the terminal (CLI), working directly in the repository.
**LLM used:** Claude Opus 5.5.

Like in Lab 3, the same agent was the specification agent and the coding agent. I gave it the
handout and one main message, and it did the sprint: the contract first, then six feature branches
with their tests, the Pull Requests and the merges. My prompts were in French, here they are in
English. Prompts 1 to 5 were one message that I split by subject.

## Selected key prompts

| # | Prompt Name | Actual Prompt Text | My Reflection |
|---|---|---|---|
| 1 | Do the lab from the handout | Look at this PDF, it is the instructions for the final homework. (...) If you have access to the document, do the work. | One instruction for the whole sprint. It worked because the handout is very precise, but it also means I did not decide the small things myself, the agent did. |
| 2 | Use what we already have | You are in the toktickit folder, so you have access to everything we already did, and to the GitHub of Yosko91. | This is why the Lab 4 work fits the old code: it read the Lab 3 contract and continued the same numbering, the same branch names and the same test style. |
| 3 | Tell me what I must do | Do the maximum by yourself. If I have things to do, tell me in a step by step guide, very detailed and clear, so I do not have to ask too many questions. | It kept for me only what needs a human: the review of my partner, and the screenshots of my own GitHub account. It did not invent review comments. |
| 4 | Use the lectures | I also send you some lectures if it can help. | The architecture lecture was used for one decision: no cache for the dashboards, because the simple layered design is enough until there is a real need. |
| 5 | Format of the report | Make an editable Word report following the instructions, font Aptos size 12, few bullet lists and little layout. (...) Write in English with simple vocabulary and short sentences. (...) Aim for 18/20 rather than 20/20. | The target was clear, so the report stayed short. It is my report: I read it and I am responsible for what it says. |
| 6 | Permission for GitHub | (Answer to a question of the agent before it touched GitHub) Everything, merges included. | The agent asked before pushing, because my settings say commits and pushes need my approval. I chose the fastest option, see the reflection. |

## My Reflection

The specification was written first. It was committed and merged into `lab4-staging` (PR #49)
before the first line of Lab 4 code, and the six Issues were created before coding too. This order
helped a lot. For example the API contract already said that every dashboard count has a link with
the same filter, so the agent wrote a test that uses each link as a filter and compares the
numbers. That test found a real bug from Lab 2: the My Tickets API refused the status "Waiting for
Requester", so one dashboard card would have opened an error.

What surprised me is that the agent found several old problems that nobody saw in Labs 2 and 3. The
status filter of My Tickets only had "New", the Retry button of My Tickets did nothing, and one
Lab 3 test was flaky because all the test files ran at the same time on the same database. It also
found that the seed could skip its own ticket when an older test ticket had the same summary. So the
final regression sprint was useful, it is not only a formality.

A good idea of the agent was to check the dashboard numbers against SQL written by hand, and not
against the same Prisma code. If the code is wrong, a test that uses the same code is wrong in the
same way and still passes.

The part I would change is the review. I let the agent merge the Pull Requests itself to go faster,
so my partner reviewed Pull Requests that were already merged. In a real team the review must
happen before the merge. Also, I did not read every line of the code. I trusted the tests, because
they are written from the specification and they run against the real database, but next time I
want to review at least the database migration myself before it runs, because this is the only
part that can lose data.
