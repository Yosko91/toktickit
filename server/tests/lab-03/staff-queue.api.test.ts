import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";
import {
  cookieFor,
  cleanupUsers,
  createTestRequester,
  createTestStaff,
  uniqueSuffix,
} from "../shared/auth.js";
import { generateTicketNumber } from "../../src/services/ticketNumber.js";

const app = createApp();

describe("GET /api/staff/tickets (the IT Staff queue)", () => {
  let staffId: number;
  let requesterA: number;
  let requesterB: number;
  let categoryId: number;
  let relatedSystemId: number;
  let searchableNumber: string;

  // The queue is global by design: it shows every ticket from every Requester,
  // including the rows the other suites are creating at the same time. Every
  // assertion below therefore narrows to this suite's own rows with a unique
  // marker. Without it the filter and pagination assertions are racing the rest
  // of the run, which is exactly how the pagination test first failed.
  const MARKER = `queuefixture${uniqueSuffix().replace(/-/g, "")}`;
  const FIXTURE_COUNT = 12;

  beforeAll(async () => {
    const prisma = getPrisma();
    staffId = (await createTestStaff()).id;
    requesterA = (await createTestRequester()).id;
    requesterB = (await createTestRequester()).id;
    categoryId = (await prisma.category.findFirstOrThrow({ where: { isActive: true } })).id;
    relatedSystemId = (await prisma.relatedSystem.findFirstOrThrow({ where: { isActive: true } })).id;

    const priorities = ["LOW", "MEDIUM", "HIGH"] as const;

    for (let index = 0; index < FIXTURE_COUNT; index += 1) {
      const ticketNumber = await generateTicketNumber();
      if (index === 0) searchableNumber = ticketNumber;

      await prisma.ticket.create({
        data: {
          ticketNumber,
          requesterId: index % 2 === 0 ? requesterA : requesterB,
          ownerId: index % 3 === 0 ? staffId : null,
          categoryId,
          relatedSystemId,
          summary: `${MARKER} queue fixture ticket ${index}`,
          description: "Created by the Lab 3 staff queue suite to exercise the filters.",
          requestedPriority: "MEDIUM",
          itPriority: priorities[index % priorities.length]!,
          currentStatus: index % 4 === 0 ? "IN_PROGRESS" : "NEW",
        },
      });
    }
  });

  afterAll(async () => {
    await cleanupUsers([staffId, requesterA, requesterB]);
  });

  function queue(query = "") {
    return request(app).get(`/api/staff/tickets${query}`).set("Cookie", cookieFor(staffId));
  }

  // API-19 - AC-11
  it("returns tickets from more than one requester", async () => {
    const response = await queue(`?search=${MARKER}&pageSize=50`);

    expect(response.status).toBe(200);
    const names: string[] = response.body.data.map((t: { requesterName: string }) => t.requesterName);
    expect(new Set(names).size).toBeGreaterThan(1);
    // The queue shape has to carry the things IT Staff prioritise work by.
    expect(response.body.data[0]).toHaveProperty("itPriority");
    expect(response.body.data[0]).toHaveProperty("ownerName");
  });

  // API-20 - AC-11
  it("finds one ticket by its exact ticket number", async () => {
    const response = await queue(`?search=${searchableNumber}`);

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0].ticketNumber).toBe(searchableNumber);
  });

  // API-21 - FR-10
  it("filters down to unassigned work", async () => {
    const response = await queue(`?search=${MARKER}&ownerId=unassigned&pageSize=50`);

    expect(response.status).toBe(200);
    expect(response.body.data.length).toBeGreaterThan(0);
    for (const ticket of response.body.data) {
      expect(ticket.ownerId).toBeNull();
    }
  });

  it("filters to one owner", async () => {
    const response = await queue(`?search=${MARKER}&ownerId=${staffId}&pageSize=50`);

    expect(response.status).toBe(200);
    expect(response.body.data.length).toBeGreaterThan(0);
    for (const ticket of response.body.data) {
      expect(ticket.ownerId).toBe(staffId);
    }
  });

  // API-22 - FR-10
  it("filters by status", async () => {
    const response = await queue(`?search=${MARKER}&currentStatus=IN_PROGRESS&pageSize=50`);

    expect(response.status).toBe(200);
    for (const ticket of response.body.data) {
      expect(ticket.currentStatus).toBe("IN_PROGRESS");
    }
  });

  it("filters by IT priority", async () => {
    const response = await queue(`?search=${MARKER}&itPriority=HIGH&pageSize=50`);

    expect(response.status).toBe(200);
    for (const ticket of response.body.data) {
      expect(ticket.itPriority).toBe("HIGH");
    }
  });

  // API-23 - FR-10
  it("sorts by IT priority in a real order rather than just succeeding", async () => {
    const response = await queue(`?search=${MARKER}&sortBy=itPriority&sortDir=asc&pageSize=50`);

    expect(response.status).toBe(200);
    const rank = { LOW: 0, MEDIUM: 1, HIGH: 2 } as const;
    const values: (keyof typeof rank)[] = response.body.data.map(
      (t: { itPriority: keyof typeof rank }) => t.itPriority
    );
    for (let i = 1; i < values.length; i += 1) {
      expect(rank[values[i]!]).toBeGreaterThanOrEqual(rank[values[i - 1]!]);
    }
  });

  // API-24 - FR-10
  it("paginates with correct metadata and no row appearing on two pages", async () => {
    const paged = `?search=${MARKER}&pageSize=10&sortBy=createdAt&sortDir=desc`;
    const first = await queue(`${paged}&page=1`);
    const second = await queue(`${paged}&page=2`);

    expect(first.status).toBe(200);
    expect(first.body.pagination.page).toBe(1);
    expect(first.body.pagination.pageSize).toBe(10);
    expect(first.body.pagination.totalItems).toBe(FIXTURE_COUNT);
    expect(first.body.pagination.totalPages).toBe(2);
    expect(first.body.data).toHaveLength(10);
    expect(second.body.data).toHaveLength(FIXTURE_COUNT - 10);

    const firstIds = first.body.data.map((t: { id: number }) => t.id);
    const secondIds = second.body.data.map((t: { id: number }) => t.id);
    expect(firstIds.filter((id: number) => secondIds.includes(id))).toHaveLength(0);
  });

  // API-25 - FR-10
  it("rejects an unknown sort field and names the parameter", async () => {
    const response = await queue("?sortBy=notAField");

    expect(response.status).toBe(400);
    expect(response.body.details.sortBy).toBeDefined();
  });

  it("rejects an unknown status value", async () => {
    const response = await queue("?currentStatus=NOT_A_STATUS");

    expect(response.status).toBe(400);
    expect(response.body.details.currentStatus).toBeDefined();
  });
});
