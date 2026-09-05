import { getPrisma } from "../prisma.js";

// BR-01: TKT-{creationYear}-{6-digit sequence}. Pure formatting split out from
// the DB call so it is unit-testable without a database (UNIT-01 in tests.md).
export function formatTicketNumber(year: number, seq: number | bigint): string {
  return `TKT-${year}-${String(seq).padStart(6, "0")}`;
}

// Backed by the `ticket_number_seq` PostgreSQL sequence created in the Lab 2
// data model migration. Sequences hand out a distinct value per call even
// under concurrent requests, so this is safe without an application-level
// transaction or a read-then-increment counter.
export async function generateTicketNumber(): Promise<string> {
  const rows = await getPrisma().$queryRaw<{ nextval: bigint }[]>`SELECT nextval('ticket_number_seq') AS nextval`;
  const seq = rows[0]?.nextval;
  if (seq === undefined) {
    throw new Error("ticket_number_seq did not return a value");
  }
  return formatTicketNumber(new Date().getFullYear(), seq);
}
