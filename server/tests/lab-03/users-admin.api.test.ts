import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";
import { SESSION_COOKIE } from "../../src/services/session.js";
import {
  cookieFor,
  cleanupUsers,
  createTestAdmin,
  createTestRequester,
  uniqueSuffix,
} from "../shared/auth.js";

const app = createApp();

describe("Administrator user management", () => {
  let adminId: number;
  let otherAdminId: number;
  let requesterId: number;
  const created: number[] = [];

  beforeAll(async () => {
    adminId = (await createTestAdmin()).id;
    otherAdminId = (await createTestAdmin()).id;
    requesterId = (await createTestRequester()).id;
  });

  afterAll(async () => {
    await cleanupUsers([adminId, otherAdminId, requesterId, ...created]);
  });

  const asAdmin = () => cookieFor(adminId);

  function newUserBody(overrides: Record<string, unknown> = {}) {
    return {
      name: "Alex Thompson",
      email: `alex.thompson-${uniqueSuffix()}@toktickit.test`,
      role: "IT_STAFF",
      isActive: true,
      initialPassword: "Initial!2026",
      ...overrides,
    };
  }

  async function createUser(overrides: Record<string, unknown> = {}) {
    const response = await request(app)
      .post("/api/admin/users")
      .set("Cookie", asAdmin())
      .send(newUserBody(overrides));
    if (response.status === 201) created.push(response.body.id);
    return response;
  }

  // API-46 - AC-18
  it("lists users with name, email, role and status, and never a password hash", async () => {
    const response = await request(app).get("/api/admin/users").set("Cookie", asAdmin());

    expect(response.status).toBe(200);
    expect(response.body.length).toBeGreaterThan(0);
    for (const user of response.body) {
      expect(user).toHaveProperty("name");
      expect(user).toHaveProperty("email");
      expect(user).toHaveProperty("role");
      expect(user).toHaveProperty("isActive");
    }
    // API-56 - BR-38
    expect(JSON.stringify(response.body)).not.toMatch(/passwordHash|\$2[aby]\$/);
  });

  // API-47 - AC-18
  it("narrows the list by search and by role", async () => {
    const marker = uniqueSuffix();
    const created1 = await createUser({ name: `Searchable ${marker}`, role: "IT_STAFF" });
    expect(created1.status).toBe(201);

    const bySearch = await request(app)
      .get(`/api/admin/users?search=${marker}`)
      .set("Cookie", asAdmin());
    expect(bySearch.status).toBe(200);
    expect(bySearch.body).toHaveLength(1);
    expect(bySearch.body[0].name).toContain(marker);

    const byRole = await request(app)
      .get("/api/admin/users?role=ADMINISTRATOR")
      .set("Cookie", asAdmin());
    expect(byRole.status).toBe(200);
    for (const user of byRole.body) {
      expect(user.role).toBe("ADMINISTRATOR");
    }
  });

  it("rejects an unknown role filter", async () => {
    const response = await request(app)
      .get("/api/admin/users?role=SUPERUSER")
      .set("Cookie", asAdmin());

    expect(response.status).toBe(400);
  });

  // API-48 - BR-32
  it("creates a user who must change the password at first login", async () => {
    const response = await createUser({ role: "REQUESTER" });

    expect(response.status).toBe(201);
    expect(response.body.role).toBe("REQUESTER");
    expect(response.body.mustChangePassword).toBe(true);
    expect(response.body.isActive).toBe(true);
  });

  // API-49 - AC-19, BR-33
  it("refuses a duplicate email address and creates nothing", async () => {
    const first = await createUser();
    expect(first.status).toBe(201);

    const before = await getPrisma().user.count();
    const second = await request(app)
      .post("/api/admin/users")
      .set("Cookie", asAdmin())
      .send(newUserBody({ email: first.body.email }));

    expect(second.status).toBe(409);
    expect(second.body.details.email).toBeDefined();
    expect(await getPrisma().user.count()).toBe(before);
  });

  it("matches a duplicate email regardless of case", async () => {
    const first = await createUser();

    const second = await request(app)
      .post("/api/admin/users")
      .set("Cookie", asAdmin())
      .send(newUserBody({ email: String(first.body.email).toUpperCase() }));

    expect(second.status).toBe(409);
  });

  // API-50 - BR-06
  it("refuses a weak initial password and creates nothing", async () => {
    const before = await getPrisma().user.count();

    const response = await request(app)
      .post("/api/admin/users")
      .set("Cookie", asAdmin())
      .send(newUserBody({ initialPassword: "password" }));

    expect(response.status).toBe(400);
    expect(response.body.details.initialPassword).toBeDefined();
    expect(await getPrisma().user.count()).toBe(before);
  });

  it("refuses an invalid email address or an unknown role", async () => {
    const badEmail = await request(app)
      .post("/api/admin/users")
      .set("Cookie", asAdmin())
      .send(newUserBody({ email: "not-an-email" }));
    expect(badEmail.status).toBe(400);
    expect(badEmail.body.details.email).toBeDefined();

    const badRole = await request(app)
      .post("/api/admin/users")
      .set("Cookie", asAdmin())
      .send(newUserBody({ role: "SUPERUSER" }));
    expect(badRole.status).toBe(400);
    expect(badRole.body.details.role).toBeDefined();
  });

  it("updates the name, email, role and activation state", async () => {
    const user = await createUser();
    const newEmail = `renamed-${uniqueSuffix()}@toktickit.test`;

    const response = await request(app)
      .patch(`/api/admin/users/${user.body.id}`)
      .set("Cookie", asAdmin())
      .send({ name: "Renamed Person", email: newEmail, role: "REQUESTER", isActive: false });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      name: "Renamed Person",
      email: newEmail,
      role: "REQUESTER",
      isActive: false,
    });
  });

  // API-51 - BR-33
  it("refuses an edit that would take another user's email address", async () => {
    const first = await createUser();
    const second = await createUser();

    const response = await request(app)
      .patch(`/api/admin/users/${second.body.id}`)
      .set("Cookie", asAdmin())
      .send({ email: first.body.email });

    expect(response.status).toBe(409);
  });

  // API-52 - AC-22, BR-34
  it("refuses an administrator deactivating their own account", async () => {
    const response = await request(app)
      .patch(`/api/admin/users/${adminId}`)
      .set("Cookie", asAdmin())
      .send({ isActive: false });

    expect(response.status).toBe(403);
    const after = await getPrisma().user.findUniqueOrThrow({ where: { id: adminId } });
    expect(after.isActive).toBe(true);
  });

  it("refuses an administrator changing their own role", async () => {
    const response = await request(app)
      .patch(`/api/admin/users/${adminId}`)
      .set("Cookie", asAdmin())
      .send({ role: "REQUESTER" });

    expect(response.status).toBe(403);
  });

  // API-53, API-54 - AC-21, BR-35
  //
  // Worth stating plainly, because it changed how this is tested: with BR-34 in
  // place the sequential version of this rule is unreachable through the API.
  // Only an active Administrator can call the endpoint, so if exactly one active
  // Administrator exists, the only account that could deactivate it is itself,
  // and BR-34 refuses that first. BR-35 therefore only ever bites when two
  // Administrators act at the same time, each deactivating the other, and that
  // is what this test does.
  it("cannot be raced into leaving the system with no active administrator", async () => {
    const prisma = getPrisma();

    const alice = await createTestAdmin();
    const bob = await createTestAdmin();
    created.push(alice.id, bob.id);

    // Park every other active administrator, so that Alice and Bob really are
    // the last two and the count the rule checks is meaningful. Restored in
    // the finally block whatever happens.
    const others = await prisma.user.findMany({
      where: { role: "ADMINISTRATOR", isActive: true, NOT: { id: { in: [alice.id, bob.id] } } },
      select: { id: true },
    });
    const parkedIds = others.map((u) => u.id);
    await prisma.user.updateMany({ where: { id: { in: parkedIds } }, data: { isActive: false } });

    try {
      const deactivate = (actorId: number, targetId: number) =>
        request(app)
          .patch(`/api/admin/users/${targetId}`)
          .set("Cookie", cookieFor(actorId))
          .send({ isActive: false });

      // Each one tries to deactivate the other at the same moment. Read then
      // write would let both see one administrator remaining and both proceed.
      const [first, second] = await Promise.all([
        deactivate(alice.id, bob.id),
        deactivate(bob.id, alice.id),
      ]);

      const succeeded = [first, second].filter((r) => r.status === 200);
      expect(succeeded.length).toBeLessThanOrEqual(1);

      // Whatever the outcome of the race, the invariant has to hold.
      const activeAdmins = await prisma.user.count({
        where: { role: "ADMINISTRATOR", isActive: true },
      });
      expect(activeAdmins).toBeGreaterThanOrEqual(1);
    } finally {
      await prisma.user.updateMany({ where: { id: { in: parkedIds } }, data: { isActive: true } });
      await prisma.user.updateMany({
        where: { id: { in: [alice.id, bob.id] } },
        data: { isActive: true },
      });
    }
  });

  // API-55 - AC-20, BR-37
  it("sets a new initial password, ends the user's sessions and forces a change at next login", async () => {
    const user = await createUser({ role: "REQUESTER" });
    const userId = user.body.id;

    // Sign the user in so there is a live session for the reset to destroy.
    const signIn = await request(app)
      .post("/api/auth/login")
      .send({ email: user.body.email, password: "Initial!2026" });
    expect(signIn.status).toBe(200);
    const raw = signIn.headers["set-cookie"] as unknown as string[];
    const oldCookie = raw.find((c) => c.startsWith(`${SESSION_COOKIE}=`))!.split(";")[0]!;

    const reset = await request(app)
      .post(`/api/admin/users/${userId}/initial-password`)
      .set("Cookie", asAdmin())
      .send({ initialPassword: "Reset!2026x" });

    expect(reset.status).toBe(200);
    expect(reset.body.mustChangePassword).toBe(true);

    // The old session is gone.
    expect((await request(app).get("/api/auth/me").set("Cookie", oldCookie)).status).toBe(401);

    // The new password works, and lands on the mandatory change.
    const again = await request(app)
      .post("/api/auth/login")
      .send({ email: user.body.email, password: "Reset!2026x" });
    expect(again.status).toBe(200);
    expect(again.body.mustChangePassword).toBe(true);
  });

  it("refuses a weak new initial password", async () => {
    const user = await createUser();

    const response = await request(app)
      .post(`/api/admin/users/${user.body.id}/initial-password`)
      .set("Cookie", asAdmin())
      .send({ initialPassword: "abc" });

    expect(response.status).toBe(400);
  });

  // BR-36
  it("does not delete users", async () => {
    const user = await createUser();

    const response = await request(app)
      .delete(`/api/admin/users/${user.body.id}`)
      .set("Cookie", asAdmin());

    expect(response.status).toBe(405);
    expect(await getPrisma().user.findUnique({ where: { id: user.body.id } })).not.toBeNull();
  });

  it("answers 404 for an unknown user id", async () => {
    const response = await request(app)
      .patch("/api/admin/users/99999999")
      .set("Cookie", asAdmin())
      .send({ name: "Nobody" });

    expect(response.status).toBe(404);
  });

  it("keeps a deactivated user's tickets and history", async () => {
    const response = await request(app)
      .patch(`/api/admin/users/${requesterId}`)
      .set("Cookie", asAdmin())
      .send({ isActive: false });

    expect(response.status).toBe(200);
    // BR-36: deactivation is not deletion, so the row is still there.
    expect(await getPrisma().user.findUnique({ where: { id: requesterId } })).not.toBeNull();

    await request(app)
      .patch(`/api/admin/users/${requesterId}`)
      .set("Cookie", asAdmin())
      .send({ isActive: true });
  });
});
