import "dotenv/config";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import pg from "pg";

// Lab 4 migration evidence (docs/lab-04/tests.md MIG-03 and MIG-04).
//
//   npx tsx scripts/lab-04-migration-check.ts snapshot <file>     save counts and checksums
//   npx tsx scripts/lab-04-migration-check.ts compare <a> <b>     compare two snapshots
//   npx tsx scripts/lab-04-migration-check.ts rollback            test the rollback on a copy
//
// The checksums only use columns that existed before Lab 4, so a snapshot taken
// before the migration can be compared with one taken after it.

const QUERIES: Record<string, string> = {
  User: `SELECT count(*)::int AS n, md5(coalesce(string_agg(id || '|' || email || '|' || role || '|' || "isActive", ',' ORDER BY id), '')) AS sum FROM "User"`,
  Ticket: `SELECT count(*)::int AS n, md5(coalesce(string_agg(id || '|' || "ticketNumber" || '|' || "requesterId" || '|' || coalesce("ownerId", 0) || '|' || "currentStatus" || '|' || "itPriority" || '|' || "createdAt", ',' ORDER BY id), '')) AS sum FROM "Ticket"`,
  Attachment: `SELECT count(*)::int AS n, md5(coalesce(string_agg(id || '|' || "ticketId" || '|' || "originalName" || '|' || coalesce("removedAt"::text, ''), ',' ORDER BY id), '')) AS sum FROM "Attachment"`,
  PublicComment: `SELECT count(*)::int AS n, md5(coalesce(string_agg(id || '|' || "ticketId" || '|' || body, ',' ORDER BY id), '')) AS sum FROM "PublicComment"`,
  InternalNote: `SELECT count(*)::int AS n, md5(coalesce(string_agg(id || '|' || "ticketId" || '|' || body, ',' ORDER BY id), '')) AS sum FROM "InternalNote"`,
};

type Snapshot = Record<string, { n: number; sum: string }>;

async function snapshot(connectionString: string): Promise<Snapshot> {
  const client = new pg.Client({ connectionString });
  await client.connect();
  try {
    const result: Snapshot = {};
    for (const [table, sql] of Object.entries(QUERIES)) {
      const { rows } = await client.query(sql);
      result[table] = { n: rows[0].n, sum: rows[0].sum };
    }
    return result;
  } finally {
    await client.end();
  }
}

function compare(a: Snapshot, b: Snapshot): boolean {
  let same = true;
  for (const table of Object.keys(QUERIES)) {
    const ok = a[table].n === b[table].n && a[table].sum === b[table].sum;
    same &&= ok;
    console.log(
      `${table.padEnd(14)} ${String(a[table].n).padStart(5)} -> ${String(b[table].n).padStart(5)}  ${ok ? "same" : "DIFFERENT"}`
    );
  }
  return same;
}

function withDatabase(url: string, name: string): string {
  const parsed = new URL(url);
  parsed.pathname = `/${name}`;
  return parsed.toString();
}

async function rollbackTest() {
  const url = process.env.DATABASE_URL!;
  const source = new URL(url).pathname.slice(1);
  const copy = `${source}_rollback_check`;
  const admin = new pg.Client({ connectionString: withDatabase(url, "postgres") });
  await admin.connect();

  try {
    await admin.query(`DROP DATABASE IF EXISTS "${copy}"`);
    // TEMPLATE copies the whole database, data included. It needs no other
    // session on the source, so the dev server must be stopped first.
    await admin.query(`CREATE DATABASE "${copy}" TEMPLATE "${source}"`);
    console.log(`Copied ${source} to ${copy}`);

    // The Lab 3 data of the copy just before the rollback is the reference.
    const before = await snapshot(withDatabase(url, copy));

    const here = dirname(fileURLToPath(import.meta.url));
    const downSql = readFileSync(join(here, "..", "prisma", "rollback", "lab4_down.sql"), "utf8");
    const target = new pg.Client({ connectionString: withDatabase(url, copy) });
    await target.connect();
    try {
      await target.query(downSql);
      const leftovers = await target.query(
        `SELECT table_name FROM information_schema.tables WHERE table_name IN ('ActionTaken', 'TicketStatusChange')
         UNION ALL SELECT column_name FROM information_schema.columns WHERE table_name = 'Ticket' AND column_name IN ('version', 'resolvedAt')
         UNION ALL SELECT migration_name FROM _prisma_migrations WHERE migration_name LIKE '%lab4%'`
      );
      console.log(`Lab 4 objects left after rollback: ${leftovers.rowCount}`);
      if (leftovers.rowCount !== 0) throw new Error("rollback left Lab 4 objects behind");
    } finally {
      await target.end();
    }

    const after = await snapshot(withDatabase(url, copy));
    console.log("Lab 3 data before vs after the rollback:");
    if (!compare(before, after)) throw new Error("data differs after rollback");
    console.log("Rollback OK");
  } finally {
    await admin.query(`DROP DATABASE IF EXISTS "${copy}"`);
    console.log(`Dropped ${copy}`);
    await admin.end();
  }
}

async function main() {
  const [command, a, b] = process.argv.slice(2);
  if (command === "snapshot" && a) {
    const snap = await snapshot(process.env.DATABASE_URL!);
    writeFileSync(a, JSON.stringify(snap, null, 2));
    for (const [table, value] of Object.entries(snap)) {
      console.log(`${table.padEnd(14)} ${String(value.n).padStart(5)}  ${value.sum}`);
    }
  } else if (command === "compare" && a && b) {
    const same = compare(JSON.parse(readFileSync(a, "utf8")), JSON.parse(readFileSync(b, "utf8")));
    console.log(same ? "No data lost or changed" : "Data changed");
    process.exitCode = same ? 0 : 1;
  } else if (command === "rollback") {
    await rollbackTest();
  } else {
    console.log("usage: snapshot <file> | compare <a> <b> | rollback");
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
