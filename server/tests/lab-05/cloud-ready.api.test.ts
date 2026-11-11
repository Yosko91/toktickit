import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";
import { attachmentFilePath } from "../../src/services/attachmentStorage.js";
import { cleanupUsers, cookieFor, createTestRequester } from "../shared/auth.js";
import { getSeededCategory, getSeededRelatedSystem } from "../lab-02/helpers.js";

// Lab 5 - the app is ready for Cloud Run: readiness check, files kept in the
// database (R-04) and the built UI served from the same container.

const app = createApp();

const TINY_PNG = Buffer.from(
  "89504e470d0a1a0a0000000d4948445200000001000000010802000000907753de0000000c4944415478" +
    "9c63f8cfc00000030101001830900000000049454e44ae426082",
  "hex"
);

describe("GET /api/ready", () => {
  it("says the database is connected", async () => {
    const response = await request(app).get("/api/ready");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: "ready", db: "connected" });
  });
});

describe("Attachment bytes are stored in the database", () => {
  let owner: number;

  beforeAll(async () => {
    owner = (await createTestRequester()).id;
  });

  afterAll(async () => {
    await cleanupUsers([owner]);
  });

  it("keeps the upload in PostgreSQL, not on the container disk", async () => {
    const category = await getSeededCategory("Hardware");
    const relatedSystem = await getSeededRelatedSystem();
    const ticket = await getPrisma().ticket.create({
      data: {
        ticketNumber: `TKT-TEST-L5-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
        requesterId: owner,
        categoryId: category.id,
        relatedSystemId: relatedSystem.id,
        summary: "Lab 5 attachment test ticket",
        description: "Description long enough to pass validation for this Lab 5 test fixture.",
        requestedPriority: "MEDIUM",
        itPriority: "MEDIUM",
      },
    });

    const upload = await request(app)
      .post(`/api/tickets/${ticket.id}/attachments`)
      .set("Cookie", cookieFor(owner))
      .attach("file", TINY_PNG, { filename: "screen.png", contentType: "image/png" });
    expect(upload.status).toBe(201);

    const stored = await getPrisma().attachment.findUniqueOrThrow({
      where: { id: upload.body.id },
      include: { content: true },
    });
    expect(Buffer.from(stored.content!.data).equals(TINY_PNG)).toBe(true);
    expect(fs.existsSync(attachmentFilePath(ticket.id, stored.storedFilename))).toBe(false);

    const download = await request(app)
      .get(`/api/attachments/${upload.body.id}/download`)
      .set("Cookie", cookieFor(owner))
      .buffer(true)
      .parse((res, callback) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => callback(null, Buffer.concat(chunks)));
      });
    expect(download.status).toBe(200);
    expect(download.headers["content-type"]).toContain("image/png");
    expect((download.body as Buffer).equals(TINY_PNG)).toBe(true);
  });
});

describe("Built UI served by the API (CLIENT_DIST_DIR)", () => {
  const distDir = fs.mkdtempSync(path.join(os.tmpdir(), "toktickit-dist-"));
  let spaApp: ReturnType<typeof createApp>;

  beforeAll(() => {
    fs.writeFileSync(path.join(distDir, "index.html"), "<!doctype html><html><body>TokTickIT</body></html>");
    process.env.CLIENT_DIST_DIR = distDir;
    spaApp = createApp();
    delete process.env.CLIENT_DIST_DIR;
  });

  afterAll(() => {
    fs.rmSync(distDir, { recursive: true, force: true });
  });

  it("returns index.html for a page of the React app", async () => {
    const response = await request(spaApp).get("/tickets/12");

    expect(response.status).toBe(200);
    expect(response.text).toContain("TokTickIT");
  });

  it("does not answer unknown API paths with the HTML page", async () => {
    const response = await request(spaApp).get("/api/does-not-exist");

    expect(response.status).toBe(404);
    expect(response.text).not.toContain("TokTickIT");
  });

  it("still serves the API", async () => {
    const response = await request(spaApp).get("/api/health");

    expect(response.status).toBe(200);
    expect(response.body.status).toBe("ok");
  });
});
