-- Lab 4 rollback (docs/lab-04/specification.md section 7).
--
-- Drops only what the two Lab 4 migrations added, so the database goes back to
-- the Lab 3 schema with all Lab 3 data untouched. The Actions Taken and the
-- status history written since Lab 4 are lost, so take a backup first:
--
--   pg_dump -Fc -d toktickit -f before-rollback.dump
--   psql -d toktickit -f prisma/rollback/lab4_down.sql
--
-- Then check out the Lab 3 code (git checkout <lab3 tag or commit>) and run
-- npx prisma generate. Tested on a copy of the database by
-- scripts/lab-04-migration-check.ts rollback (tests.md MIG-04).

BEGIN;

DROP TABLE IF EXISTS "TicketStatusChange";
DROP TABLE IF EXISTS "ActionTaken";
DROP TYPE IF EXISTS "ActionStatus";

DROP INDEX IF EXISTS "Ticket_updatedAt_idx";
ALTER TABLE "Ticket" DROP COLUMN IF EXISTS "version";
ALTER TABLE "Ticket" DROP COLUMN IF EXISTS "resolvedAt";

-- So that prisma migrate deploy can apply Lab 4 again later.
DELETE FROM "_prisma_migrations" WHERE migration_name LIKE '%lab4%';

COMMIT;
