import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";
import { cookieFor, cleanupUsers, createTestRequester } from "../shared/auth.js";

const app = createApp();

// The Lab 2 increment has to keep working now that identity comes from a
// session instead of a header. The Lab 2 suites themselves are the bulk of that
// evidence; this file covers the parts that are specific to the change.
describe("Lab 2 regression under Lab 3 authentication", () => {
  let requesterA: number;
  let requesterB: number;
  let categoryId: number;
  let relatedSystemId: number;

  beforeAll(async () => {
    requesterA = (await createTestRequester()).id;
    requesterB = (await createTestRequester()).id;
    const prisma = getPrisma();
    categoryId = (await prisma.category.findFirstOrThrow({ where: { isActive: true } })).id;
    relatedSystemId = (await prisma.relatedSystem.findFirstOrThrow({ where: { isActive: true } })).id;
  });

  afterAll(async () => {
    await cleanupUsers([requesterA, requesterB]);
  });

  function newTicketBody() {
    return {
      categoryId,
      relatedSystemId,
      summary: "Regression ticket for the session identity",
      description: "Created by the Lab 3 regression suite to prove the Lab 2 flow still works.",
      requestedPriority: "HIGH",
    };
  }

  // API-57 - AC-08, BR-20
  it("creates a ticket from the session identity, copying IT Priority from the request", async () => {
    const response = await request(app)
      .post("/api/tickets")
      .set("Cookie", cookieFor(requesterA))
      .send(newTicketBody());

    expect(response.status).toBe(201);
    expect(response.body.requesterId).toBe(requesterA);
    expect(response.body.itPriority).toBe("HIGH");
    expect(response.body.requestedPriority).toBe("HIGH");
    expect(response.body.ownerId).toBeNull();
  });

  // API-58 - AC-08
  it("lists only the session user's own tickets", async () => {
    await request(app)
      .post("/api/tickets")
      .set("Cookie", cookieFor(requesterB))
      .send({ ...newTicketBody(), summary: "Ticket belonging to requester B" });

    const response = await request(app).get("/api/tickets").set("Cookie", cookieFor(requesterA));

    expect(response.status).toBe(200);
    const summaries = response.body.data.map((t: { summary: string }) => t.summary);
    expect(summaries).not.toContain("Ticket belonging to requester B");
  });

  // API-59 - AC-03
  it("hides another requester's ticket behind a 404", async () => {
    const created = await request(app)
      .post("/api/tickets")
      .set("Cookie", cookieFor(requesterB))
      .send(newTicketBody());

    const response = await request(app)
      .get(`/api/tickets/${created.body.id}`)
      .set("Cookie", cookieFor(requesterA));

    expect(response.status).toBe(404);
  });

  // API-60 - AC-08
  it("still uploads, downloads and soft-removes an attachment", async () => {
    const created = await request(app)
      .post("/api/tickets")
      .set("Cookie", cookieFor(requesterA))
      .send(newTicketBody());
    const ticketId = created.body.id;
    const bytes = Buffer.from("regression attachment contents");

    const upload = await request(app)
      .post(`/api/tickets/${ticketId}/attachments`)
      .set("Cookie", cookieFor(requesterA))
      .attach("file", bytes, { filename: "evidence.png", contentType: "image/png" });
    expect(upload.status).toBe(201);

    const download = await request(app)
      .get(`/api/attachments/${upload.body.id}/download`)
      .set("Cookie", cookieFor(requesterA));
    expect(download.status).toBe(200);
    expect(download.body).toEqual(bytes);

    const removal = await request(app)
      .delete(`/api/attachments/${upload.body.id}`)
      .set("Cookie", cookieFor(requesterA))
      .send({ reason: "Uploaded the wrong screenshot" });
    expect(removal.status).toBe(200);

    const afterRemoval = await request(app)
      .get(`/api/attachments/${upload.body.id}/download`)
      .set("Cookie", cookieFor(requesterA));
    expect(afterRemoval.status).toBe(410);
  });

  // API-61 - AC-24, BR-39, BR-41
  it("kept every ticket, requester and attachment across the table rename", async () => {
    const prisma = getPrisma();

    // The Lab 2 seeded Requesters must still be there, as the same rows. If the
    // migration had dropped and recreated the table instead of renaming it,
    // these would either be gone or would have new ids that no ticket points at.
    const originalRequesters = await prisma.user.findMany({
      where: {
        email: {
          in: [
            "jennifer.anderson@toktickit.dev",
            "sarah.johnson@toktickit.dev",
            "david.lee@toktickit.dev",
            "priya.nair@toktickit.dev",
          ],
        },
      },
    });
    expect(originalRequesters).toHaveLength(4);
    for (const requester of originalRequesters) {
      expect(requester.role).toBe("REQUESTER");
    }

    // Jennifer is the Requester the Lab 2 evidence was captured against, so she
    // is the one whose tickets prove ownership survived.
    const jennifer = originalRequesters.find((u) => u.email === "jennifer.anderson@toktickit.dev")!;
    const herTickets = await prisma.ticket.count({ where: { requesterId: jennifer.id } });
    expect(herTickets).toBeGreaterThan(0);

    // No ticket lost its requester and no attachment lost its ticket: an orphan
    // on either side is what a careless rename would have produced.
    const orphanTickets = await prisma.$queryRaw<{ count: bigint }[]>`
      SELECT count(*) FROM "Ticket" t
      LEFT JOIN "User" u ON u.id = t."requesterId" WHERE u.id IS NULL
    `;
    expect(Number(orphanTickets[0]?.count ?? -1)).toBe(0);

    const orphanAttachments = await prisma.$queryRaw<{ count: bigint }[]>`
      SELECT count(*) FROM "Attachment" a
      LEFT JOIN "Ticket" t ON t.id = a."ticketId" WHERE t.id IS NULL
    `;
    expect(Number(orphanAttachments[0]?.count ?? -1)).toBe(0);

    // BR-41: the backfill is what made the NOT NULL column possible at all, so
    // a null here would mean a ticket slipped past the migration.
    // Raw SQL rather than a Prisma filter: the generated type treats the column
    // as non-nullable, so `itPriority: null` is not expressible and
    // `equals: undefined` silently means "no filter at all".
    const missingItPriority = await prisma.$queryRaw<{ count: bigint }[]>`
      SELECT count(*) FROM "Ticket" WHERE "itPriority" IS NULL
    `;
    expect(Number(missingItPriority[0]?.count ?? -1)).toBe(0);

    // Ticket numbers were not regenerated.
    const sample = await prisma.ticket.findMany({ take: 20, orderBy: { id: "asc" } });
    for (const ticket of sample) {
      expect(ticket.ticketNumber).toMatch(/^TKT-\d{4}-\d{6}$/);
    }
  });
});
