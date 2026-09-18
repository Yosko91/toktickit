import { describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";

const app = createApp();

// API-29 (Lab 2) became a removal check in Lab 3. BR-42 deletes the Development
// Requester selector and the endpoint that fed it, so the useful assertion is
// no longer "inactive requesters are filtered out" but "this endpoint is gone".
describe("GET /api/requesters (removed in Lab 3)", () => {
  it("no longer exists", async () => {
    const response = await request(app).get("/api/requesters");

    expect(response.status).toBe(404);
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
