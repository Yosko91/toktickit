import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";
import { cleanupUsers, cookieFor, createTestRequester, createTestStaff } from "../shared/auth.js";
import { addAction, newTicket } from "./fixtures.js";

const app = createApp();

describe("Ticket workflow, resolution gate and status history", () => {
  let staffId: number;
  let otherStaffId: number;
  let requesterId: number;

  beforeAll(async () => {
    staffId = (await createTestStaff()).id;
    otherStaffId = (await createTestStaff()).id;
    requesterId = (await createTestRequester()).id;
  });

  afterAll(async () => {
    await cleanupUsers([staffId, otherStaffId, requesterId]);
  });

  const setStatus = (ticketId: number, body: Record<string, unknown>, cookie = cookieFor(staffId)) =>
    request(app).patch(`/api/staff/tickets/${ticketId}/status`).set("Cookie", cookie).send(body);
  const statusOf = async (ticketId: number) =>
    (await getPrisma().ticket.findUniqueOrThrow({ where: { id: ticketId } })).currentStatus;

  // API-20 - AC-10
  it("refuses to resolve a ticket with no completed action", async () => {
    const ticket = await newTicket(requesterId, { ownerId: staffId, currentStatus: "IN_PROGRESS" });
    await addAction(ticket.id, staffId, { status: "CANCELLED", result: null });

    const response = await setStatus(ticket.id, { currentStatus: "RESOLVED" });

    expect(response.status).toBe(409);
    expect(response.body.code).toBe("NO_COMPLETED_ACTION");
    expect(await statusOf(ticket.id)).toBe("IN_PROGRESS");
  });

  // API-21 - AC-10
  it("refuses to resolve while an action is still planned or in progress", async () => {
    const ticket = await newTicket(requesterId, { ownerId: staffId, currentStatus: "IN_PROGRESS" });
    await addAction(ticket.id, staffId);
    await addAction(ticket.id, otherStaffId, { status: "PLANNED", result: null });

    const response = await setStatus(ticket.id, { currentStatus: "RESOLVED" });

    expect(response.status).toBe(409);
    expect(response.body.code).toBe("OPEN_ACTIONS");
    expect(response.body.error).toMatch(/open actions/i);
    expect(await statusOf(ticket.id)).toBe("IN_PROGRESS");
  });

  it("still refuses to resolve a ticket with no owner (Lab 3 BR-23)", async () => {
    const ticket = await newTicket(requesterId, { currentStatus: "IN_PROGRESS" });
    await addAction(ticket.id, staffId);

    const response = await setStatus(ticket.id, { currentStatus: "RESOLVED" });

    expect(response.status).toBe(409);
    expect(response.body.code).toBe("OWNER_REQUIRED");
  });

  // API-22 - AC-11
  it("resolves a ticket whose actions are all finished, sets resolvedAt and writes one history row", async () => {
    const ticket = await newTicket(requesterId, { ownerId: staffId, currentStatus: "IN_PROGRESS" });
    await addAction(ticket.id, staffId);
    await addAction(ticket.id, staffId, { status: "CANCELLED", result: null });

    const response = await setStatus(ticket.id, { currentStatus: "RESOLVED", version: ticket.version });

    expect(response.status).toBe(200);
    expect(response.body.currentStatus).toBe("RESOLVED");
    expect(response.body.resolvedAt).toBeTruthy();
    expect(response.body.version).toBe(ticket.version + 1);

    const history = await getPrisma().ticketStatusChange.findMany({ where: { ticketId: ticket.id } });
    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({ fromStatus: "IN_PROGRESS", toStatus: "RESOLVED", changedById: staffId });
  });

  // API-23 - BR-21
  it("clears resolvedAt on Reopened and keeps it on Closed", async () => {
    const reopened = await newTicket(requesterId, { ownerId: staffId, currentStatus: "RESOLVED", resolvedAt: new Date() });
    const closed = await newTicket(requesterId, { ownerId: staffId, currentStatus: "RESOLVED", resolvedAt: new Date() });

    const reopen = await setStatus(reopened.id, { currentStatus: "REOPENED" });
    const close = await setStatus(closed.id, { currentStatus: "CLOSED" });

    expect(reopen.body.resolvedAt).toBeNull();
    expect(close.body.currentStatus).toBe("CLOSED");
    expect(close.body.resolvedAt).toBeTruthy();
  });

  // API-24 - AC-13, BR-22
  it("refuses a status, owner or priority change based on an old version", async () => {
    const ticket = await newTicket(requesterId, { ownerId: staffId, currentStatus: "NEW" });
    // Somebody else moves the ticket first.
    const first = await setStatus(ticket.id, { currentStatus: "OPEN", version: 1 }, cookieFor(otherStaffId));
    expect(first.status).toBe(200);

    const status = await setStatus(ticket.id, { currentStatus: "CANCELLED", version: 1 });
    const owner = await request(app)
      .patch(`/api/staff/tickets/${ticket.id}/owner`)
      .set("Cookie", cookieFor(staffId))
      .send({ ownerId: null, version: 1 });
    const priority = await request(app)
      .patch(`/api/staff/tickets/${ticket.id}/it-priority`)
      .set("Cookie", cookieFor(staffId))
      .send({ itPriority: "HIGH", version: 1 });

    for (const response of [status, owner, priority]) {
      expect(response.status).toBe(409);
      expect(response.body.code).toBe("STALE_UPDATE");
      expect(response.body.currentVersion).toBe(2);
    }
    const after = await getPrisma().ticket.findUniqueOrThrow({ where: { id: ticket.id } });
    expect(after).toMatchObject({ currentStatus: "OPEN", ownerId: staffId, itPriority: "MEDIUM", version: 2 });
  });

  it("lets only one of two simultaneous status changes win", async () => {
    const ticket = await newTicket(requesterId, { ownerId: staffId, currentStatus: "OPEN" });

    const [a, b] = await Promise.all([
      setStatus(ticket.id, { currentStatus: "IN_PROGRESS", version: 1 }),
      setStatus(ticket.id, { currentStatus: "CANCELLED", version: 1 }, cookieFor(otherStaffId)),
    ]);

    expect([a.status, b.status].sort()).toEqual([200, 409]);
    expect(await getPrisma().ticketStatusChange.count({ where: { ticketId: ticket.id } })).toBe(1);
  });

  // API-25 - BR-22
  it("still accepts a Lab 3 call without a version", async () => {
    const ticket = await newTicket(requesterId, { currentStatus: "NEW" });

    const response = await setStatus(ticket.id, { currentStatus: "OPEN" });

    expect(response.status).toBe(200);
    expect(response.body.version).toBe(2);
  });

  // API-26 - AC-14, BR-20
  it("keeps every change once, oldest first, with no way to edit or delete the history", async () => {
    const ticket = await newTicket(requesterId, { ownerId: staffId, currentStatus: "NEW" });
    await addAction(ticket.id, staffId);
    for (const currentStatus of ["OPEN", "IN_PROGRESS", "WAITING_FOR_REQUESTER", "RESOLVED", "REOPENED"]) {
      expect((await setStatus(ticket.id, { currentStatus })).status).toBe(200);
    }

    const detail = await request(app).get(`/api/staff/tickets/${ticket.id}`).set("Cookie", cookieFor(staffId));
    const steps = detail.body.statusHistory.map((h: { fromStatus: string; toStatus: string }) => `${h.fromStatus}>${h.toStatus}`);
    expect(steps).toEqual([
      "NEW>OPEN",
      "OPEN>IN_PROGRESS",
      "IN_PROGRESS>WAITING_FOR_REQUESTER",
      "WAITING_FOR_REQUESTER>RESOLVED",
      "RESOLVED>REOPENED",
    ]);
    expect(detail.body.statusHistory[0].changedByName).toBeTruthy();

    // The Requester sees the same history on their own ticket.
    const requesterView = await request(app).get(`/api/tickets/${ticket.id}`).set("Cookie", cookieFor(requesterId));
    expect(requesterView.body.statusHistory).toHaveLength(5);

    const historyId = detail.body.statusHistory[0].id;
    for (const method of ["patch", "delete"] as const) {
      const response = await request(app)[method](`/api/staff/tickets/${ticket.id}/history/${historyId}`)
        .set("Cookie", cookieFor(staffId))
        .send({ toStatus: "CLOSED" });
      expect(response.status).toBe(404);
    }
    expect(await getPrisma().ticketStatusChange.count({ where: { ticketId: ticket.id } })).toBe(5);
  });

  // API-27 - BR-23
  it("refuses the status endpoint to a Requester", async () => {
    const ticket = await newTicket(requesterId, { currentStatus: "NEW" });

    const response = await setStatus(ticket.id, { currentStatus: "OPEN" }, cookieFor(requesterId));

    expect(response.status).toBe(403);
    expect(await statusOf(ticket.id)).toBe("NEW");
  });

  // API-28 - BR-19
  it("treats the Requester 'appears resolved' as advice only", async () => {
    const ticket = await newTicket(requesterId, { ownerId: staffId, currentStatus: "IN_PROGRESS" });

    const advice = await request(app)
      .post(`/api/tickets/${ticket.id}/requester-resolved`)
      .set("Cookie", cookieFor(requesterId));
    expect(advice.status).toBe(200);
    expect(advice.body.currentStatus).toBe("IN_PROGRESS");

    const resolve = await setStatus(ticket.id, { currentStatus: "RESOLVED" });
    expect(resolve.body.code).toBe("NO_COMPLETED_ACTION");
  });

  // API-29 - BR-22
  it("moves the version on owner, priority and status, not on a comment", async () => {
    const ticket = await newTicket(requesterId, { currentStatus: "NEW" });
    const versionOf = async () => (await getPrisma().ticket.findUniqueOrThrow({ where: { id: ticket.id } })).version;

    await request(app).post(`/api/tickets/${ticket.id}/comments`).set("Cookie", cookieFor(requesterId)).send({ body: "Any news?" });
    expect(await versionOf()).toBe(1);

    await request(app).patch(`/api/staff/tickets/${ticket.id}/owner`).set("Cookie", cookieFor(staffId)).send({ ownerId: staffId });
    expect(await versionOf()).toBe(2);
    await request(app).patch(`/api/staff/tickets/${ticket.id}/it-priority`).set("Cookie", cookieFor(staffId)).send({ itPriority: "HIGH" });
    expect(await versionOf()).toBe(3);
    await setStatus(ticket.id, { currentStatus: "OPEN" });
    expect(await versionOf()).toBe(4);
  });

  // API-30 - FR-12, BR-25
  it("filters on the active status group in My Tickets and in the queue", async () => {
    for (const currentStatus of ["NEW", "WAITING_FOR_REQUESTER", "REOPENED", "RESOLVED", "CLOSED", "CANCELLED"] as const) {
      await newTicket(requesterId, { currentStatus, summary: "statusGroup fixture" });
    }

    const mine = await request(app).get("/api/tickets?statusGroup=active&pageSize=50").set("Cookie", cookieFor(requesterId));
    const mineStatuses = mine.body.data
      .filter((t: { summary: string }) => t.summary === "statusGroup fixture")
      .map((t: { currentStatus: string }) => t.currentStatus)
      .sort();
    expect(mineStatuses).toEqual(["NEW", "REOPENED", "WAITING_FOR_REQUESTER"]);

    // The Lab 3 statuses can now be used on their own too.
    const waiting = await request(app).get("/api/tickets?currentStatus=WAITING_FOR_REQUESTER").set("Cookie", cookieFor(requesterId));
    expect(waiting.status).toBe(200);

    const queue = await request(app)
      .get("/api/staff/tickets?statusGroup=active&search=statusGroup%20fixture&pageSize=50")
      .set("Cookie", cookieFor(staffId));
    expect(queue.body.data.every((t: { currentStatus: string }) =>
      ["NEW", "OPEN", "IN_PROGRESS", "WAITING_FOR_REQUESTER", "REOPENED"].includes(t.currentStatus)
    )).toBe(true);
    expect(queue.body.pagination.totalItems).toBe(3);

    const bad = await request(app).get("/api/staff/tickets?statusGroup=finished").set("Cookie", cookieFor(staffId));
    expect(bad.status).toBe(400);
    expect(bad.body.details.statusGroup).toBeDefined();
  });
});
