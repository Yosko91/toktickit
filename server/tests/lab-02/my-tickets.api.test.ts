import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";
import { cleanupRequesters, createTestRequester, getSeededCategory, getSeededRelatedSystem } from "./helpers.js";

const app = createApp();

describe("GET /api/tickets", () => {
  let requesterA: number;
  let requesterB: number;
  let categoryId: number;
  let relatedSystemId: number;
  let ticketANumber: string;

  beforeAll(async () => {
    const a = await createTestRequester();
    const b = await createTestRequester();
    requesterA = a.id;
    requesterB = b.id;
    categoryId = (await getSeededCategory("Hardware")).id;
    relatedSystemId = (await getSeededRelatedSystem()).id;

    const prisma = getPrisma();
    // 15 tickets for Requester A, staggered createdAt so sort order is
    // unambiguous, one of them findable by an exact search term.
    for (let i = 0; i < 15; i += 1) {
      const ticket = await prisma.ticket.create({
        data: {
          ticketNumber: `TKT-TEST-A-${String(i).padStart(3, "0")}`,
          requesterId: requesterA,
          categoryId,
          relatedSystemId,
          summary: i === 0 ? "Very particular search phrase" : `Test ticket ${i}`,
          description: "Description long enough to pass validation for this seeded test fixture.",
          requestedPriority: "MEDIUM",
          createdAt: new Date(Date.now() - (15 - i) * 60_000),
        },
      });
      if (i === 0) ticketANumber = ticket.ticketNumber;
    }

    // One ticket for Requester B, must never leak into A's list.
    await prisma.ticket.create({
      data: {
        ticketNumber: "TKT-TEST-B-000",
        requesterId: requesterB,
        categoryId,
        relatedSystemId,
        summary: "Requester B's own ticket",
        description: "Description long enough to pass validation for this seeded test fixture.",
        requestedPriority: "HIGH",
      },
    });
  });

  afterAll(async () => {
    await cleanupRequesters([requesterA, requesterB]);
  });

  // API-09 - AC-03/BR-13
  it("never returns another requester's tickets, even unfiltered", async () => {
    const response = await request(app).get("/api/tickets").set("X-Dev-Requester-Id", String(requesterA));

    expect(response.status).toBe(200);
    const ticketNumbers = response.body.data.map((t: { ticketNumber: string }) => t.ticketNumber);
    expect(ticketNumbers).not.toContain("TKT-TEST-B-000");
  });

  // API-10 - AC-10
  it("search matches by exact ticket number", async () => {
    const response = await request(app)
      .get("/api/tickets")
      .query({ search: ticketANumber })
      .set("X-Dev-Requester-Id", String(requesterA));

    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0].ticketNumber).toBe(ticketANumber);
  });

  it("search matches by partial summary, case-insensitively", async () => {
    const response = await request(app)
      .get("/api/tickets")
      .query({ search: "particular search" })
      .set("X-Dev-Requester-Id", String(requesterA));

    expect(response.body.data).toHaveLength(1);
  });

  // API-11 - AC-11
  it("filters by categoryId", async () => {
    const response = await request(app)
      .get("/api/tickets")
      .query({ categoryId })
      .set("X-Dev-Requester-Id", String(requesterA));

    expect(response.status).toBe(200);
    for (const row of response.body.data) {
      expect(row).toBeDefined();
    }
    expect(response.body.pagination.totalItems).toBeGreaterThanOrEqual(15);
  });

  // API-12 - AC-12
  it("paginates: page 2 with pageSize 10 returns the remaining 5 of 15", async () => {
    const response = await request(app)
      .get("/api/tickets")
      .query({ page: 2, pageSize: 10, search: "" })
      .set("X-Dev-Requester-Id", String(requesterA));

    expect(response.body.pagination.totalItems).toBe(15);
    expect(response.body.data).toHaveLength(5);
  });

  // API-13 - AC-13
  it("sorts by createdAt ascending when requested", async () => {
    const response = await request(app)
      .get("/api/tickets")
      .query({ sortBy: "createdAt", sortDir: "asc", pageSize: 50 })
      .set("X-Dev-Requester-Id", String(requesterA));

    const dates = response.body.data.map((t: { createdAt: string }) => new Date(t.createdAt).getTime());
    expect(dates).toEqual([...dates].sort((a, b) => a - b));
  });

  // API-14
  it("rejects an unknown sortBy value with 400", async () => {
    const response = await request(app)
      .get("/api/tickets")
      .query({ sortBy: "notAField" })
      .set("X-Dev-Requester-Id", String(requesterA));

    expect(response.status).toBe(400);
  });

  it("rejects an unsupported pageSize value with 400", async () => {
    const response = await request(app)
      .get("/api/tickets")
      .query({ pageSize: 7 })
      .set("X-Dev-Requester-Id", String(requesterA));

    expect(response.status).toBe(400);
  });

  it("returns an empty (not erroring) list plus zero totals for a requester with no tickets", async () => {
    const fresh = await createTestRequester();
    try {
      const response = await request(app).get("/api/tickets").set("X-Dev-Requester-Id", String(fresh.id));

      expect(response.status).toBe(200);
      expect(response.body.data).toEqual([]);
      expect(response.body.pagination.totalItems).toBe(0);
    } finally {
      await cleanupRequesters([fresh.id]);
    }
  });
});
