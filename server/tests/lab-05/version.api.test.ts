import { afterEach, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../../src/app.js";

// Lab 5 - R-08: anyone can check which commit the running service was built from.
const app = createApp();

describe("GET /api/version", () => {
  afterEach(() => {
    delete process.env.COMMIT_SHA;
  });

  it("returns the commit given to the image at build time", async () => {
    process.env.COMMIT_SHA = "0123456789abcdef0123456789abcdef01234567";

    const response = await request(app).get("/api/version");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ commit: "0123456789abcdef0123456789abcdef01234567" });
  });

  it("says local when the app was not built by the pipeline", async () => {
    const response = await request(app).get("/api/version");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ commit: "local" });
  });
});
