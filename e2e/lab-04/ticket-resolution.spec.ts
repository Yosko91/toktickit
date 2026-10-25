import fs from "node:fs/promises";
import path from "node:path";
import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import {
  ACCOUNTS,
  STAFF_2,
  actionRow,
  addAction,
  createTicket,
  moveTicketTo,
  settle,
  signInAs,
  signOut,
  ticketIdFor,
  uniqueSummary,
} from "./helpers";

const SHOTS = path.join(__dirname, "..", "..", "artifacts", "lab-04", "screenshots", "ticket-workflow", "desktop");

async function shot(page: Page, name: string) {
  await fs.mkdir(SHOTS, { recursive: true });
  await settle(page);
  await page.screenshot({ path: path.join(SHOTS, `${name}.png`), fullPage: true });
}

async function newClaimedTicket(page: Page, prefix: string) {
  await signInAs(page, ACCOUNTS.requester);
  const ticketNumber = await createTicket(page, uniqueSummary(prefix));
  const ticketId = await ticketIdFor(page, ticketNumber);
  await signOut(page);

  await signInAs(page, ACCOUNTS.staff);
  await page.goto(`/queue/${ticketId}`);
  await page.getByRole("button", { name: /claim/i }).click();
  await expect(page.getByText("Owner saved")).toBeVisible();
  return ticketId;
}

// E2E-02: AC-10, AC-11 and AC-14.
test("E2E-02 the ticket cannot be resolved while work is open, then is resolved with a history", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const ticketId = await newClaimedTicket(page, "E2E Lab4 resolution");

  await moveTicketTo(page, "IN_PROGRESS");
  await expect(page.getByText("Status saved")).toBeVisible();

  await addAction(page, { description: "Order a new power supply", status: "Planned" });

  // AC-10: the gate refuses, the reason is under the control, nothing moves.
  await moveTicketTo(page, "RESOLVED");
  const statusField = page.getByLabel(/current status/i).locator("xpath=..");
  await expect(statusField).toContainText(/completed action/i);
  await shot(page, "gate-refused");
  await expect(page.getByLabel(/current status/i)).toHaveValue("");
  await expect(page.locator(".zen-detail-grid")).toContainText("In Progress");

  // Finish the work, then resolve.
  const row = actionRow(page, "Order a new power supply");
  await row.getByRole("button", { name: /edit action/i }).click();
  const edit = page.getByRole("form", { name: "Edit action" });
  await edit.getByLabel(/^status/i).selectOption({ label: "Completed" });
  await edit.getByLabel(/^result/i).fill("New power supply installed, laptop charges again");
  await edit.getByRole("button", { name: /save action/i }).click();
  await expect(row).toContainText("Completed");

  await moveTicketTo(page, "RESOLVED");
  await expect(page.getByText("Status saved")).toBeVisible();
  await expect(page.locator(".zen-detail-grid")).toContainText("Resolved");

  // AC-14: one row per change, oldest first.
  const history = page.locator(".zen-history-row");
  await expect(history).toHaveCount(2);
  await expect(history.nth(0)).toContainText(/New\s*→\s*to\s*In Progress/);
  await expect(history.nth(1)).toContainText(/In Progress\s*→\s*to\s*Resolved/);
  await shot(page, "resolved-history");
  await signOut(page);

  // The Requester sees Resolved and the same history.
  await signInAs(page, ACCOUNTS.requester);
  await page.goto(`/tickets/${ticketId}`);
  await settle(page);
  await expect(page.locator(".zen-detail-grid")).toContainText("Resolved");
  await expect(page.locator(".zen-history-row")).toHaveCount(2);
});

// E2E-03: AC-13. Two staff members have the same ticket open.
test("E2E-03 a change based on an old version is refused and nothing is overwritten", async ({ page, browser }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const ticketId = await newClaimedTicket(page, "E2E Lab4 conflict");
  // Michael's page now shows the ticket as New, version 2 (after the claim).

  // Emily, in another browser, moves it first.
  const other = await browser.newContext({ baseURL: test.info().project.use.baseURL, locale: "en-US" });
  const emily = await other.newPage();
  await signInAs(emily, STAFF_2);
  await emily.goto(`/queue/${ticketId}`);
  await moveTicketTo(emily, "OPEN");
  await expect(emily.getByText("Status saved")).toBeVisible();
  await other.close();

  // Michael still sees New and tries to cancel it.
  await moveTicketTo(page, "CANCELLED");
  await expect(page.getByText(/changed by someone else/i)).toBeVisible();
  await shot(page, "stale-conflict");

  await page.getByRole("button", { name: /reload the ticket/i }).click();
  await expect(page.locator(".zen-detail-grid")).toContainText("Open");
  await expect(page.locator(".zen-history-row")).toHaveCount(1);
});
