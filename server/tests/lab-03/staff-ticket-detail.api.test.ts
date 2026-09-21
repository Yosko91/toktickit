import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";
import { generateTicketNumber } from "../../src/services/ticketNumber.js";
import { cookieFor, cleanupUsers, createTestRequester, createTestStaff } from "../shared/auth.js";

const app = createApp();

describe("IT Staff ticket operations", () => {
  let staffId: number;
  let otherStaffId: number;
  let inactiveStaffId: number;
  let requesterId: number;
  let categoryId: number;
  let relatedSystemId: number;

  beforeAll(async () => {
    const prisma = getPrisma();
    staffId = (await createTestStaff()).id;
    otherStaffId = (await createTestStaff()).id;
    inactiveStaffId = (await createTestStaff({ isActive: false })).id;
    requesterId = (await createTestRequester()).id;
    categoryId = (await prisma.category.findFirstOrThrow({ where: { isActive: true } })).id;
    relatedSystemId = (await prisma.relatedSystem.findFirstOrThrow({ where: { isActive: true } })).id;
  });

  afterAll(async () => {
    await cleanupUsers([staffId, otherStaffId, inactiveStaffId, requesterId]);
  });

  /** A fresh unowned NEW ticket, so each test starts from a known state. */
  async function newTicket(overrides: Record<string, unknown> = {}) {
    return getPrisma().ticket.create({
      data: {
        ticketNumber: await generateTicketNumber(),
        requesterId,
        categoryId,
        relatedSystemId,
        summary: "Staff operations fixture ticket",
        description: "Created by the Lab 3 staff ticket detail suite.",
        requestedPriority: "MEDIUM",
        itPriority: "MEDIUM",
        ...overrides,
      },
    });
  }

  const asStaff = () => cookieFor(staffId);

  // API-26 - AC-12
  it("claims an unassigned ticket for the caller", async () => {
    const ticket = await newTicket();

    const response = await request(app)
      .patch(`/api/staff/tickets/${ticket.id}/owner`)
      .set("Cookie", asStaff())
      .send({ ownerId: staffId });

    expect(response.status).toBe(200);
    expect(response.body.ownerId).toBe(staffId);
    expect(response.body.ownerName).toBeTruthy();

    // Visible to another staff member, not just to the claimer.
    const seenByOther = await request(app)
      .get(`/api/staff/tickets/${ticket.id}`)
      .set("Cookie", cookieFor(otherStaffId));
    expect(seenByOther.body.ownerId).toBe(staffId);
  });

  it("reassigns an owned ticket to another staff member", async () => {
    const ticket = await newTicket({ ownerId: staffId });

    const response = await request(app)
      .patch(`/api/staff/tickets/${ticket.id}/owner`)
      .set("Cookie", asStaff())
      .send({ ownerId: otherStaffId });

    expect(response.status).toBe(200);
    expect(response.body.ownerId).toBe(otherStaffId);
  });

  // API-27 - BR-18
  it("releases a ticket back to unassigned", async () => {
    const ticket = await newTicket({ ownerId: staffId });

    const response = await request(app)
      .patch(`/api/staff/tickets/${ticket.id}/owner`)
      .set("Cookie", asStaff())
      .send({ ownerId: null });

    expect(response.status).toBe(200);
    expect(response.body.ownerId).toBeNull();
  });

  // API-28 - BR-17
  it("refuses to make a Requester the ticket owner", async () => {
    const ticket = await newTicket();

    const response = await request(app)
      .patch(`/api/staff/tickets/${ticket.id}/owner`)
      .set("Cookie", asStaff())
      .send({ ownerId: requesterId });

    expect(response.status).toBe(422);
    const after = await getPrisma().ticket.findUniqueOrThrow({ where: { id: ticket.id } });
    expect(after.ownerId).toBeNull();
  });

  // API-29 - BR-17
  it("refuses to assign a deactivated staff account", async () => {
    const ticket = await newTicket();

    const response = await request(app)
      .patch(`/api/staff/tickets/${ticket.id}/owner`)
      .set("Cookie", asStaff())
      .send({ ownerId: inactiveStaffId });

    expect(response.status).toBe(422);
  });

  // API-30 - AC-13, BR-19
  it("changes the IT priority and leaves the requested priority untouched", async () => {
    const ticket = await newTicket({ requestedPriority: "LOW", itPriority: "LOW" });

    const response = await request(app)
      .patch(`/api/staff/tickets/${ticket.id}/it-priority`)
      .set("Cookie", asStaff())
      .send({ itPriority: "HIGH" });

    expect(response.status).toBe(200);
    expect(response.body.itPriority).toBe("HIGH");
    // BR-19: what the Requester asked for is a historical fact, not an editable field.
    expect(response.body.requestedPriority).toBe("LOW");

    const after = await getPrisma().ticket.findUniqueOrThrow({ where: { id: ticket.id } });
    expect(after.requestedPriority).toBe("LOW");
  });

  it("rejects an unknown IT priority value", async () => {
    const ticket = await newTicket();

    const response = await request(app)
      .patch(`/api/staff/tickets/${ticket.id}/it-priority`)
      .set("Cookie", asStaff())
      .send({ itPriority: "URGENT" });

    expect(response.status).toBe(400);
  });

  // API-31 - AC-14, BR-22
  it("refuses the jump from NEW straight to RESOLVED and changes nothing", async () => {
    const ticket = await newTicket({ ownerId: staffId });

    const response = await request(app)
      .patch(`/api/staff/tickets/${ticket.id}/status`)
      .set("Cookie", asStaff())
      .send({ currentStatus: "RESOLVED" });

    expect(response.status).toBe(409);
    const after = await getPrisma().ticket.findUniqueOrThrow({ where: { id: ticket.id } });
    expect(after.currentStatus).toBe("NEW");
  });

  // API-32 - AC-15, BR-23
  it("refuses to resolve a ticket that nobody owns", async () => {
    const ticket = await newTicket({ currentStatus: "IN_PROGRESS" });

    const response = await request(app)
      .patch(`/api/staff/tickets/${ticket.id}/status`)
      .set("Cookie", asStaff())
      .send({ currentStatus: "RESOLVED" });

    expect(response.status).toBe(409);
    expect(response.body.error).toMatch(/owner/i);
    const after = await getPrisma().ticket.findUniqueOrThrow({ where: { id: ticket.id } });
    expect(after.currentStatus).toBe("IN_PROGRESS");
  });

  // API-33 - BR-22
  it("walks a ticket through the permitted chain to RESOLVED", async () => {
    const ticket = await newTicket({ ownerId: staffId });

    for (const status of ["OPEN", "IN_PROGRESS", "RESOLVED"]) {
      const response = await request(app)
        .patch(`/api/staff/tickets/${ticket.id}/status`)
        .set("Cookie", asStaff())
        .send({ currentStatus: status });

      expect(response.status).toBe(200);
      expect(response.body.currentStatus).toBe(status);
    }
  });

  // API-34 - BR-25
  it("allows nothing out of CLOSED", async () => {
    const ticket = await newTicket({ ownerId: staffId, currentStatus: "CLOSED" });

    for (const status of ["OPEN", "IN_PROGRESS", "REOPENED", "CANCELLED"]) {
      const response = await request(app)
        .patch(`/api/staff/tickets/${ticket.id}/status`)
        .set("Cookie", asStaff())
        .send({ currentStatus: status });

      expect(response.status).toBe(409);
    }
  });

  it("reopens a resolved ticket and closes another one", async () => {
    const resolved = await newTicket({ ownerId: staffId, currentStatus: "RESOLVED" });
    const toClose = await newTicket({ ownerId: staffId, currentStatus: "RESOLVED" });

    const reopen = await request(app)
      .patch(`/api/staff/tickets/${resolved.id}/status`)
      .set("Cookie", asStaff())
      .send({ currentStatus: "REOPENED" });
    expect(reopen.status).toBe(200);

    const close = await request(app)
      .patch(`/api/staff/tickets/${toClose.id}/status`)
      .set("Cookie", asStaff())
      .send({ currentStatus: "CLOSED" });
    expect(close.status).toBe(200);
  });

  // API-35 - FR-12
  it("offers only active staff and administrators as assignable owners", async () => {
    const response = await request(app)
      .get("/api/staff/assignable-users")
      .set("Cookie", asStaff());

    expect(response.status).toBe(200);
    const ids = response.body.map((u: { id: number }) => u.id);
    expect(ids).toContain(staffId);
    expect(ids).not.toContain(requesterId);
    expect(ids).not.toContain(inactiveStaffId);
    for (const user of response.body) {
      expect(["IT_STAFF", "ADMINISTRATOR"]).toContain(user.role);
    }
  });

  it("answers 404 for a ticket id that does not exist", async () => {
    const response = await request(app)
      .get("/api/staff/tickets/99999999")
      .set("Cookie", asStaff());

    expect(response.status).toBe(404);
  });
});
