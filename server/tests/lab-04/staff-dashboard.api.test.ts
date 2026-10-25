import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";
import {
  cleanupUsers,
  cookieFor,
  createTestAdmin,
  createTestRequester,
  createTestStaff,
} from "../shared/auth.js";
import { addAction, newTicket } from "./fixtures.js";

const app = createApp();
const ACTIVE = "('NEW','OPEN','IN_PROGRESS','WAITING_FOR_REQUESTER','REOPENED')";

// The SQL below is written by hand from the calculation table in
// docs/lab-04/api-spec.md section 6, on purpose not with the Prisma code of
// the service, so a mistake there cannot hide itself (AC-16).
async function sqlCount(sql: string, ...params: unknown[]): Promise<number> {
  const rows = await getPrisma().$queryRawUnsafe<{ n: number }[]>(sql, ...params);
  return rows[0]!.n;
}

async function sqlGroup(sql: string): Promise<Map<string, number>> {
  const rows = await getPrisma().$queryRawUnsafe<{ k: string; n: number }[]>(sql);
  return new Map(rows.map((r) => [r.k, r.n]));
}

describe("IT Staff and Administrator dashboard", () => {
  let staffId: number;
  let adminId: number;
  let requesterId: number;

  beforeAll(async () => {
    staffId = (await createTestStaff()).id;
    adminId = (await createTestAdmin()).id;
    requesterId = (await createTestRequester()).id;

    // A known situation for this staff member (API-51).
    const open = await newTicket(requesterId, { ownerId: staffId, currentStatus: "OPEN", itPriority: "HIGH" });
    const inProgress = await newTicket(requesterId, { ownerId: staffId, currentStatus: "IN_PROGRESS" });
    await newTicket(requesterId, { ownerId: staffId, currentStatus: "RESOLVED", resolvedAt: new Date() });
    const cancelled = await newTicket(requesterId, { ownerId: staffId, currentStatus: "CANCELLED" });
    await newTicket(requesterId, { currentStatus: "NEW" });

    await addAction(open.id, staffId, { status: "PLANNED", result: null, description: "Visit the office" });
    await addAction(inProgress.id, staffId, { status: "IN_PROGRESS", result: null, description: "Test the cable" });
    await addAction(inProgress.id, staffId, { status: "COMPLETED" });
    // Open, but on a cancelled ticket: not work to do any more.
    await addAction(cancelled.id, staffId, { status: "PLANNED", result: null });
  });

  afterAll(async () => {
    await cleanupUsers([staffId, adminId, requesterId]);
  });

  const get = (userId: number) => request(app).get("/api/dashboard/staff").set("Cookie", cookieFor(userId));
  const metric = (body: { metrics: { key: string; value: number }[] }, key: string) =>
    body.metrics.find((m) => m.key === key)!.value;

  // API-50 - AC-16, BR-24
  it("returns the same numbers as the documented SQL queries", async () => {
    const response = await get(staffId);
    expect(response.status).toBe(200);

    expect(metric(response.body, "unassigned")).toBe(
      await sqlCount(`SELECT count(*)::int AS n FROM "Ticket" WHERE "ownerId" IS NULL AND "currentStatus" IN ${ACTIVE}`)
    );
    expect(metric(response.body, "assignedToMe")).toBe(
      await sqlCount(`SELECT count(*)::int AS n FROM "Ticket" WHERE "ownerId" = $1 AND "currentStatus" IN ${ACTIVE}`, staffId)
    );
    expect(metric(response.body, "myOpenActions")).toBe(
      await sqlCount(
        `SELECT count(*)::int AS n FROM "ActionTaken" a JOIN "Ticket" t ON t.id = a."ticketId"
         WHERE a."performedById" = $1 AND a.status IN ('PLANNED','IN_PROGRESS') AND t."currentStatus" IN ${ACTIVE}`,
        staffId
      )
    );

    const byStatus = await sqlGroup(`SELECT "currentStatus"::text AS k, count(*)::int AS n FROM "Ticket" GROUP BY 1`);
    for (const row of response.body.byStatus as { status: string; value: number }[]) {
      expect(row.value, row.status).toBe(byStatus.get(row.status) ?? 0);
    }
    const byPriority = await sqlGroup(
      `SELECT "itPriority"::text AS k, count(*)::int AS n FROM "Ticket" WHERE "currentStatus" IN ${ACTIVE} GROUP BY 1`
    );
    for (const row of response.body.byItPriority as { priority: string; value: number }[]) {
      expect(row.value, row.priority).toBe(byPriority.get(row.priority) ?? 0);
    }
  });

  // API-51 - FR-10, BR-28
  it("counts my active tickets and my open actions on active tickets only", async () => {
    const response = await get(staffId);

    expect(metric(response.body, "assignedToMe")).toBe(2);
    expect(metric(response.body, "myOpenActions")).toBe(2);
    expect(response.body.myOpenActions.map((a: { description: string }) => a.description).sort()).toEqual([
      "Test the cable",
      "Visit the office",
    ]);
    expect(response.body.myOpenActions[0].ticketNumber).toMatch(/^TKT-/);
  });

  // API-52 - AC-17, BR-29
  it("adds user counts for an Administrator only, equal to the database", async () => {
    const staff = await get(staffId);
    const admin = await get(adminId);

    expect(staff.body.userCounts).toBeUndefined();
    expect(admin.status).toBe(200);

    const byRole = await sqlGroup(`SELECT role::text AS k, count(*)::int AS n FROM "User" WHERE "isActive" GROUP BY 1`);
    expect(admin.body.userCounts).toMatchObject({
      activeRequesters: byRole.get("REQUESTER") ?? 0,
      activeItStaff: byRole.get("IT_STAFF") ?? 0,
      activeAdministrators: byRole.get("ADMINISTRATOR") ?? 0,
      inactiveUsers: await sqlCount(`SELECT count(*)::int AS n FROM "User" WHERE NOT "isActive"`),
      link: "/admin/users",
    });
  });

  // API-53 - AC-18
  it("refuses a Requester and an anonymous caller", async () => {
    const response = await get(requesterId);
    expect(response.status).toBe(403);
    expect(response.body.metrics).toBeUndefined();
    expect((await request(app).get("/api/dashboard/staff")).status).toBe(401);
  });

  // API-54 - AC-19
  it("gives links whose queue filter returns exactly the counted tickets", async () => {
    const response = await get(staffId);
    const links: { name: string; value: number; link: string }[] = [
      ...response.body.metrics
        .filter((m: { link: string }) => m.link.startsWith("/queue"))
        .map((m: { key: string; value: number; link: string }) => ({ name: m.key, value: m.value, link: m.link })),
      ...response.body.byStatus.map((r: { status: string; value: number; link: string }) => ({ name: r.status, ...r })),
      ...response.body.byItPriority.map((r: { priority: string; value: number; link: string }) => ({ name: r.priority, ...r })),
    ];
    expect(links.length).toBe(2 + 6 + 3);

    for (const item of links) {
      const query = item.link.split("?")[1];
      const queue = await request(app).get(`/api/staff/tickets?${query}`).set("Cookie", cookieFor(staffId));
      expect(queue.status, item.name).toBe(200);
      expect(queue.body.pagination.totalItems, item.name).toBe(item.value);
    }
  });

  // API-55 - BR-28, BR-32
  it("lists the oldest active High tickets as urgent, five at most", async () => {
    const response = await get(staffId);
    const expected = await getPrisma().$queryRawUnsafe<{ id: number }[]>(
      `SELECT id FROM "Ticket" WHERE "itPriority" = 'HIGH' AND "currentStatus" IN ${ACTIVE} ORDER BY "createdAt", id LIMIT 5`
    );

    expect(response.body.urgentTickets.map((t: { id: number }) => t.id)).toEqual(expected.map((r) => r.id));
    expect(response.body.recentlyUpdated.length).toBeLessThanOrEqual(5);
  });

  // PERF-01 - BR-24
  it("answers both dashboards in under 500 ms on the real database", async () => {
    const timings: number[] = [];
    for (let i = 0; i < 5; i++) {
      const start = performance.now();
      await get(adminId);
      await request(app).get("/api/dashboard/requester").set("Cookie", cookieFor(requesterId));
      timings.push((performance.now() - start) / 2);
    }
    const average = timings.reduce((a, b) => a + b, 0) / timings.length;
    console.log(`[PERF-01] dashboard average ${average.toFixed(1)} ms per call`);
    expect(average).toBeLessThan(500);
  });
});
