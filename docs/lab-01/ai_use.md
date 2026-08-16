# Lab 1 - AI Use and Reflection

**IDE / agent used:** Windsurf, with its integrated AI coding assistant, plus a
conversational LLM for debugging and review.
**LLM used:** <nom du modele> - thinking level <low / medium / high>.

## Selected key prompts

| # | Prompt Name | Actual Prompt Text | My Reflection |
|---|-------------|--------------------|---------------|
| 1 | Plan Lab 1 implementation | Read the enclosed TokTickIT Lab 1 requirements. Summarize the four GitHub Issues, their dependencies, required outputs, and required automated tests. Propose an implementation order, but do not write code yet. | Worked in one shot. Asking for the plan before any code made the dependency between Issue 3 and Issue 4 explicit, which I had missed on first reading. |
| 2 | Set up the full-stack project | Set up the TokTickIT tech stack as given in Lab 1: React + TypeScript + Vite + Bootstrap for the frontend, Node.js + Express + TypeScript for the backend, PostgreSQL + Prisma for the database. Use the required folder structure. Do not add functionality beyond the Lab 1 scope. | Needed several follow-ups. The agent scaffolded the server but forgot `.env.example` and did not track `.gitignore`, both of which are acceptance criteria for Issue 1. |
| 3 | Implement the health check | Add GET /api/health to the existing Express backend. It must return HTTP 200 with { status: "ok", service: "TokTickIT API" }, and a Supertest test must verify it. | Correct on the first attempt. Keeping `createApp()` separate from `app.listen()` let Supertest import the app without opening a port. |
| 4 | Fix the Prisma 7 driver adapter | The server crashes with PrismaClientInitializationError saying a driver adapter is required. Fix it using @prisma/adapter-pg, without changing the rest of the architecture. | Prisma 7 removed the bundled query engine, so `new PrismaClient()` alone no longer connects. I had to install `@prisma/adapter-pg` and `pg` and pass the adapter explicitly. |
| 5 | Create the category model and seed | Create the Prisma Category model with id, unique name and createdAt, generate a migration, and write a seed inserting Account and Access, Hardware, Software and Network that is safe to run more than once. | The idempotence requirement is what makes `upsert` the right call rather than `create`. I verified it by running the seed twice and checking the row count stayed at four. |
| 6 | Implement the category endpoint | Add GET /api/categories reading from PostgreSQL through Prisma, returning id and name in id order, with a safe 500 message on failure. | This is the prompt where I had to reject the agent's output. It generated a hard-coded array of categories instead of querying Prisma, and one of the names was wrong. |
| 7 | Build the Check System UI | Create a Bootstrap page with a [Check System] button. On click, show a loading state, call the health then the categories endpoint, and display System Status: Online with the numbered category list, or System Status: Offline with an error message. | Being explicit about the four UI states (idle, loading, success, error) produced a much cleaner component than my first vague prompt, which only asked to "display the categories". |
| 8 | Debug the blank category list | The React page renders the heading but no categories appear. Here is my Express app and the browser console. Diagnose why. | Pasting the actual source rather than describing it was decisive: the missing `cors()` middleware was invisible from a verbal description of the bug. |
| 9 | Fix the Prisma 7 config errors | I get P1012 saying the datasource url is no longer supported in schema files, then P1000 authentication failed. Explain and fix both. | Two separate Prisma 7 breaking changes. The url had to move from schema.prisma into prisma.config.ts, and my .env had been written in UTF-16 by PowerShell, so dotenv could not parse it. |
| 10 | Review the final Lab 1 work | Review the completed TokTickIT Lab 1 implementation against all acceptance criteria of the four Issues and list anything still missing. | Useful as a final checklist. It caught that the `client/` folder was not committed at all and that `docs/lab-01/` did not exist. |

## Reflection

My prompts improved most when I stopped describing my code and started pasting
it, along with the exact error text. The blank category list and the P1012 error
were both diagnosed immediately once the real files were in front of the model,
while my earlier vague descriptions produced plausible but wrong guesses.

The clearest case where I had to reject the agent's work was the
`GET /api/categories` endpoint: it returned a hard-coded array instead of
querying PostgreSQL through Prisma, and it invented a "Security" category that
does not exist in the specification. The endpoint looked correct and the page
would have displayed something, but it violated the core acceptance criterion of
Issue 4. This is exactly the kind of failure that makes reviewing generated code
non-negotiable rather than optional.
