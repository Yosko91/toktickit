import { describe, it, expect } from "vitest";
import request from "supertest";
import { createApp } from "../../src/app.js";

const app = createApp();

// API-02 - requires the database to be migrated and seeded first.
describe("GET /api/categories", () => {
  it("returns the four seeded categories in id order", async () => {
    const response = await request(app).get("/api/categories");

    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(4);

    const names = response.body.map((c: { name: string }) => c.name);
    expect(names).toEqual([
      "Account and Access",
      "Hardware",
      "Software",
      "Network",
    ]);

    const ids = response.body.map((c: { id: number }) => c.id);
    expect(ids).toEqual([...ids].sort((a, b) => a - b));
  });
});
