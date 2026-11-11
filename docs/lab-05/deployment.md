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

## 6. Deploy scripts (from the starter kit)

| File | What it does |
|---|---|
| `deploy/deploy.sh` | One-time setup and first deploy: APIs, Artifact Registry, Cloud SQL, database user, secrets, runtime service account, migration job, Cloud Run service. Safe to run again (it reuses what exists). Preview with `DRY_RUN=1`. |
| `deploy/release.sh` | Used by `deploy.yml`: checks that the image exists, reads its digest, runs the migration job, updates the service by digest. |
| `deploy/smoke_test.py` | Read-only checks of the live URL: `/api/health`, `/api/ready` (database), `/` (HTML), `/api/categories` (seeded data). |
| `deploy/teardown.sh` | Deletes the cloud resources at the end of the course. |
| `deploy/tests/` | Offline tests of the three scripts (fake `gcloud`, no GCP access). CI runs them. |

Our changes to the kit: one seed secret `toktickit-seed-password` instead of the admin and demo
passwords (no `--demo` flag), `COOKIE_SECURE=true` on the service, Cloud SQL storage
auto-increase off and no automatic backups (cost). `.gitattributes` keeps `*.sh` files with LF
line endings, so they also run when the repository is cloned on Windows.

## 7. GCP project and resources

One project is used for Lab 5, Lab 6, Lab 7 and the Final Project. Heloise created it with her
GCP Free Trial account (USD 300 credit, never upgraded) and added Yohann in IAM with the Editor
role. The first setup was done in a project on Yohann's account (`cpe334-toktickit-ym`); it was
moved here because that account had almost no credit left, and the old project was deleted.

| Item | Name |
|---|---|
| Project ID | `toktickit-heloise` (number 808244962064) |
| Region | `asia-southeast1` (Singapore) |
| Billing | Heloise's Free Trial billing account (credit only, no paid upgrade) |
| Artifact Registry | repository `toktickit`, image `asia-southeast1-docker.pkg.dev/toktickit-heloise/toktickit/toktickit` |
| Cloud SQL | instance `toktickit-pg` (PostgreSQL 16, `db-f1-micro`, 10 GB SSD, auto-increase off), database `toktickit`, user `toktickit` |
| Secret Manager | `toktickit-database-url`, `toktickit-seed-password` |
| Cloud Run service | `toktickit` (min 0, max 3 instances, 512 MiB, port 3000, public) |
| Cloud Run job | `toktickit-migrate` (`prisma migrate deploy` + seed) |
| Runtime service account | `toktickit-runner` (Cloud SQL client, reads only our two secrets) |
| Deployer service account | `toktickit-deployer` (Cloud Run developer, Artifact Registry writer on `toktickit`, can act as `toktickit-runner`) |
| Workload Identity Federation | pool `github-actions`, provider `github-main` |
| GitHub environment | `demo` (only `main` can deploy), variables `GCP_PROJECT_ID`, `GCP_REGION`, `WIF_PROVIDER`, `WIF_SERVICE_ACCOUNT` |

The provider `github-main` only accepts a GitHub token when all of these are true: repository id
1332659613, owner id 198549427, ref `refs/heads/main`, workflow `deploy.yml` and subject
`repo:Yosko91@198549427/toktickit@1332659613:environment:demo`. So a Pull Request or a fork cannot
deploy. There is no service account key anywhere.

First deploy (done once, from a clean clone, with an account that owns the project):

```bash
gcloud config set project toktickit-heloise
DRY_RUN=1 PROJECT_ID=toktickit-heloise bash deploy/deploy.sh   # read the commands first
PROJECT_ID=toktickit-heloise bash deploy/deploy.sh
```

## 8. Merge gate on main

Ruleset `main - Lab 5 merge gate` (Settings > Rules > Rulesets), enforcement Active, empty bypass
list:

- require a Pull Request with 1 approval (the author cannot approve their own Pull Request);
- require the status check `test-and-docker` to pass, and the branch to be up to date;
- block force pushes and deletion of `main`.

Proof: Pull Request #69 from the temporary branch `temp/lab5-failing-check` has one failing test,
the check is red and GitHub does not allow the merge. It is closed without merging.

## 9. Release procedure

Only `main` deploys, so every merge into `main` is a release.

1. Create an Issue with the label `lab5` (later labs: their own label) and add it to the board.
2. Create a branch `feature/...` from `lab5-staging`, commit, push, open a Pull Request into
   `lab5-staging`. CI runs. The teammate reviews with a specific comment and approves. Merge.
3. Open the release Pull Request `lab5-staging` into `main`. CI runs again. The teammate approves.
   Merge (merge commit).
4. The merge starts `.github/workflows/deploy.yml` (Actions > Deploy demo):
   CI again, then `docker build --build-arg COMMIT_SHA=<full SHA>` and push with the tag = full
   commit SHA, `deploy/release.sh` (image digest, migration job, Cloud Run update by digest),
   smoke test, and the check that `/api/version` returns the same SHA.
5. Check the result.

How to find the commit that is running:

- in the browser: the footer of every page shows `TokTickIT release <short SHA>`;
- `curl https://<service URL>/api/version` returns the full SHA;
- the Summary of the Deploy demo run shows the image tag (SHA) and the digest;
- `gcloud run services describe toktickit --region asia-southeast1 --format="value(status.latestReadyRevisionName,spec.template.spec.containers[0].image)"`
  gives the revision and the image digest, and
  `gcloud artifacts docker images list asia-southeast1-docker.pkg.dev/toktickit-heloise/toktickit/toktickit --include-tags`
  links this digest to the SHA tag.

## 10. Rollback

Actions > Deploy demo > Run workflow on `main`, and enter in `image_tag` the full 40-character SHA
of an earlier release. Tests, build and migration are skipped, the old image is deployed by
digest and the smoke test runs. To come back, run it again with the SHA of the newer release.
The database is not rolled back, so migrations must stay additive (the Lab 5 migration only adds
the table `AttachmentContent`).

## 11. Cost

Cloud SQL is paid for every hour it exists (about 10 to 15 USD a month for `db-f1-micro`).
Cloud Run scales to zero when nobody uses it. Ways to keep the cost low:

```bash
# pause the database when nobody needs the app (the app is down while paused)
gcloud sql instances patch toktickit-pg --activation-policy=NEVER
# start it again
gcloud sql instances patch toktickit-pg --activation-policy=ALWAYS
# at the end of the course: delete everything
DRY_RUN=1 PROJECT_ID=toktickit-heloise bash deploy/teardown.sh
PROJECT_ID=toktickit-heloise bash deploy/teardown.sh
```
