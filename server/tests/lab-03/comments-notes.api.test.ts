import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";
import { generateTicketNumber } from "../../src/services/ticketNumber.js";
import { cookieFor, cleanupUsers, createTestRequester, createTestStaff } from "../shared/auth.js";

const app = createApp();

describe("Public Comments, Internal Notes and requester resolution", () => {
  let ownerRequesterId: number;
  let strangerRequesterId: number;
  let staffId: number;
  let categoryId: number;
  let relatedSystemId: number;

  beforeAll(async () => {
    const prisma = getPrisma();
    ownerRequesterId = (await createTestRequester()).id;
    strangerRequesterId = (await createTestRequester()).id;
    staffId = (await createTestStaff()).id;
    categoryId = (await prisma.category.findFirstOrThrow({ where: { isActive: true } })).id;
    relatedSystemId = (await prisma.relatedSystem.findFirstOrThrow({ where: { isActive: true } })).id;
  });

  afterAll(async () => {
    await cleanupUsers([ownerRequesterId, strangerRequesterId, staffId]);
  });

  async function newTicket(overrides: Record<string, unknown> = {}) {
    return getPrisma().ticket.create({
      data: {
        ticketNumber: await generateTicketNumber(),
        requesterId: ownerRequesterId,
        categoryId,
        relatedSystemId,
        summary: "Comments fixture ticket",
        description: "Created by the Lab 3 comments and notes suite.",
        requestedPriority: "MEDIUM",
        itPriority: "MEDIUM",
        ...overrides,
      },
    });
  }

  // API-36 - AC-09, BR-28
  it("lets a Requester comment on their own ticket, with the author taken from the session", async () => {
    const ticket = await newTicket();

    const response = await request(app)
      .post(`/api/tickets/${ticket.id}/comments`)
      .set("Cookie", cookieFor(ownerRequesterId))
      .send({ body: "Any update on this please?" });

    expect(response.status).toBe(201);
    expect(response.body.authorId).toBe(ownerRequesterId);
    expect(response.body.authorRole).toBe("REQUESTER");
    expect(response.body.body).toBe("Any update on this please?");
    expect(new Date(response.body.createdAt).getTime()).toBeLessThanOrEqual(Date.now() + 1000);
  });

  it("lets staff comment on any ticket", async () => {
    const ticket = await newTicket();

    const response = await request(app)
      .post(`/api/tickets/${ticket.id}/comments`)
      .set("Cookie", cookieFor(staffId))
      .send({ body: "We are looking into this now." });

    expect(response.status).toBe(201);
    expect(response.body.authorRole).toBe("IT_STAFF");
  });

  // API-37 - BR-13
  it("hides another Requester's ticket from a comment attempt behind a 404", async () => {
    const ticket = await newTicket();

    const response = await request(app)
      .post(`/api/tickets/${ticket.id}/comments`)
      .set("Cookie", cookieFor(strangerRequesterId))
      .send({ body: "Trying to comment on a ticket that is not mine" });

    expect(response.status).toBe(404);
  });

  // API-38, API-39 - BR-29
  it("rejects an empty, whitespace-only or over-long comment", async () => {
    const ticket = await newTicket();

    for (const body of ["", "    \n\t  ", "x".repeat(2001)]) {
      const response = await request(app)
        .post(`/api/tickets/${ticket.id}/comments`)
        .set("Cookie", cookieFor(ownerRequesterId))
        .send({ body });

      expect(response.status).toBe(400);
    }

    const stored = await getPrisma().publicComment.count({ where: { ticketId: ticket.id } });
    expect(stored).toBe(0);
  });

  // API-40 - BR-28
  it("ignores an authorId supplied in the request body", async () => {
    const ticket = await newTicket();

    const response = await request(app)
      .post(`/api/tickets/${ticket.id}/comments`)
      .set("Cookie", cookieFor(ownerRequesterId))
      .send({ body: "Trying to post as somebody else", authorId: staffId });

    expect(response.status).toBe(201);
    expect(response.body.authorId).toBe(ownerRequesterId);
  });

  // API-41 - AC-16, BR-26
  it("keeps an internal note out of every response the Requester can obtain", async () => {
    const ticket = await newTicket();
    const secret = "Internal only: replacement laptop already ordered, do not tell the requester yet";

    const created = await request(app)
      .post(`/api/staff/tickets/${ticket.id}/notes`)
      .set("Cookie", cookieFor(staffId))
      .send({ body: secret });
    expect(created.status).toBe(201);
    expect(created.body.authorId).toBe(staffId);

    // The Requester's own ticket detail: the note must not be present in any
    // form, not as text and not as a field the client could render later.
    const requesterView = await request(app)
      .get(`/api/tickets/${ticket.id}`)
      .set("Cookie", cookieFor(ownerRequesterId));

    expect(requesterView.status).toBe(200);
    expect(JSON.stringify(requesterView.body)).not.toContain(secret);
    expect(requesterView.body.internalNotes).toBeUndefined();

    // Staff do see it, otherwise this test would pass on a broken feature.
    const staffView = await request(app)
      .get(`/api/staff/tickets/${ticket.id}`)
      .set("Cookie", cookieFor(staffId));
    expect(JSON.stringify(staffView.body)).toContain(secret);
  });

  it("rejects an empty internal note", async () => {
    const ticket = await newTicket();

    const response = await request(app)
      .post(`/api/staff/tickets/${ticket.id}/notes`)
      .set("Cookie", cookieFor(staffId))
      .send({ body: "   " });

    expect(response.status).toBe(400);
  });

  // API-42 - BR-30
  it("moves the ticket's last-updated time when a comment is posted", async () => {
    const ticket = await newTicket();
    const before = ticket.updatedAt.getTime();

    await new Promise((resolve) => setTimeout(resolve, 10));
    await request(app)
      .post(`/api/tickets/${ticket.id}/comments`)
      .set("Cookie", cookieFor(ownerRequesterId))
      .send({ body: "Bumping the ticket so it resurfaces in the queue" });

    const after = await getPrisma().ticket.findUniqueOrThrow({ where: { id: ticket.id } });
    expect(after.updatedAt.getTime()).toBeGreaterThan(before);
  });

  // API-43 - AC-10, BR-31
  it("records that the problem appears resolved without touching the status", async () => {
    const ticket = await newTicket({ currentStatus: "IN_PROGRESS" });

    const response = await request(app)
      .post(`/api/tickets/${ticket.id}/requester-resolved`)
      .set("Cookie", cookieFor(ownerRequesterId));

    expect(response.status).toBe(200);
    expect(response.body.requesterResolvedAt).toBeTruthy();
    // BR-24: only IT Staff decide a ticket is resolved.
    expect(response.body.currentStatus).toBe("IN_PROGRESS");

    const after = await getPrisma().ticket.findUniqueOrThrow({ where: { id: ticket.id } });
    expect(after.currentStatus).toBe("IN_PROGRESS");
    expect(after.requesterResolvedAt).not.toBeNull();
  });

  // API-44 - BR-31
  it("refuses the resolution signal on a ticket that is already resolved or closed", async () => {
    for (const status of ["RESOLVED", "CLOSED", "CANCELLED"] as const) {
      const ticket = await newTicket({ currentStatus: status, ownerId: staffId });

      const response = await request(app)
        .post(`/api/tickets/${ticket.id}/requester-resolved`)
        .set("Cookie", cookieFor(ownerRequesterId));

      expect(response.status).toBe(409);
    }
  });

  it("refuses the resolution signal from staff, because it is the Requester's own opinion", async () => {
    const ticket = await newTicket();

    const response = await request(app)
      .post(`/api/tickets/${ticket.id}/requester-resolved`)
      .set("Cookie", cookieFor(staffId));

    expect(response.status).toBe(403);
  });

  // API-45 - BR-24
  it("refuses a Requester calling the status endpoint directly", async () => {
    const ticket = await newTicket();

    const response = await request(app)
      .patch(`/api/staff/tickets/${ticket.id}/status`)
      .set("Cookie", cookieFor(ownerRequesterId))
      .send({ currentStatus: "RESOLVED" });

    expect(response.status).toBe(403);
    const after = await getPrisma().ticket.findUniqueOrThrow({ where: { id: ticket.id } });
    expect(after.currentStatus).toBe("NEW");
  });
});
