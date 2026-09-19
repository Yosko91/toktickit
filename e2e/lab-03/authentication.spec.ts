import { expect, test } from "@playwright/test";
import { ACCOUNTS, DEV_PASSWORD, createUserViaApi, signIn, signInAs, signOut } from "./helpers";

test.describe("Authentication", () => {
  // E2E-01 - AC-01, AC-06
  test("E2E-01: sign in, use the application, sign out, and lose access to a direct URL", async ({
    page,
  }) => {
    await signInAs(page, ACCOUNTS.requester);
    await expect(page).toHaveURL(/\/tickets$/);

    // The shell shows who is signed in, not a Development Requester selector.
    await expect(page.getByRole("button", { name: new RegExp(ACCOUNTS.requester.name) })).toBeVisible();
    await expect(page.getByText(/change requester/i)).toHaveCount(0);

    await signOut(page);

    // AC-06: the session is gone, so a protected URL sends the browser back to
    // Login rather than rendering from a cached page.
    await page.goto("/tickets");
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole("button", { name: /sign in/i })).toBeVisible();
  });

  // E2E-03 - AC-05
  test("E2E-03: a refused credential keeps the user on Login with one generic message", async ({
    page,
  }) => {
    await signIn(page, ACCOUNTS.requester.email, "DefinitelyWrong!1");

    await expect(page.getByRole("alert")).toHaveText(/invalid email or password/i);
    await expect(page).toHaveURL(/\/login/);

    // BR-05: an unknown address answers identically, so the screen cannot be
    // used to discover which email addresses have accounts.
    await signIn(page, "nobody-at-all@toktickit.test", DEV_PASSWORD);
    await expect(page.getByRole("alert")).toHaveText(/invalid email or password/i);
  });

  // E2E-02 - AC-02
  test("E2E-02: an initial password forces a change before the application opens", async ({
    page,
    request,
  }) => {
    // A throw-away account, so this test does not permanently clear the flag on
    // a seeded one and can be run as many times as needed.
    const user = await createUserViaApi(request, { role: "REQUESTER" });

    await signIn(page, user.email, user.initialPassword);

    await expect(page).toHaveURL(/\/change-password/);
    await expect(page.getByText(/you must change your password to continue/i)).toBeVisible();

    // BR-02: the rest of the application stays shut until the change is done.
    await page.goto("/tickets");
    await expect(page).toHaveURL(/\/change-password/);

    // The rule checklist is live feedback, and Continue stays shut until it passes.
    const newPassword = page.getByLabel(/^new password$/i);
    await newPassword.fill("short");
    await expect(page.getByRole("button", { name: /continue/i })).toBeDisabled();

    await page.getByLabel(/current \(temporary\) password/i).fill(user.initialPassword);
    await newPassword.fill("Changed!2026");
    await page.getByLabel(/confirm new password/i).fill("Changed!2026");
    await page.getByRole("button", { name: /continue/i }).click();

    // Only now does the normal application open.
    await page.waitForURL(/\/tickets/);
    await expect(page.getByRole("heading", { name: /my tickets/i })).toBeVisible();

    // And the new password is the one that works from now on.
    await signOut(page);
    await signIn(page, user.email, "Changed!2026");
    await page.waitForURL(/\/tickets/);
  });

  test("a signed-in Requester is never offered the staff or administrator screens", async ({
    page,
  }) => {
    await signInAs(page, ACCOUNTS.requester);

    const nav = page.getByRole("navigation", { name: /main navigation/i });
    await expect(nav).toContainText(/my tickets/i);
    await expect(nav).not.toContainText(/ticket queue/i);
    await expect(nav).not.toContainText(/users/i);

    // AC-17/AC-23: and typing the URL does not get around it either.
    await page.goto("/queue");
    await expect(page.getByText(/do not have access/i)).toBeVisible();

    await page.goto("/admin/users");
    await expect(page.getByText(/do not have access/i)).toBeVisible();
  });
});
