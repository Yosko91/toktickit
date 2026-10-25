import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../../src/app.js";
import { cleanupUsers, cookieFor, createTestRequester, createTestStaff } from "../shared/auth.js";
import { newTicket } from "./fixtures.js";

const app = createApp();
const DAY = 24 * 60 * 60 * 1000;

describe("Requester dashboard", () => {
  let requesterId: number;
  let otherRequesterId: number;
  let emptyRequesterId: number;
  let staffId: number;
  const ownIds = new Set<number>();

  beforeAll(async () => {
    requesterId = (await createTestRequester()).id;
    otherRequesterId = (await createTestRequester()).id;
    emptyRequesterId = (await createTestRequester()).id;
    staffId = (await createTestStaff()).id;

    const now = Date.now();
    const own = [
      { currentStatus: "NEW" as const },
      { currentStatus: "OPEN" as const },
      { currentStatus: "WAITING_FOR_REQUESTER" as const, updatedAt: new Date(now - 3 * DAY) },
      { currentStatus: "WAITING_FOR_REQUESTER" as const, updatedAt: new Date(now - 1 * DAY) },
      { currentStatus: "RESOLVED" as const, resolvedAt: new Date(now - 2 * DAY) },
      { currentStatus: "CLOSED" as const, resolvedAt: new Date(now - 40 * DAY) },
      { currentStatus: "CANCELLED" as const },
    ];
    for (const data of own) ownIds.add((await newTicket(requesterId, data)).id);

    // Somebody else's tickets must never be counted (BR-26).
    await newTicket(otherRequesterId, { currentStatus: "NEW" });
    await newTicket(otherRequesterId, { currentStatus: "WAITING_FOR_REQUESTER" });
    await newTicket(otherRequesterId, { currentStatus: "RESOLVED", resolvedAt: new Date() });
  });

  afterAll(async () => {
    await cleanupUsers([requesterId, otherRequesterId, emptyRequesterId, staffId]);
  });

  const get = (userId: number) =>
    request(app).get("/api/dashboard/requester").set("Cookie", cookieFor(userId));
  const metric = (body: { metrics: { key: string; value: number }[] }, key: string) =>
    body.metrics.find((m) => m.key === key)!.value;

  // API-40 - AC-02, BR-26
  it("counts and lists only the Requester's own tickets", async () => {
    const response = await get(requesterId);

    expect(response.status).toBe(200);
    expect(metric(response.body, "active")).toBe(4);
    expect(metric(response.body, "waiting")).toBe(2);
    expect(metric(response.body, "resolved")).toBe(1);
    expect(metric(response.body, "closed")).toBe(1);

    const listed = [
      ...response.body.needsAttention,
      ...response.body.recentlyUpdated,
      ...response.body.recentlyResolved,
    ];
    expect(listed.length).toBeGreaterThan(0);
    expect(listed.every((t: { id: number }) => ownIds.has(t.id))).toBe(true);
  });

  // API-41 - AC-20
  it("answers zeros and empty lists for a Requester with no tickets", async () => {
    const response = await get(emptyRequesterId);

    expect(response.status).toBe(200);
    expect(response.body.metrics.map((m: { value: number }) => m.value)).toEqual([0, 0, 0, 0]);
    expect(response.body.needsAttention).toEqual([]);
    expect(response.body.recentlyUpdated).toEqual([]);
    expect(response.body.recentlyResolved).toEqual([]);
  });

  // API-42 - BR-27, BR-30, BR-32
  it("keeps the lists short, ordered and inside the 30 day window", async () => {
    const response = await get(requesterId);
    const { needsAttention, recentlyUpdated, recentlyResolved } = response.body;

    expect(recentlyUpdated).toHaveLength(5);
    const updated = recentlyUpdated.map((t: { updatedAt: string }) => Date.parse(t.updatedAt));
    expect(updated).toEqual([...updated].sort((a, b) => b - a));

    // Oldest waiting first: it has waited the longest.
    expect(needsAttention).toHaveLength(2);
    expect(Date.parse(needsAttention[0].updatedAt)).toBeLessThan(Date.parse(needsAttention[1].updatedAt));

    // Resolved 2 days ago is in, closed after a resolution 40 days ago is out.
    expect(recentlyResolved.map((t: { currentStatus: string }) => t.currentStatus)).toEqual(["RESOLVED"]);
  });

  // API-43 - AC-18
  it("refuses IT Staff and anonymous callers", async () => {
    expect((await get(staffId)).status).toBe(403);
    expect((await request(app).get("/api/dashboard/requester")).status).toBe(401);
  });

  // API-44 - AC-19
  it("gives links whose filter returns exactly the counted tickets", async () => {
    const dashboard = await get(requesterId);

    for (const m of dashboard.body.metrics as { key: string; value: number; link: string }[]) {
      const query = m.link.split("?")[1];
      const list = await request(app).get(`/api/tickets?${query}&pageSize=50`).set("Cookie", cookieFor(requesterId));
      expect(list.status, m.key).toBe(200);
      expect(list.body.pagination.totalItems, m.key).toBe(m.value);
    }
  });
});
