import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";
import { generateTicketNumber } from "../../src/services/ticketNumber.js";
import {
  cookieFor,
  cleanupUsers,
  createTestAdmin,
  createTestRequester,
  createTestStaff,
} from "../shared/auth.js";

const app = createApp();

// The labsheet is explicit that hiding a button is not authorization. Every
// assertion here therefore calls the endpoint directly with the wrong role, the
// way curl would, and ignores the interface entirely.
describe("Server-side authorization", () => {
  let requesterId: number;
  let otherRequesterId: number;
  let staffId: number;
  let adminId: number;
  let ownTicketId: number;
  let otherTicketId: number;

  beforeAll(async () => {
    const prisma = getPrisma();
    requesterId = (await createTestRequester()).id;
    otherRequesterId = (await createTestRequester()).id;
    staffId = (await createTestStaff()).id;
    adminId = (await createTestAdmin()).id;

    const categoryId = (await prisma.category.findFirstOrThrow({ where: { isActive: true } })).id;
    const relatedSystemId = (
      await prisma.relatedSystem.findFirstOrThrow({ where: { isActive: true } })
    ).id;

    const base = {
      categoryId,
      relatedSystemId,
      description: "Created by the Lab 3 authorization suite.",
      requestedPriority: "MEDIUM" as const,
      itPriority: "MEDIUM" as const,
    };

    ownTicketId = (
      await prisma.ticket.create({
        data: {
          ...base,
          ticketNumber: await generateTicketNumber(),
          requesterId,
          summary: "Authorization fixture - mine",
        },
      })
    ).id;

    otherTicketId = (
      await prisma.ticket.create({
        data: {
          ...base,
          ticketNumber: await generateTicketNumber(),
          requesterId: otherRequesterId,
          summary: "Authorization fixture - somebody else's",
        },
      })
    ).id;
  });

  afterAll(async () => {
    await cleanupUsers([requesterId, otherRequesterId, staffId, adminId]);
  });

  // API-17 - BR-12
  it("answers 401, not 403, when there is no session at all", async () => {
    for (const path of ["/api/tickets", "/api/staff/tickets", "/api/admin/users"]) {
      const response = await request(app).get(path);
      expect(response.status).toBe(401);
    }
  });

  // API-13 - AC-17
  it("refuses a Requester the IT Staff queue, with no ticket data in the body", async () => {
    const response = await request(app)
      .get("/api/staff/tickets")
      .set("Cookie", cookieFor(requesterId));

    expect(response.status).toBe(403);
    expect(response.body.data).toBeUndefined();
    expect(JSON.stringify(response.body)).not.toMatch(/ticketNumber|summary/);
  });

  it("refuses a Requester the staff ticket operations", async () => {
    const operations = [
      request(app).patch(`/api/staff/tickets/${ownTicketId}/owner`).send({ ownerId: null }),
      request(app).patch(`/api/staff/tickets/${ownTicketId}/it-priority`).send({ itPriority: "HIGH" }),
      request(app).patch(`/api/staff/tickets/${ownTicketId}/status`).send({ currentStatus: "OPEN" }),
      request(app).get("/api/staff/assignable-users"),
    ];

    for (const operation of operations) {
      const response = await operation.set("Cookie", cookieFor(requesterId));
      expect(response.status).toBe(403);
    }
  });

  // API-18 - AC-04, BR-14
  it("refuses a Requester the internal notes of their own ticket, returning no content at all", async () => {
    const prisma = getPrisma();
    const secret = "Internal note that the requester must never receive";
    await prisma.internalNote.create({
      data: { ticketId: ownTicketId, authorId: staffId, body: secret },
    });

    const read = await request(app)
      .get(`/api/staff/tickets/${ownTicketId}/notes`)
      .set("Cookie", cookieFor(requesterId));

    expect(read.status).toBe(403);
    expect(read.body).not.toHaveProperty("length");
    expect(JSON.stringify(read.body)).not.toContain(secret);
    // Not even a count: knowing that three notes exist is itself information.
    expect(JSON.stringify(read.body)).not.toMatch(/\bcount\b|\btotal\b/i);

    const write = await request(app)
      .post(`/api/staff/tickets/${ownTicketId}/notes`)
      .set("Cookie", cookieFor(requesterId))
      .send({ body: "Trying to write a note as a requester" });
    expect(write.status).toBe(403);
  });

  // API-14, API-15 - AC-23, BR-15
  it("refuses user management to a Requester and to IT Staff alike", async () => {
    for (const cookie of [cookieFor(requesterId), cookieFor(staffId)]) {
      const list = await request(app).get("/api/admin/users").set("Cookie", cookie);
      expect(list.status).toBe(403);
      expect(Array.isArray(list.body)).toBe(false);

      const create = await request(app)
        .post("/api/admin/users")
        .set("Cookie", cookie)
        .send({
          name: "Sneaky Admin",
          email: "sneaky@toktickit.test",
          role: "ADMINISTRATOR",
          initialPassword: "Sneaky!2026",
        });
      expect(create.status).toBe(403);
    }

    // The same call as an Administrator works, so the refusals above are about
    // the role and not about a broken endpoint.
    const asAdmin = await request(app).get("/api/admin/users").set("Cookie", cookieFor(adminId));
    expect(asAdmin.status).toBe(200);
  });

  // API-16 - AC-03, BR-03
  it("ignores an identity supplied by the client in the old header or in the body", async () => {
    const response = await request(app)
      .get("/api/tickets")
      .set("Cookie", cookieFor(requesterId))
      // The Lab 2 header, plus a body field, both naming somebody else.
      .set("X-Dev-Requester-Id", String(otherRequesterId))
      .query({ requesterId: otherRequesterId });

    expect(response.status).toBe(200);
    const ids = response.body.data.map((t: { id: number }) => t.id);
    expect(ids).toContain(ownTicketId);
    expect(ids).not.toContain(otherTicketId);
  });

  it("hides another Requester's ticket as not found rather than forbidden", async () => {
    const response = await request(app)
      .get(`/api/tickets/${otherTicketId}`)
      .set("Cookie", cookieFor(requesterId));

    // BR-13: 403 would confirm that this id exists and belongs to somebody else.
    expect(response.status).toBe(404);
  });

  it("lets staff and administrators reach any ticket, which requesters cannot", async () => {
    for (const cookie of [cookieFor(staffId), cookieFor(adminId)]) {
      const response = await request(app)
        .get(`/api/staff/tickets/${otherTicketId}`)
        .set("Cookie", cookie);
      expect(response.status).toBe(200);
    }
  });

  it("refuses an Administrator the Requester-only actions", async () => {
    const create = await request(app)
      .post("/api/tickets")
      .set("Cookie", cookieFor(adminId))
      .send({
        categoryId: 1,
        relatedSystemId: 1,
        summary: "An administrator raising a ticket",
        description: "Administrators manage accounts, they do not raise tickets in Lab 3.",
        requestedPriority: "LOW",
      });

    expect(create.status).toBe(403);

    const resolved = await request(app)
      .post(`/api/tickets/${ownTicketId}/requester-resolved`)
      .set("Cookie", cookieFor(adminId));
    expect(resolved.status).toBe(403);
  });
});
