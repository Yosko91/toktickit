import path from "node:path";
import { expect, test } from "@playwright/test";
import { REQUESTER_A, REQUESTER_B, createTicket, selectRequester, uniqueSummary } from "./helpers";

// docs/lab-02/tests.md - E2E-01 to E2E-04. Drives the real running app
// (client + server + PostgreSQL), so these create real Tickets in the dev
// database - see tests.md section 7 "Known Limitations".
test.describe("Requester ticket flow (E2E)", () => {
  test("E2E-01/E2E-02: create a ticket, see its Ticket Number, then find it in My Tickets", async ({
    page,
  }) => {
    await selectRequester(page, REQUESTER_A);

    const summary = uniqueSummary("create-find");
    const ticketNumber = await createTicket(page, summary);
    expect(ticketNumber).toMatch(/^TKT-\d{4}-\d{6}$/);

    await page.getByRole("button", { name: /back to my tickets/i }).click();
    await expect(page).toHaveURL(/\/tickets$/);

    await page.getByLabel(/search by ticket number or summary/i).fill(ticketNumber);
    await expect(page.getByRole("row", { name: ticketNumber })).toBeVisible();
    await expect(page.getByRole("row", { name: ticketNumber })).toContainText(summary);
  });

  test("E2E-03: add an attachment on Ticket Detail, then soft-remove it with a reason", async ({ page }) => {
    await selectRequester(page, REQUESTER_A);
    const ticketNumber = await createTicket(page, uniqueSummary("attachments"));

    await page.getByRole("button", { name: /view ticket/i }).click();
    await expect(page.getByText(ticketNumber)).toBeVisible();

    const fileInput = page.getByLabel(/choose an attachment file to add/i);
    await fileInput.setInputFiles(path.join(__dirname, "fixtures", "sample.png"));

    const attachmentRow = page.locator(".zen-attachment-row").filter({ hasText: "sample.png" });
    await expect(attachmentRow.getByText("Active")).toBeVisible();

    // FR-07/AC-18: download an active attachment.
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      attachmentRow.getByRole("button", { name: /download/i }).click(),
    ]);
    expect(download.suggestedFilename()).toBe("sample.png");

    // BR-27/AC-19: soft removal requires a reason.
    await attachmentRow.getByRole("button", { name: /^remove$/i }).click();
    await page.getByLabel(/reason for removal/i).fill("No longer needed for this test ticket");
    await page.getByRole("button", { name: /^remove attachment$/i }).click();

    await expect(attachmentRow.getByText("Removed")).toBeVisible();
    await expect(attachmentRow.getByText(/no longer needed for this test ticket/i)).toBeVisible();
    // BR-28/AC-20: no download/preview control at all once removed.
    await expect(attachmentRow.getByRole("button", { name: /download/i })).toHaveCount(0);
  });

  test("E2E-05: an attachment selected on Create Ticket is uploaded with the new ticket", async ({ page }) => {
    await selectRequester(page, REQUESTER_A);

    await page.goto("/tickets/new");
    await expect(page.getByLabel(/^category/i)).toBeVisible();
    await page.getByLabel(/choose attachment files/i).setInputFiles(path.join(__dirname, "fixtures", "sample.png"));
    await expect(page.locator(".zen-attachment-row").filter({ hasText: "sample.png" })).toBeVisible();

    await page.getByLabel(/^category/i).selectOption({ index: 1 });
    await page.getByLabel(/related system/i).selectOption({ index: 1 });
    await page.getByLabel(/ticket summary/i).fill(uniqueSummary("with-attachment"));
    await page
      .getByLabel(/^description/i)
      .fill("This ticket is created with one attachment already selected on the create form.");
    await page.getByRole("button", { name: /submit ticket/i }).click();

    await expect(page.locator(".zen-confirmation-number")).toBeVisible();
    await page.getByRole("button", { name: /view ticket/i }).click();
    await page.waitForURL(/\/tickets\/\d+$/);

    // BR-25: the staged file is uploaded right after the Ticket is created.
    const uploadedRow = page.locator(".zen-attachment-row").filter({ hasText: "sample.png" });
    await expect(uploadedRow).toBeVisible();
    await expect(uploadedRow.getByText("Active", { exact: true })).toBeVisible();
  });

  // Lab 2 switched Development Requester through the selector. Lab 3 removed
  // it (BR-42), so the same guarantee is now proved by signing out and signing
  // in as somebody else. The assertion that matters is unchanged: a direct URL
  // to another Requester's ticket is refused, not merely hidden from the menu.
  test("E2E-04: another Requester cannot open the first Requester's ticket by URL", async ({ page }) => {
    await selectRequester(page, REQUESTER_A);
    await createTicket(page, uniqueSummary("ownership"));

    await page.getByRole("button", { name: /view ticket/i }).click();
    await page.waitForURL(/\/tickets\/\d+$/);
    const ticketDetailUrl = page.url();

    await page.getByRole("button", { name: /👤/ }).click();
    await page.getByRole("button", { name: /^logout$/i }).click();
    await page.waitForURL(/\/login/);

    await selectRequester(page, REQUESTER_B);
    await expect(page).toHaveURL(/\/tickets$/);

    // AC-03/BR-13: rejected as "not found", which does not confirm the id exists.
    await page.goto(ticketDetailUrl);
    await expect(page.getByText(/ticket not found/i)).toBeVisible();
  });
});
