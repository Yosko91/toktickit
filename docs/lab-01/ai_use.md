# Lab 1 - AI Use and Reflection

**IDE / agent used:** Windsurf, with its integrated AI coding assistant.
**LLM used:** Claude - thinking level high.

## Selected key prompts

| # | Prompt Name | Actual Prompt Text | My Reflection |
|---|-------------|--------------------|---------------|
| 1 | Plan Lab 1 implementation | Read the TokTickIT Lab 1 requirements. Summarize the four GitHub Issues, their dependencies, required outputs, and required automated tests. Propose an implementation order, but do not write code yet. | <did it work in one shot?> |
| 2 | Set up full-stack project | Set up the TokTickIT tech stack: React + TypeScript + Vite + Bootstrap for the frontend, Node.js + Express + TypeScript for the backend, PostgreSQL + Prisma for the database. Use the required folder structure. Do not add functionality beyond Lab 1 scope. | <what you had to correct> |
| 3 | Implement health check | Add GET /api/health to the Express backend. It must return HTTP 200 with { status: "ok", service: "TokTickIT API" }, and a Supertest test must verify it. | <...> |
| 4 | Create category model and seed | Create the Prisma Category model with id, unique name and createdAt, generate a migration, and write an idempotent seed inserting Account and Access, Hardware, Software, Network. | <...> |
| 5 | Fix Prisma 7 driver adapter | The server crashes with PrismaClientInitializationError saying a driver adapter is required. Fix it using @prisma/adapter-pg without changing the rest of the architecture. | <...> |
| 6 | Implement category endpoint | Add GET /api/categories reading from PostgreSQL through Prisma, returning id and name in id order, with a safe 500 on failure. | <...> |
| 7 | Build the Check System UI | Create a Bootstrap page with a [Check System] button. On click, show a loading state, call the health and categories endpoints, then show System Status: Online with the numbered category list, or System Status: Offline with an error message. | <...> |
| 8 | Debug the blank category list | The React page renders the heading but no categories. Diagnose why, given the Express app and the browser console. | <...> |
| 9 | Write the UI tests | Write Vitest tests verifying the heading renders, the loading state becomes the category list, and an API failure shows the error message. Mock the api module. | <...> |
| 10 | Review final Lab 1 work | Review the completed TokTickIT Lab 1 implementation against all acceptance criteria of the four Issues and list anything missing. | <...> |

## Reflection

<Two or three sentences. What made your prompts better (constraints, exact
expected output, pasting the real error text)? Give one concrete place where you
had to correct or reject what the agent produced - for example the hard-coded
category list the agent generated instead of querying Prisma, or the missing
CORS middleware.>
