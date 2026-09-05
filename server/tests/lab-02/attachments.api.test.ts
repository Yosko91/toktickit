import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";
import { cleanupRequesters, createTestRequester, getSeededCategory, getSeededRelatedSystem } from "./helpers.js";

const app = createApp();

// A minimal valid 1x1 PNG, small enough to stay well under the 5 MB limit.
const TINY_PNG = Buffer.from(
  "89504e470d0a1a0a0000000d4948445200000001000000010802000000907753de0000000c4944415478" +
    "9c63f8cfc00000030101001830900000000049454e44ae426082",
  "hex"
);

async function createOwnedTicket(requesterId: number) {
  const category = await getSeededCategory("Hardware");
  const relatedSystem = await getSeededRelatedSystem();
  return getPrisma().ticket.create({
    data: {
      ticketNumber: `TKT-TEST-ATT-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
      requesterId,
      categoryId: category.id,
      relatedSystemId: relatedSystem.id,
      summary: "Attachment test ticket",
      description: "Description long enough to pass validation for this seeded test fixture.",
      requestedPriority: "MEDIUM",
    },
  });
}

describe("Attachment lifecycle", () => {
  let owner: number;
  let stranger: number;

  beforeAll(async () => {
    owner = (await createTestRequester()).id;
    stranger = (await createTestRequester()).id;
  });

  afterAll(async () => {
    await cleanupRequesters([owner, stranger]);
  });

  describe("POST /api/tickets/:id/attachments", () => {
    let ticketId: number;

    beforeEach(async () => {
      ticketId = (await createOwnedTicket(owner)).id;
    });

    // API-18 - AC-14
    it("uploads a valid PNG under 5 MB as an active attachment", async () => {
      const response = await request(app)
        .post(`/api/tickets/${ticketId}/attachments`)
        .set("X-Dev-Requester-Id", String(owner))
        .attach("file", TINY_PNG, { filename: "photo.png", contentType: "image/png" });

      expect(response.status).toBe(201);
      expect(response.body.mimeType).toBe("image/png");
      expect(response.body.removedAt).toBeNull();
    });

    // API-20 - AC-16
    it("rejects a disallowed file type with 415", async () => {
      const response = await request(app)
        .post(`/api/tickets/${ticketId}/attachments`)
        .set("X-Dev-Requester-Id", String(owner))
        .attach("file", Buffer.from("not really an executable"), {
          filename: "tool.exe",
          contentType: "application/x-msdownload",
        });

      expect(response.status).toBe(415);
    });

    // API-19 - AC-15
    it("rejects a file over 5 MB with 413", async () => {
      const big = Buffer.alloc(5 * 1024 * 1024 + 1, 1);
      const response = await request(app)
        .post(`/api/tickets/${ticketId}/attachments`)
        .set("X-Dev-Requester-Id", String(owner))
        .attach("file", big, { filename: "big.png", contentType: "image/png" });

      expect(response.status).toBe(413);
    });

    // API-21 - AC-17
    it("rejects a 6th active attachment on the same ticket with 409", async () => {
      for (let i = 0; i < 5; i += 1) {
        const response = await request(app)
          .post(`/api/tickets/${ticketId}/attachments`)
          .set("X-Dev-Requester-Id", String(owner))
          .attach("file", TINY_PNG, { filename: `photo-${i}.png`, contentType: "image/png" });
        expect(response.status).toBe(201);
      }

      const sixth = await request(app)
        .post(`/api/tickets/${ticketId}/attachments`)
        .set("X-Dev-Requester-Id", String(owner))
        .attach("file", TINY_PNG, { filename: "photo-6.png", contentType: "image/png" });

      expect(sixth.status).toBe(409);
    });

    // API-22 - AC-03
    it("rejects an upload to a ticket owned by another requester with 404", async () => {
      const response = await request(app)
        .post(`/api/tickets/${ticketId}/attachments`)
        .set("X-Dev-Requester-Id", String(stranger))
        .attach("file", TINY_PNG, { filename: "photo.png", contentType: "image/png" });

      expect(response.status).toBe(404);
    });
  });

  describe("GET /api/attachments/:id/download, DELETE /api/attachments/:id", () => {
    let ticketId: number;
    let attachmentId: number;

    beforeEach(async () => {
      ticketId = (await createOwnedTicket(owner)).id;
      const upload = await request(app)
        .post(`/api/tickets/${ticketId}/attachments`)
        .set("X-Dev-Requester-Id", String(owner))
        .attach("file", TINY_PNG, { filename: "photo.png", contentType: "image/png" });
      attachmentId = upload.body.id;
    });

    // API-23 - AC-18
    it("downloads the exact bytes that were uploaded", async () => {
      const response = await request(app)
        .get(`/api/attachments/${attachmentId}/download`)
        .set("X-Dev-Requester-Id", String(owner))
        .buffer(true)
        .parse((res, callback) => {
          const chunks: Buffer[] = [];
          res.on("data", (chunk) => chunks.push(chunk));
          res.on("end", () => callback(null, Buffer.concat(chunks)));
        });

      expect(response.status).toBe(200);
      expect(response.headers["content-type"]).toBe("image/png");
      expect(Buffer.compare(response.body as Buffer, TINY_PNG)).toBe(0);
    });

    // API-28 - AC-03
    it("rejects a download by a non-owning requester with 404", async () => {
      const response = await request(app)
        .get(`/api/attachments/${attachmentId}/download`)
        .set("X-Dev-Requester-Id", String(stranger));

      expect(response.status).toBe(404);
    });

    // API-24 - AC-19
    it("soft-removes an attachment given a valid reason", async () => {
      const response = await request(app)
        .delete(`/api/attachments/${attachmentId}`)
        .set("X-Dev-Requester-Id", String(owner))
        .send({ reason: "Wrong screenshot, replaced by the correct one" });

      expect(response.status).toBe(200);
      expect(response.body.removedAt).not.toBeNull();
      expect(response.body.removedReason).toBe("Wrong screenshot, replaced by the correct one");
    });

    // API-25
    it("rejects removal with a reason shorter than 3 characters", async () => {
      const response = await request(app)
        .delete(`/api/attachments/${attachmentId}`)
        .set("X-Dev-Requester-Id", String(owner))
        .send({ reason: "Hi" });

      expect(response.status).toBe(400);
    });

    // API-26 - AC-20
    it("returns 410 (not the file) when downloading a removed attachment", async () => {
      await request(app)
        .delete(`/api/attachments/${attachmentId}`)
        .set("X-Dev-Requester-Id", String(owner))
        .send({ reason: "No longer needed for this ticket" });

      const response = await request(app)
        .get(`/api/attachments/${attachmentId}/download`)
        .set("X-Dev-Requester-Id", String(owner));

      expect(response.status).toBe(410);
    });

    // API-27
    it("rejects removing an already-removed attachment with 409", async () => {
      await request(app)
        .delete(`/api/attachments/${attachmentId}`)
        .set("X-Dev-Requester-Id", String(owner))
        .send({ reason: "First removal" });

      const response = await request(app)
        .delete(`/api/attachments/${attachmentId}`)
        .set("X-Dev-Requester-Id", String(owner))
        .send({ reason: "Second removal attempt" });

      expect(response.status).toBe(409);
    });

    it("rejects removal by a non-owning requester with 404", async () => {
      const response = await request(app)
        .delete(`/api/attachments/${attachmentId}`)
        .set("X-Dev-Requester-Id", String(stranger))
        .send({ reason: "Trying to remove someone else's file" });

      expect(response.status).toBe(404);
    });
  });
});
