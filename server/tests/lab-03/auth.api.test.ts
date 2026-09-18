import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";
import { SESSION_COOKIE } from "../../src/services/session.js";
import { TEST_PASSWORD, cleanupUsers, createTestUser } from "../shared/auth.js";

const app = createApp();

/** Pulls the session cookie out of a login response, as a browser would. */
function sessionCookie(response: request.Response): string {
  const raw = response.headers["set-cookie"] as unknown as string[] | undefined;
  const header = (raw ?? []).find((c) => c.startsWith(`${SESSION_COOKIE}=`));
  return header ? (header.split(";")[0] ?? "") : "";
}

async function login(email: string, password = TEST_PASSWORD) {
  return request(app).post("/api/auth/login").send({ email, password });
}

describe("Lab 3 authentication", () => {
  let activeUser: Awaited<ReturnType<typeof createTestUser>>;
  let inactiveUser: Awaited<ReturnType<typeof createTestUser>>;
  let flaggedUser: Awaited<ReturnType<typeof createTestUser>>;

  beforeAll(async () => {
    activeUser = await createTestUser({ role: "REQUESTER" });
    inactiveUser = await createTestUser({ role: "REQUESTER", isActive: false });
    flaggedUser = await createTestUser({ role: "REQUESTER", mustChangePassword: true });
  });

  afterAll(async () => {
    await cleanupUsers([activeUser?.id, inactiveUser?.id, flaggedUser?.id]);
  });

  // API-01 - AC-01
  it("signs in an active user and returns the identity without any password field", async () => {
    const response = await login(activeUser.email);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      id: activeUser.id,
      email: activeUser.email,
      role: "REQUESTER",
      mustChangePassword: false,
    });
    expect(sessionCookie(response)).not.toBe("");
    // BR-38: no password material may appear anywhere in the body.
    expect(JSON.stringify(response.body)).not.toMatch(/password[Hh]ash|\$2[aby]\$/);
  });

  // API-02, API-03, API-04 - AC-05, BR-05
  it("answers with one identical generic message for every kind of login failure", async () => {
    const wrongPassword = await login(activeUser.email, "WrongPass!23");
    const unknownEmail = await login("nobody-at-all@toktickit.test");
    const inactiveAccount = await login(inactiveUser.email);

    for (const response of [wrongPassword, unknownEmail, inactiveAccount]) {
      expect(response.status).toBe(401);
      expect(response.body.error).toBe("Invalid email or password");
    }
    // The three responses must be indistinguishable, otherwise the endpoint
    // becomes a way to discover which email addresses have accounts.
    expect(wrongPassword.body).toEqual(unknownEmail.body);
    expect(unknownEmail.body).toEqual(inactiveAccount.body);
  });

  it("rejects a login with a missing email or password", async () => {
    const response = await request(app).post("/api/auth/login").send({ email: activeUser.email });

    expect(response.status).toBe(400);
  });

  // API-05 - AC-01, FR-03
  it("returns the current user for a valid session", async () => {
    const cookie = sessionCookie(await login(activeUser.email));

    const response = await request(app).get("/api/auth/me").set("Cookie", cookie);

    expect(response.status).toBe(200);
    expect(response.body.id).toBe(activeUser.id);
    expect(response.body.role).toBe("REQUESTER");
  });

  // API-06 - BR-12
  it("answers 401 for the current user with no cookie", async () => {
    const response = await request(app).get("/api/auth/me");

    expect(response.status).toBe(401);
  });

  // API-07 - AC-06, BR-08
  it("invalidates the session on logout, so a replayed cookie stops working", async () => {
    const cookie = sessionCookie(await login(activeUser.email));

    const logout = await request(app).post("/api/auth/logout").set("Cookie", cookie);
    expect(logout.status).toBe(204);

    const replay = await request(app).get("/api/auth/me").set("Cookie", cookie);
    expect(replay.status).toBe(401);
  });

  // API-08 - AC-07, BR-06
  it("refuses a new password that fails the complexity rule, leaving the old one working", async () => {
    const user = await createTestUser({ role: "REQUESTER" });
    try {
      const cookie = sessionCookie(await login(user.email));

      const change = await request(app)
        .post("/api/auth/change-password")
        .set("Cookie", cookie)
        .send({ currentPassword: TEST_PASSWORD, newPassword: "weakpass" });

      expect(change.status).toBe(400);
      expect(change.body.details.newPassword).toBeDefined();
      expect((await login(user.email)).status).toBe(200);
    } finally {
      await cleanupUsers([user.id]);
    }
  });

  // API-09 - AC-07
  it("refuses a password change when the current password is wrong", async () => {
    const cookie = sessionCookie(await login(activeUser.email));

    const response = await request(app)
      .post("/api/auth/change-password")
      .set("Cookie", cookie)
      .send({ currentPassword: "NotMyPass!23", newPassword: "BrandNew!456" });

    expect(response.status).toBe(400);
    expect(response.body.details.currentPassword).toBeDefined();
    expect((await login(activeUser.email)).status).toBe(200);
  });

  it("refuses a new password identical to the current one", async () => {
    const cookie = sessionCookie(await login(activeUser.email));

    const response = await request(app)
      .post("/api/auth/change-password")
      .set("Cookie", cookie)
      .send({ currentPassword: TEST_PASSWORD, newPassword: TEST_PASSWORD });

    expect(response.status).toBe(400);
  });

  // API-10, API-11 - AC-02, BR-02
  it("blocks a flagged account from the application until the password is changed", async () => {
    const cookie = sessionCookie(await login(flaggedUser.email));

    const blocked = await request(app).get("/api/tickets").set("Cookie", cookie);
    expect(blocked.status).toBe(403);
    expect(blocked.body.code).toBe("PASSWORD_CHANGE_REQUIRED");

    // The account can still read who it is, which is how the client knows to
    // show the change-password screen instead of an error.
    const me = await request(app).get("/api/auth/me").set("Cookie", cookie);
    expect(me.status).toBe(200);
    expect(me.body.mustChangePassword).toBe(true);

    const change = await request(app)
      .post("/api/auth/change-password")
      .set("Cookie", cookie)
      .send({ currentPassword: TEST_PASSWORD, newPassword: "Changed!2026" });

    expect(change.status).toBe(200);
    expect(change.body.mustChangePassword).toBe(false);

    const allowed = await request(app).get("/api/tickets").set("Cookie", cookie);
    expect(allowed.status).toBe(200);
  });

  // API-12 - BR-07
  it("invalidates the user's other sessions when the password changes", async () => {
    const user = await createTestUser({ role: "REQUESTER" });
    try {
      const otherDevice = sessionCookie(await login(user.email));
      const thisDevice = sessionCookie(await login(user.email));
      expect(otherDevice).not.toBe(thisDevice);

      const change = await request(app)
        .post("/api/auth/change-password")
        .set("Cookie", thisDevice)
        .send({ currentPassword: TEST_PASSWORD, newPassword: "Rotated!2026" });
      expect(change.status).toBe(200);

      // The session that performed the change survives; every other one does not.
      expect((await request(app).get("/api/auth/me").set("Cookie", thisDevice)).status).toBe(200);
      expect((await request(app).get("/api/auth/me").set("Cookie", otherDevice)).status).toBe(401);
    } finally {
      await cleanupUsers([user.id]);
    }
  });

  it("treats an expired session as unauthenticated", async () => {
    const user = await createTestUser({ role: "REQUESTER" });
    try {
      const cookie = sessionCookie(await login(user.email));
      const token = cookie.split("=")[1];

      await getPrisma().session.update({
        where: { id: token },
        data: { expiresAt: new Date(Date.now() - 1000) },
      });

      expect((await request(app).get("/api/auth/me").set("Cookie", cookie)).status).toBe(401);
    } finally {
      await cleanupUsers([user.id]);
    }
  });
});
