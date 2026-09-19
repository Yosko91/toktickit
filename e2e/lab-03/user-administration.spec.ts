import { expect, test } from "@playwright/test";
import { ACCOUNTS, searchAndSettle, settle, signIn, signInAs, signOut } from "./helpers";

test.describe("Administrator user management", () => {
  // E2E-07 - AC-18 to AC-20
  test("E2E-07: an administrator creates an account that must change its password at first login", async ({
    page,
  }) => {
    const suffix = `${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    const email = `e2e-admin-created-${suffix}@toktickit.test`;
    const name = `E2E Created ${suffix}`;
    const initialPassword = "Initial!2026";

    await signInAs(page, ACCOUNTS.admin);
    await page.goto("/admin/users");
    await settle(page);

    // AC-18: the list shows who everybody is.
    await expect(page.getByRole("heading", { name: /^users$/i })).toBeVisible();
    await expect(page.getByText(ACCOUNTS.staff.name).first()).toBeVisible();

    await page.getByRole("button", { name: /create user/i }).click();
    await page.getByLabel(/full name/i).fill(name);
    await page.getByLabel(/email address/i).fill(email);
    await page.locator("#user-role").selectOption("REQUESTER");
    await page.getByLabel(/initial password/i).fill(initialPassword);
    await page.getByRole("button", { name: /save user/i }).click();

    // The success banner specifically: the loading panel also carries
    // role="status", so matching by role alone is a race with the reload.
    await expect(page.locator(".zen-banner-success")).toContainText(/must change the password/i);
    await settle(page);

    // AC-18: search narrows the list down to the new account.
    await searchAndSettle(page, /search users/i, suffix);
    // Scoped to the table: the name also appears in the success banner above it.
    await expect(page.getByRole("row").filter({ hasText: email })).toBeVisible();

    // AC-19: the same email a second time is refused, under the email field.
    await page.getByRole("button", { name: /create user/i }).click();
    await page.getByLabel(/full name/i).fill("Duplicate Person");
    await page.getByLabel(/email address/i).fill(email);
    await page.getByLabel(/initial password/i).fill(initialPassword);
    await page.getByRole("button", { name: /save user/i }).click();
    await expect(page.getByText(/already exists/i)).toBeVisible();

    await page.getByRole("button", { name: "✕" }).click();
    await signOut(page);

    // AC-20: the new account lands on the mandatory change screen.
    await signIn(page, email, initialPassword);
    await expect(page).toHaveURL(/\/change-password/);
    await expect(page.getByText(/you must change your password to continue/i)).toBeVisible();
  });

  // E2E-08 - AC-21, AC-22
  test("E2E-08: an administrator cannot deactivate or demote their own account", async ({
    page,
  }) => {
    await signInAs(page, ACCOUNTS.admin);
    await page.goto("/admin/users");
    await settle(page);

    await searchAndSettle(page, /search users/i, ACCOUNTS.admin.email);
    const ownRow = page.getByRole("row").filter({ hasText: ACCOUNTS.admin.email });
    await expect(ownRow).toBeVisible();
    await ownRow.getByRole("button", { name: /^edit$/i }).click();

    // BR-34: both controls are shut on the administrator's own row, and the
    // screen says why rather than simply refusing silently.
    await expect(page.getByRole("button", { name: /deactivate user/i })).toBeDisabled();
    await expect(page.locator("#user-role")).toBeDisabled();
    await expect(page.getByText(/you cannot deactivate your own account/i)).toBeVisible();
    await expect(page.getByText(/you cannot change your own role/i)).toBeVisible();

    // The account is untouched: still an active administrator after a reload.
    await page.reload();
    await settle(page);
    await searchAndSettle(page, /search users/i, ACCOUNTS.admin.email);
    const row = page.getByRole("row").filter({ hasText: ACCOUNTS.admin.email });
    await expect(row.getByText("Active")).toBeVisible();
    await expect(row.getByText("Administrator")).toBeVisible();
  });

  test("IT Staff are refused user management even by typing the URL", async ({ page }) => {
    await signInAs(page, ACCOUNTS.staff);

    const nav = page.getByRole("navigation", { name: /main navigation/i });
    await expect(nav).not.toContainText(/users/i);

    // AC-23: hiding the link is feedback; the refusal is what matters.
    await page.goto("/admin/users");
    await expect(page.getByText(/do not have access/i)).toBeVisible();
    await expect(page.getByRole("heading", { name: /^users$/i })).toHaveCount(0);
  });
});
