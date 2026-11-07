import { describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../../src/app.js";

// TEMPORARY (Lab 5, C-02): this test fails on purpose to show that the
// required check blocks the merge into main. This branch is never merged.
describe("Merge gate demo", () => {
  it("expects a wrong health status on purpose", async () => {
    const response = await request(createApp()).get("/api/health");

    expect(response.body.status).toBe("broken");
  });
});
