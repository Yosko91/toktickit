import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";
import { cleanupRequesters, createTestRequester, getSeededCategory, getSeededRelatedSystem } from "./helpers.js";

const app = createApp();

describe("GET /api/tickets/:id", () => {
  let owner: number;
  let stranger: number;
  let ticketId: number;

  beforeAll(async () => {
    const ownerRequester = await createTestRequester();
    const strangerRequester = await createTestRequester();
    owner = ownerRequester.id;
    stranger = strangerRequester.id;

    const category = await getSeededCategory("Hardware");
    const relatedSystem = await getSeededRelatedSystem();

    const ticket = await getPrisma().ticket.create({
      data: {
        ticketNumber: `TKT-TEST-DETAIL-${Date.now()}`,
        requesterId: owner,
        categoryId: category.id,
        relatedSystemId: relatedSystem.id,
        summary: "Docking station not detected",
        description: "Description long enough to pass validation for this seeded test fixture.",
        requestedPriority: "LOW",
      },
    });
    ticketId = ticket.id;
  });

  afterAll(async () => {
    await cleanupRequesters([owner, stranger]);
  });

  // API-16
  it("returns the full ticket shape, with an empty attachments array, to the owner", async () => {
    const response = await request(app)
      .get(`/api/tickets/${ticketId}`)
      .set("X-Dev-Requester-Id", String(owner));

    expect(response.status).toBe(200);
    expect(response.body.ticketNumber).toContain("TKT-TEST-DETAIL-");
    expect(response.body.categoryName).toBe("Hardware");
    expect(response.body.requesterName).toBeDefined();
    expect(response.body.attachments).toEqual([]);
  });

  // API-15 - AC-03
  it("returns 404 (not 403) for a requester who does not own the ticket", async () => {
    const response = await request(app)
      .get(`/api/tickets/${ticketId}`)
      .set("X-Dev-Requester-Id", String(stranger));

    expect(response.status).toBe(404);
  });

  // API-17
  it("returns 404 for an id that does not exist at all", async () => {
    const response = await request(app)
      .get("/api/tickets/999999999")
      .set("X-Dev-Requester-Id", String(owner));

    expect(response.status).toBe(404);
  });

  it("returns 404 for a non-numeric id instead of crashing", async () => {
    const response = await request(app)
      .get("/api/tickets/not-a-number")
      .set("X-Dev-Requester-Id", String(owner));

    expect(response.status).toBe(404);
  });
});
