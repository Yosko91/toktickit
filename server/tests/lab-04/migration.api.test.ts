import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";
import { cleanupUsers, cookieFor, createTestStaff } from "../shared/auth.js";

const app = createApp();

// MIG-01 and MIG-02. Legacy tickets are the ones that existed before the first
// Lab 4 migration was applied. The before/after counts (MIG-03) and the
// rollback (MIG-04) are checked by scripts/lab-04-migration-check.ts.
describe("Lab 4 migration and backfill", () => {
  let staffId: number;
  let migratedAt: Date;

  beforeAll(async () => {
    staffId = (await createTestStaff()).id;
    const rows = await getPrisma().$queryRaw<{ finished_at: Date }[]>`
      SELECT finished_at FROM _prisma_migrations WHERE migration_name LIKE '%lab4_actions_taken' LIMIT 1`;
    migratedAt = rows[0]!.finished_at;
  });

  afterAll(async () => {
    await cleanupUsers([staffId]);
  });

  // MIG-01 - AC-21, BR-35
  it("gave every legacy resolved or closed ticket a resolvedAt, and every ticket a version", async () => {
    const prisma = getPrisma();
    const legacyResolved = await prisma.ticket.count({
      where: { createdAt: { lt: migratedAt }, currentStatus: { in: ["RESOLVED", "CLOSED"] } },
    });
    const legacyResolvedWithout = await prisma.ticket.count({
      where: { createdAt: { lt: migratedAt }, currentStatus: { in: ["RESOLVED", "CLOSED"] }, resolvedAt: null },
    });
    const withoutVersion = await prisma.ticket.count({ where: { version: { lt: 1 } } });

    expect(legacyResolved).toBeGreaterThan(0);
    expect(legacyResolvedWithout).toBe(0);
    expect(withoutVersion).toBe(0);
  });

  // MIG-02 - AC-21, BR-34
  it("still serves a legacy ticket with no actions and no history", async () => {
    const legacy = await getPrisma().ticket.findFirstOrThrow({
      where: { createdAt: { lt: migratedAt }, actionsTaken: { none: {} }, statusHistory: { none: {} } },
      include: { attachments: true, publicComments: true },
      orderBy: { id: "asc" },
    });

    const response = await request(app).get(`/api/staff/tickets/${legacy.id}`).set("Cookie", cookieFor(staffId));

    expect(response.status).toBe(200);
    expect(response.body.actionsTaken).toEqual([]);
    expect(response.body.statusHistory).toEqual([]);
    expect(response.body.ticketNumber).toBe(legacy.ticketNumber);
    expect(response.body.requesterId).toBe(legacy.requesterId);
    expect(response.body.attachments).toHaveLength(legacy.attachments.length);
    expect(response.body.publicComments).toHaveLength(legacy.publicComments.length);
  });
});
