import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../../src/app.js";
import {
  cleanupRequesters,
  createTestRequester,
  getSeededCategory,
  getSeededRelatedSystem,
  validTicketBody,
} from "./helpers.js";

const app = createApp();

describe("POST /api/tickets", () => {
  let requesterId: number;
  let inactiveRequesterId: number;
  let categoryId: number;
  let relatedSystemId: number;

  beforeAll(async () => {
    const requester = await createTestRequester();
    requesterId = requester.id;
    const inactive = await createTestRequester({ isActive: false });
    inactiveRequesterId = inactive.id;
    categoryId = (await getSeededCategory()).id;
    relatedSystemId = (await getSeededRelatedSystem()).id;
  });

  afterAll(async () => {
    await cleanupRequesters([requesterId, inactiveRequesterId]);
  });

  // API-01 - AC-01
  it("creates a ticket and returns a formatted, unique Ticket Number", async () => {
    const response = await request(app)
      .post("/api/tickets")
      .set("X-Dev-Requester-Id", String(requesterId))
      .send(validTicketBody({ categoryId, relatedSystemId }));

    expect(response.status).toBe(201);
    expect(response.body.ticketNumber).toMatch(/^TKT-\d{4}-\d{6}$/);
    expect(response.body.currentStatus).toBe("NEW");
    expect(response.body.requesterId).toBe(requesterId);
  });

  // API-08 - AC-01
  it("gives two tickets created back to back distinct ticket numbers", async () => {
    const first = await request(app)
      .post("/api/tickets")
      .set("X-Dev-Requester-Id", String(requesterId))
      .send(validTicketBody({ categoryId, relatedSystemId }));
    const second = await request(app)
      .post("/api/tickets")
      .set("X-Dev-Requester-Id", String(requesterId))
      .send(validTicketBody({ categoryId, relatedSystemId }));

    expect(first.body.ticketNumber).not.toBe(second.body.ticketNumber);
  });

  // API-02 - AC-04
  it("rejects a missing summary with a field-level detail and creates nothing", async () => {
    const response = await request(app)
      .post("/api/tickets")
      .set("X-Dev-Requester-Id", String(requesterId))
      .send(validTicketBody({ categoryId, relatedSystemId, summary: "" }));

    expect(response.status).toBe(400);
    expect(response.body.details.summary).toBeDefined();
  });

  // API-03 - AC-05
  it("rejects a description shorter than 20 characters", async () => {
    const response = await request(app)
      .post("/api/tickets")
      .set("X-Dev-Requester-Id", String(requesterId))
      .send(validTicketBody({ categoryId, relatedSystemId, description: "too short" }));

    expect(response.status).toBe(400);
    expect(response.body.details.description).toBeDefined();
  });

  // API-04 - AC-26
  it("rejects an unknown categoryId with 422 and creates nothing", async () => {
    const response = await request(app)
      .post("/api/tickets")
      .set("X-Dev-Requester-Id", String(requesterId))
      .send(validTicketBody({ categoryId: 999999, relatedSystemId }));

    expect(response.status).toBe(422);
    expect(response.body.details.categoryId).toBeDefined();
  });

  // API-05 - AC-26
  it("rejects an inactive relatedSystemId with 422", async () => {
    const { getPrisma } = await import("../../src/prisma.js");
    const prisma = getPrisma();
    const inactiveSystem = await prisma.relatedSystem.create({
      data: { name: `Temp Inactive System ${Date.now()}`, isActive: false },
    });

    try {
      const response = await request(app)
        .post("/api/tickets")
        .set("X-Dev-Requester-Id", String(requesterId))
        .send(validTicketBody({ categoryId, relatedSystemId: inactiveSystem.id }));

      expect(response.status).toBe(422);
      expect(response.body.details.relatedSystemId).toBeDefined();
    } finally {
      await prisma.relatedSystem.delete({ where: { id: inactiveSystem.id } });
    }
  });

  // API-06 - AC-27
  it("rejects a request with no X-Dev-Requester-Id header", async () => {
    const response = await request(app)
      .post("/api/tickets")
      .send(validTicketBody({ categoryId, relatedSystemId }));

    expect(response.status).toBe(400);
  });

  // API-07 - AC-27/BR-09
  it("rejects a request identifying as an inactive requester", async () => {
    const response = await request(app)
      .post("/api/tickets")
      .set("X-Dev-Requester-Id", String(inactiveRequesterId))
      .send(validTicketBody({ categoryId, relatedSystemId }));

    expect(response.status).toBe(403);
  });

  it("rejects an unknown requester id", async () => {
    const response = await request(app)
      .post("/api/tickets")
      .set("X-Dev-Requester-Id", "999999999")
      .send(validTicketBody({ categoryId, relatedSystemId }));

    expect(response.status).toBe(404);
  });
});
