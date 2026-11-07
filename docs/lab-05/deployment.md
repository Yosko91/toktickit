# Lab 5 - Deployment of TokTickIT

This file explains how TokTickIT is built, configured, tested and deployed.
Anyone in the team should be able to repeat every step with it.

## 1. Stack

We use the reference stack of the Lab 5 handout without big changes:

| Part | What we use |
|---|---|
| Web app | React 19 + Vite, built into static files |
| API | Node.js 24, Express 5, run with `tsx` (no separate compile step) |
| Database | PostgreSQL 16 with Prisma 7 (migrations in `server/prisma/migrations`) |
| Container | One image: the API also serves the built web app on port 3000 |
| Cloud | Cloud Run (service and migration job), Cloud SQL for PostgreSQL, Secret Manager, Artifact Registry |
| CI/CD | GitHub Actions |

Changes from the starter kit:

- The server runs TypeScript with `tsx` (`node --import tsx src/server.ts`), as in Labs 1 to 4, so there is no `dist/` folder.
- The seed uses one secret, `SEED_PASSWORD`, for all demo accounts (the kit used an admin password and a demo password).
- Attachment files are stored in the database (table `AttachmentContent`), not in `server/uploads/`.
  So nothing the app needs is kept only in the container (R-04).
- Sessions were already stored in the database (table `Session`) since Lab 3.

## 2. Environment variables

Every setting comes from the environment. Real values are never committed.
The placeholders are in `server/.env.example`, `client/.env.example` and `.env.example` (Docker Compose).

| Variable | Purpose | Secret? | Where the value comes from |
|---|---|---|---|
| `DATABASE_URL` | PostgreSQL connection string | Yes | Local: `server/.env`. GCP: Secret Manager `toktickit-database-url` |
| `SEED_PASSWORD` | Password of the seeded demo accounts. Required when `NODE_ENV=production` | Yes | Local: empty (dev password). GCP: Secret Manager `toktickit-seed-password` (migration job only) |
| `PORT` | Port of the API | No | Local: `3000`. Image: `ENV PORT=3000` |
| `NODE_ENV` | `development` or `production` | No | Image: `production` |
| `CLIENT_ORIGIN` | Allowed origin for CORS when UI and API are on two URLs | No | Local: `http://localhost:5173` |
| `COOKIE_SECURE` | `true` puts the Secure flag on the session cookie (HTTPS) | No | Local: `false`. Cloud Run: `true` |
| `CLIENT_DIST_DIR` | Folder of the built web app that the API serves | No | Image: `/app/client/dist` |
| `VITE_API_URL` | API base URL used by the web app at build time | No | Local: `http://localhost:3000`. Image: empty (same URL) |
| `TZ` | Time zone of the container | No | Image: `Asia/Bangkok` |

## 3. Commands (local, without Docker)

```bash
# server
cd server
cp .env.example .env            # then put your local DATABASE_URL
npm ci
npx prisma generate
npx prisma migrate deploy       # migrate
npm run prisma:seed             # seed (local dev password)
npm test                        # 225 backend tests
npm run dev                     # API on http://localhost:3000

# client
cd client
cp .env.example .env
npm ci
npm test                        # 72 frontend tests
npm run dev                     # web app on http://localhost:5173
npm run build                   # production build in client/dist
```

## 4. Docker (local)

`Dockerfile` builds one image in three stages: the web app (Vite build), the server
(`npm ci` + `prisma generate`) and a small runtime stage that runs as the `node` user.
`.dockerignore` sends only `client/` and `server/` to the build, without `node_modules`,
`.env` files, uploads or tests.

`docker-compose.yml` runs PostgreSQL, a one-shot `migrate` service (migrate + seed, same
image) and the app on http://localhost:3000.

```bash
git clone https://github.com/Yosko91/toktickit.git
cd toktickit
cp .env.example .env        # change the placeholder passwords
docker compose up --build   # db, then migrate + seed, then app
# check: http://localhost:3000/api/ready -> {"status":"ready","db":"connected"}
docker compose down         # add -v to also delete the local database volume
```

The CI job does the same from its fresh checkout on every Pull Request (step
"Fresh clone runs with .env.example values").

## 5. CI on Pull Requests

`.github/workflows/ci-docker.yml` runs on every Pull Request into `main` and into
`lab*-staging`. The job `test-and-docker` starts a throw-away PostgreSQL, then:

1. backend: `npm ci`, `prisma generate`, `prisma migrate deploy`, seed, `npm test`;
2. frontend: `npm ci`, `npm test`, `npm run build`;
3. builds the production Docker image;
4. runs the fresh clone with only the `.env.example` values (`docker compose up`) and
   checks `/api/ready`, `/` and `/api/categories`.

A failing test makes the job red. The ruleset on `main` requires this check, so a red
Pull Request cannot be merged (section 8).
