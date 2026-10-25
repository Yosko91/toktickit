import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { randomUUID } from "node:crypto";
import { createApp } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";
import {
  cleanupUsers,
  cookieFor,
  createTestAdmin,
  createTestRequester,
  createTestStaff,
} from "../shared/auth.js";
import { actionBody, addAction, newTicket } from "./fixtures.js";

const app = createApp();

describe("Actions Taken API", () => {
  let staffId: number;
  let colleagueId: number;
  let inactiveStaffId: number;
  let adminId: number;
  let requesterId: number;
  let otherRequesterId: number;

  beforeAll(async () => {
    staffId = (await createTestStaff()).id;
    colleagueId = (await createTestStaff()).id;
    inactiveStaffId = (await createTestStaff({ isActive: false })).id;
    adminId = (await createTestAdmin()).id;
    requesterId = (await createTestRequester()).id;
    otherRequesterId = (await createTestRequester()).id;
  });

  afterAll(async () => {
    await cleanupUsers([staffId, colleagueId, inactiveStaffId, adminId, requesterId, otherRequesterId]);
  });

  const asStaff = () => cookieFor(staffId);
  const post = (ticketId: number, body: Record<string, unknown>, cookie = asStaff()) =>
    request(app).post(`/api/staff/tickets/${ticketId}/actions`).set("Cookie", cookie).send(body);
  const patch = (ticketId: number, actionId: number, body: Record<string, unknown>, cookie = asStaff()) =>
    request(app)
      .patch(`/api/staff/tickets/${ticketId}/actions/${actionId}`)
      .set("Cookie", cookie)
      .send(body);
  const countActions = (ticketId: number) => getPrisma().actionTaken.count({ where: { ticketId } });

  // API-01 - AC-01
  it("creates an action under the right ticket, recorded and performed by the session user", async () => {
    const ticket = await newTicket(requesterId, { ownerId: staffId, currentStatus: "IN_PROGRESS" });

    const response = await post(ticket.id, actionBody());

    expect(response.status).toBe(201);
    expect(response.body.ticketId).toBe(ticket.id);
    expect(response.body.createdById).toBe(staffId);
    expect(response.body.performedById).toBe(staffId);
    expect(response.body.performedByName).toBeTruthy();
    expect(response.body.status).toBe("COMPLETED");
    expect(response.body.version).toBe(1);

    const stored = await getPrisma().actionTaken.findUniqueOrThrow({ where: { id: response.body.id } });
    expect(stored.ticketId).toBe(ticket.id);
  });

  // API-02 - AC-03, BR-02
  it("records an action performed by a colleague who is not the owner", async () => {
    const ticket = await newTicket(requesterId, { ownerId: staffId });

    const response = await post(ticket.id, actionBody({ performedById: colleagueId }));

    expect(response.status).toBe(201);
    expect(response.body.performedById).toBe(colleagueId);
    expect(response.body.createdById).toBe(staffId);
    // The ticket owner did not move: the colleague only did one part of the work.
    expect((await getPrisma().ticket.findUniqueOrThrow({ where: { id: ticket.id } })).ownerId).toBe(staffId);
  });

  // API-03 - AC-04
  it("refuses an inactive staff member as performer and saves nothing", async () => {
    const ticket = await newTicket(requesterId);

    const response = await post(ticket.id, actionBody({ performedById: inactiveStaffId }));

    expect(response.status).toBe(422);
    expect(response.body.details.performedById).toBeDefined();
    expect(await countActions(ticket.id)).toBe(0);
  });

  // API-04 - AC-04
  it("refuses a Requester as performer and saves nothing", async () => {
    const ticket = await newTicket(requesterId);

    const response = await post(ticket.id, actionBody({ performedById: requesterId }));

    expect(response.status).toBe(422);
    expect(await countActions(ticket.id)).toBe(0);
  });

  // API-05 - AC-05
  it("requires a follow-up note when a follow-up is needed", async () => {
    const ticket = await newTicket(requesterId);

    const response = await post(ticket.id, actionBody({ followUpRequired: true, followUpNote: "  " }));

    expect(response.status).toBe(400);
    expect(response.body.details.followUpNote).toBeDefined();
    expect(await countActions(ticket.id)).toBe(0);
  });

  // API-06 - AC-06
  it("refuses a completed action without result, a future date, and a date before the ticket", async () => {
    const ticket = await newTicket(requesterId);
    const tomorrow = new Date(Date.now() + 24 * 3600 * 1000).toISOString();

    const noResult = await post(ticket.id, actionBody({ result: "" }));
    expect(noResult.status).toBe(400);
    expect(noResult.body.details.result).toBeDefined();

    const future = await post(ticket.id, actionBody({ actionAt: tomorrow }));
    expect(future.status).toBe(400);
    expect(future.body.details.actionAt).toBeDefined();

    const beforeTicket = await post(
      ticket.id,
      actionBody({ actionAt: new Date(ticket.createdAt.getTime() - 3600 * 1000).toISOString() })
    );
    expect(beforeTicket.status).toBe(400);

    // A planned action is allowed in the future and without a result.
    const planned = await post(ticket.id, actionBody({ actionAt: tomorrow, status: "PLANNED", result: null }));
    expect(planned.status).toBe(201);
    expect(await countActions(ticket.id)).toBe(1);
  });

  // API-07 - AC-07, BR-10
  it("moves a planned action to in progress, then completed, then keeps it read only", async () => {
    const ticket = await newTicket(requesterId, { currentStatus: "OPEN" });
    const created = await post(ticket.id, actionBody({ status: "PLANNED", result: null }));
    expect(created.status).toBe(201);
    const id = created.body.id;

    const started = await patch(ticket.id, id, { version: 1, status: "IN_PROGRESS" });
    expect(started.status).toBe(200);
    expect(started.body.status).toBe("IN_PROGRESS");
    expect(started.body.version).toBe(2);

    // Completing without a result is refused: the rules apply to the merged action.
    const noResult = await patch(ticket.id, id, { version: 2, status: "COMPLETED", result: null });
    expect(noResult.status).toBe(400);

    const completed = await patch(ticket.id, id, { version: 2, status: "COMPLETED", result: "Done" });
    expect(completed.status).toBe(200);
    expect(completed.body.version).toBe(3);

    const again = await patch(ticket.id, id, { version: 3, description: "Changed afterwards" });
    expect(again.status).toBe(409);
    expect(again.body.code).toBe("ACTION_READ_ONLY");
  });

  // API-08 - AC-08, BR-13
  it("refuses an edit based on an old version and keeps the stored action", async () => {
    const ticket = await newTicket(requesterId);
    const action = await addAction(ticket.id, staffId, { status: "PLANNED", result: null });

    const first = await patch(ticket.id, action.id, { version: 1, description: "First edit" }, cookieFor(colleagueId));
    expect(first.status).toBe(200);

    const stale = await patch(ticket.id, action.id, { version: 1, description: "Second edit" });
    expect(stale.status).toBe(409);
    expect(stale.body.code).toBe("STALE_UPDATE");
    expect(stale.body.currentVersion).toBe(2);

    const stored = await getPrisma().actionTaken.findUniqueOrThrow({ where: { id: action.id } });
    expect(stored.description).toBe("First edit");
  });

  it("requires the version on an edit", async () => {
    const ticket = await newTicket(requesterId);
    const action = await addAction(ticket.id, staffId, { status: "PLANNED", result: null });

    const response = await patch(ticket.id, action.id, { description: "No version" });

    expect(response.status).toBe(400);
    expect(response.body.details.version).toBeDefined();
  });

  // API-09 - BR-08
  it("refuses an illegal status move and a cancelled action at creation", async () => {
    const ticket = await newTicket(requesterId);
    const action = await addAction(ticket.id, staffId, { status: "IN_PROGRESS", result: null });

    const back = await patch(ticket.id, action.id, { version: 1, status: "PLANNED" });
    expect(back.status).toBe(409);
    expect(back.body.code).toBe("INVALID_TRANSITION");

    const cancelledAtCreation = await post(ticket.id, actionBody({ status: "CANCELLED" }));
    expect(cancelledAtCreation.status).toBe(400);
    expect(cancelledAtCreation.body.details.status).toBeDefined();
  });

  it("cancels an open action, which then becomes read only", async () => {
    const ticket = await newTicket(requesterId);
    const action = await addAction(ticket.id, staffId, { status: "PLANNED", result: null });

    const cancelled = await patch(ticket.id, action.id, { version: 1, status: "CANCELLED" });
    expect(cancelled.status).toBe(200);

    const edit = await patch(ticket.id, action.id, { version: 2, description: "Too late" });
    expect(edit.body.code).toBe("ACTION_READ_ONLY");
  });

  it("reassigns an open action to a colleague, and refuses an inactive one", async () => {
    const ticket = await newTicket(requesterId);
    const action = await addAction(ticket.id, staffId, { status: "PLANNED", result: null });

    const reassigned = await patch(ticket.id, action.id, { version: 1, performedById: colleagueId });
    expect(reassigned.status).toBe(200);
    expect(reassigned.body.performedById).toBe(colleagueId);
    expect(reassigned.body.createdById).toBe(staffId);

    const inactive = await patch(ticket.id, action.id, { version: 2, performedById: inactiveStaffId });
    expect(inactive.status).toBe(422);
  });

  it("lets an Administrator record an action (BR-16 of Lab 3)", async () => {
    const ticket = await newTicket(requesterId);

    const response = await post(ticket.id, actionBody(), cookieFor(adminId));

    expect(response.status).toBe(201);
    expect(response.body.createdById).toBe(adminId);
  });

  // API-10 - AC-09, BR-03
  it("refuses create and edit from a Requester, even on their own ticket", async () => {
    const ticket = await newTicket(requesterId);
    const action = await addAction(ticket.id, staffId, { status: "PLANNED", result: null });

    const created = await post(ticket.id, actionBody(), cookieFor(requesterId));
    expect(created.status).toBe(403);

    const edited = await patch(ticket.id, action.id, { version: 1, description: "x" }, cookieFor(requesterId));
    expect(edited.status).toBe(403);

    expect(await countActions(ticket.id)).toBe(1);
    expect((await getPrisma().actionTaken.findUniqueOrThrow({ where: { id: action.id } })).version).toBe(1);
  });

  // API-11 - FR-05, BR-03
  it("shows the Requester the actions of their own ticket, and hides other tickets", async () => {
    const ticket = await newTicket(requesterId);
    await addAction(ticket.id, staffId, { description: "Visible to the requester" });

    const own = await request(app).get(`/api/tickets/${ticket.id}`).set("Cookie", cookieFor(requesterId));
    expect(own.status).toBe(200);
    expect(own.body.actionsTaken).toHaveLength(1);
    expect(own.body.actionsTaken[0].description).toBe("Visible to the requester");
    // Lab 3 BR-26 still holds: the Requester view has no internal notes at all.
    expect(own.body.internalNotes).toBeUndefined();

    const other = await request(app).get(`/api/tickets/${ticket.id}`).set("Cookie", cookieFor(otherRequesterId));
    expect(other.status).toBe(404);
    expect(other.body.actionsTaken).toBeUndefined();
  });

  // API-12 - AC-12, BR-11
  it("refuses new work on a resolved, closed or cancelled ticket", async () => {
    for (const currentStatus of ["RESOLVED", "CLOSED", "CANCELLED"] as const) {
      const ticket = await newTicket(requesterId, { currentStatus, ownerId: staffId });
      const response = await post(ticket.id, actionBody());
      expect(response.status, currentStatus).toBe(409);
      expect(response.body.code).toBe("TICKET_NOT_WORKABLE");
    }

    const ticket = await newTicket(requesterId);
    const action = await addAction(ticket.id, staffId, { status: "PLANNED", result: null });
    await getPrisma().ticket.update({ where: { id: ticket.id }, data: { currentStatus: "CANCELLED" } });
    const edit = await patch(ticket.id, action.id, { version: 1, description: "x" });
    expect(edit.body.code).toBe("TICKET_NOT_WORKABLE");
  });

  // API-13 - AC-15, BR-14
  it("does not create a duplicate when the same request is sent twice", async () => {
    const ticket = await newTicket(requesterId);
    const clientRequestId = randomUUID();

    const first = await post(ticket.id, actionBody({ clientRequestId }));
    const second = await post(ticket.id, actionBody({ clientRequestId }));

    expect(first.status).toBe(201);
    expect(second.status).toBe(200);
    expect(second.body.id).toBe(first.body.id);
    expect(await countActions(ticket.id)).toBe(1);
  });

  it("does not create a duplicate when the two requests arrive at the same time", async () => {
    const ticket = await newTicket(requesterId);
    const clientRequestId = randomUUID();

    const responses = await Promise.all([
      post(ticket.id, actionBody({ clientRequestId })),
      post(ticket.id, actionBody({ clientRequestId })),
    ]);

    expect(responses.map((r) => r.status).sort()).toEqual([200, 201]);
    expect(await countActions(ticket.id)).toBe(1);
  });

  // API-14 - BR-10
  it("never deletes an action", async () => {
    const ticket = await newTicket(requesterId);
    const action = await addAction(ticket.id, staffId);

    const response = await request(app)
      .delete(`/api/staff/tickets/${ticket.id}/actions/${action.id}`)
      .set("Cookie", asStaff());

    expect(response.status).toBe(405);
    expect(await countActions(ticket.id)).toBe(1);
  });

  // API-15 - BR-01
  it("does not find an action through another ticket id", async () => {
    const ticket = await newTicket(requesterId);
    const otherTicket = await newTicket(requesterId);
    const action = await addAction(ticket.id, staffId, { status: "PLANNED", result: null });

    const response = await patch(otherTicket.id, action.id, { version: 1, description: "Moved?" });

    expect(response.status).toBe(404);
    expect((await getPrisma().actionTaken.findUniqueOrThrow({ where: { id: action.id } })).ticketId).toBe(ticket.id);
  });

  // API-16 - BR-15
  it("lists the actions by action date, then by id", async () => {
    const ticket = await newTicket(requesterId);
    const sameTime = new Date();
    const late = await addAction(ticket.id, staffId, { actionAt: new Date(sameTime.getTime() + 1000), description: "late" });
    const firstAtTime = await addAction(ticket.id, staffId, { actionAt: sameTime, description: "same-1" });
    const secondAtTime = await addAction(ticket.id, staffId, { actionAt: sameTime, description: "same-2" });
    const early = await addAction(ticket.id, staffId, { actionAt: new Date(sameTime.getTime() - 1000), description: "early" });

    const response = await request(app).get(`/api/staff/tickets/${ticket.id}`).set("Cookie", asStaff());

    expect(response.body.actionsTaken.map((a: { id: number }) => a.id)).toEqual([
      early.id,
      firstAtTime.id,
      secondAtTime.id,
      late.id,
    ]);
  });

  // API-17 - BR-12
  it("moves the ticket updatedAt but not its version or status", async () => {
    const ticket = await newTicket(requesterId, { currentStatus: "OPEN" });
    await new Promise((r) => setTimeout(r, 20));

    await post(ticket.id, actionBody());

    const after = await getPrisma().ticket.findUniqueOrThrow({ where: { id: ticket.id } });
    expect(after.updatedAt.getTime()).toBeGreaterThan(ticket.updatedAt.getTime());
    expect(after.version).toBe(ticket.version);
    expect(after.currentStatus).toBe("OPEN");
  });

  it("answers 401 without a session", async () => {
    const ticket = await newTicket(requesterId);
    const response = await request(app).post(`/api/staff/tickets/${ticket.id}/actions`).send(actionBody());
    expect(response.status).toBe(401);
  });
});
