import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";
import { cleanupRequesters, createTestRequester } from "./helpers.js";

const app = createApp();

// API-29 - BR-06/BR-30: inactive Requesters never appear in the selector.
describe("GET /api/requesters", () => {
  let activeId: number;
  let inactiveId: number;

  beforeAll(async () => {
    const active = await createTestRequester({ isActive: true });
    const inactive = await createTestRequester({ isActive: false });
    activeId = active.id;
    inactiveId = inactive.id;
  });

  afterAll(async () => {
    await cleanupRequesters([activeId, inactiveId]);
  });

  it("includes the active test requester and excludes the inactive one", async () => {
    const response = await request(app).get("/api/requesters");

    expect(response.status).toBe(200);
    const ids = response.body.map((r: { id: number }) => r.id);
    expect(ids).toContain(activeId);
    expect(ids).not.toContain(inactiveId);
  });

  it("returns only id, name, email (no isActive/createdAt leaked)", async () => {
    const response = await request(app).get("/api/requesters");
    const row = response.body.find((r: { id: number }) => r.id === activeId);

    expect(Object.keys(row).sort()).toEqual(["email", "id", "name"]);
  });
});

// API-30 - reference data endpoints return only active rows, in the shape
// the frontend selector/dropdowns expect.
describe("GET /api/categories and /api/related-systems", () => {
  it("categories: returns only active rows ordered by id, with id+name only", async () => {
    const response = await request(app).get("/api/categories");

    expect(response.status).toBe(200);
    expect(response.body.length).toBeGreaterThanOrEqual(4);
    const ids = response.body.map((c: { id: number }) => c.id);
    expect(ids).toEqual([...ids].sort((a, b) => a - b));
    expect(Object.keys(response.body[0]).sort()).toEqual(["id", "name"]);
  });

  it("related-systems: returns the seeded systems, id+name only", async () => {
    const response = await request(app).get("/api/related-systems");

    expect(response.status).toBe(200);
    expect(response.body.length).toBeGreaterThanOrEqual(6);
    const names = response.body.map((s: { name: string }) => s.name);
    expect(names).toContain("Corporate Laptop");
    expect(Object.keys(response.body[0]).sort()).toEqual(["id", "name"]);
  });

  it("excludes a category that has been made inactive", async () => {
    const prisma = getPrisma();
    const created = await prisma.category.create({
      data: { name: `Temp Inactive Category ${Date.now()}`, isActive: false },
    });

    try {
      const response = await request(app).get("/api/categories");
      const ids = response.body.map((c: { id: number }) => c.id);
      expect(ids).not.toContain(created.id);
    } finally {
      await prisma.category.delete({ where: { id: created.id } });
    }
  });
});
