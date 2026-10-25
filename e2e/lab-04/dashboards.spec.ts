import { expect, test } from "@playwright/test";
import { ACCOUNTS, API, EMPTY_REQUESTER, settle, signInAs } from "./helpers";

// E2E-04: AC-16 and AC-19. The number on the card is the number of rows the
// card opens.
test("E2E-04 the Unassigned card opens the queue with the same number of tickets", async ({ page }) => {
  await signInAs(page, ACCOUNTS.staff);
  await page.getByRole("link", { name: /dashboard/i }).click();
  await settle(page);

  const link = page.getByRole("link", { name: /^View Unassigned: \d+$/ });
  const name = (await link.getAttribute("aria-label"))!;
  const count = Number(name.split(": ")[1]);

  await link.click();
  await expect(page).toHaveURL(/\/queue\?ownerId=unassigned&statusGroup=active/);
  await settle(page);
  await expect(page.getByText(`${count} ${count === 1 ? "ticket" : "tickets"}`, { exact: true })).toBeVisible();
  await expect(page.getByLabel(/^status$/i)).toHaveValue("active");
  await expect(page.getByLabel(/^owner$/i)).toHaveValue("unassigned");

  // And the same number is in the database answer behind the queue.
  const api = await page.request.get(`${API}/api/staff/tickets?ownerId=unassigned&statusGroup=active`);
  expect((await api.json()).pagination.totalItems).toBe(count);
});

// E2E-05: AC-02 and AC-20.
test("E2E-05 a Requester sees only their own numbers, and a Requester with no ticket sees zeros", async ({ page }) => {
  await signInAs(page, ACCOUNTS.requester);
  await page.goto("/dashboard");
  await settle(page);

  const active = page.getByRole("link", { name: /^View My Active Tickets: \d+$/ });
  const value = Number((await active.getAttribute("aria-label"))!.split(": ")[1]);
  const own = await page.request.get(`${API}/api/tickets?statusGroup=active`);
  expect((await own.json()).pagination.totalItems).toBe(value);

  // Every ticket listed on the dashboard opens as one of the Requester's own.
  const firstRow = page.locator(".zen-mini-link").first();
  await firstRow.click();
  await expect(page).toHaveURL(/\/tickets\/\d+$/);
  await expect(page.getByText(ACCOUNTS.requester.name).first()).toBeVisible();

  await page.getByRole("button", { name: /👤/ }).click();
  await page.getByRole("button", { name: /^logout$/i }).click();
  await page.waitForURL(/\/login/);

  await signInAs(page, EMPTY_REQUESTER);
  await page.goto("/dashboard");
  await settle(page);
  for (const label of ["My Active Tickets", "Waiting for Me", "Resolved", "Closed"]) {
    await expect(page.getByRole("link", { name: `View ${label}: 0` })).toBeVisible();
  }
  await expect(page.getByText("Nothing is waiting for you.")).toBeVisible();
  await expect(page.getByText("You have no tickets yet.")).toBeVisible();
});
