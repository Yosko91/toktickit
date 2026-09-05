import fs from "node:fs/promises";
import path from "node:path";
import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";
import { REQUESTER_A, REQUESTER_B, createTicket, selectRequester, uniqueSummary } from "./helpers";

// Capture run for the submission evidence (labsheet section 14, Parts 6-8).
// Every screenshot the PDF needs is produced here, so each state is a real
// application state rather than a hand-staged one.
const EVIDENCE_DIR = path.join(
  __dirname,
  "..",
  "..",
  "artifacts",
  "lab-02",
  "screenshots",
  "evidence"
);

async function settled(page: Page) {
  await expect(page.getByText(/loading ticket/i)).toHaveCount(0);
  await page.waitForTimeout(250);
}

async function shoot(page: Page, name: string) {
  await fs.mkdir(EVIDENCE_DIR, { recursive: true });
  await page.screenshot({ path: path.join(EVIDENCE_DIR, `${name}.png`), fullPage: true });
}

const SAMPLE_PNG = path.join(__dirname, "fixtures", "sample.png");
const INVALID_EXE = path.join(__dirname, "fixtures", "installer.exe");

test.describe("Submission evidence capture", () => {
  test("Part 6a - Requester Selection: ready, loading, failure, change requester", async ({ page }) => {
    await page.goto("/select-requester");
    await page.getByLabel(/development requester/i).selectOption({ label: REQUESTER_A });
    await shoot(page, "01-requester-selection-ready");

    // Loading state: hold the active-requester call open long enough to see it.
    const slowPage = await page.context().newPage();
    await slowPage.route("**/api/requesters", async (route) => {
      await new Promise((r) => setTimeout(r, 4000));
      await route.continue();
    });
    await slowPage.goto("/select-requester");
    await expect(slowPage.getByText(/loading development requesters/i)).toBeVisible();
    await shoot(slowPage, "02-requester-selection-loading");
    await slowPage.close();

    // Safe API failure state.
    const failPage = await page.context().newPage();
    await failPage.route("**/api/requesters", (route) => route.abort());
    await failPage.goto("/select-requester");
    await expect(failPage.getByText(/unable to load development requesters/i)).toBeVisible();
    await shoot(failPage, "03-requester-selection-failure");
    await failPage.close();

    // Selected-user display plus the Change Requester action in the shell.
    await page.getByRole("button", { name: /continue/i }).click();
    await page.waitForURL(/\/tickets$/);
    await page.getByRole("button", { name: REQUESTER_A }).click();
    await expect(page.getByRole("button", { name: /change requester/i })).toBeVisible();
    await shoot(page, "04-app-shell-change-requester");
  });

  test("Part 6b - Create Ticket: attachments, submitting, success", async ({ page }) => {
    await selectRequester(page, REQUESTER_A);
    await page.goto("/tickets/new");
    await expect(page.getByLabel(/^category/i)).toBeVisible();

    // One valid and one invalid attachment selected together (BR-22).
    await page.getByLabel(/choose attachment files/i).setInputFiles([SAMPLE_PNG, INVALID_EXE]);
    await expect(page.getByText(/only jpg, png, webp, and pdf files are permitted/i)).toBeVisible();
    await shoot(page, "07-create-ticket-valid-and-invalid-attachment");

    await page.getByLabel(/^category/i).selectOption({ index: 1 });
    await page.getByLabel(/related system/i).selectOption({ index: 1 });
    await page.getByLabel(/ticket summary/i).fill("Cannot connect to VPN from home");
    await page
      .getByLabel(/^description/i)
      .fill(
        "The VPN client fails to connect since this morning. It stops at authenticating and then times out."
      );

    // Submitting (busy) state: hold the create call open while we capture it.
    let holdCreate = true;
    await page.route("**/api/tickets", async (route) => {
      if (route.request().method() !== "POST") {
        await route.continue();
        return;
      }
      while (holdCreate) {
        await new Promise((r) => setTimeout(r, 100));
      }
      await route.continue();
    });

    await page.getByRole("button", { name: /submit ticket/i }).click();
    await expect(page.getByRole("button", { name: /submit ticket/i })).toBeDisabled();
    await shoot(page, "08-create-ticket-submitting");

    holdCreate = false;
    await expect(page.locator(".zen-confirmation-number")).toBeVisible();
    await shoot(page, "10-create-ticket-success");
  });

  test("Part 6c - Create Ticket: API failure keeps the entered values", async ({ page }) => {
    await selectRequester(page, REQUESTER_A);
    await page.goto("/tickets/new");
    await expect(page.getByLabel(/^category/i)).toBeVisible();

    await page.getByLabel(/^category/i).selectOption({ index: 1 });
    await page.getByLabel(/related system/i).selectOption({ index: 1 });
    await page.getByLabel(/ticket summary/i).fill("Printer keeps showing offline");
    await page
      .getByLabel(/^description/i)
      .fill(
        "The shared printer on the third floor shows offline for everyone since the power cut yesterday."
      );

    // Simulate the backend being unreachable.
    await page.route("**/api/tickets", async (route) => {
      if (route.request().method() === "POST") {
        await route.abort();
        return;
      }
      await route.continue();
    });
    await page.getByRole("button", { name: /submit ticket/i }).click();

    await expect(page.getByText(/unable to reach the toktickit server/i)).toBeVisible();
    await expect(page.getByLabel(/ticket summary/i)).toHaveValue("Printer keeps showing offline");
    await shoot(page, "09-create-ticket-api-failure-values-kept");
  });

  test("Part 7 - My Tickets: list, search, filter, sort, pagination, requester switch", async ({ page }) => {
    await selectRequester(page, REQUESTER_A);
    await expect(page.getByText(/showing \d+ to \d+ of \d+ tickets/i)).toBeVisible();
    await shoot(page, "11-my-tickets-requester-a");

    await page.getByLabel(/search by ticket number or summary/i).fill("visual");
    await page.waitForTimeout(700);
    await shoot(page, "12-my-tickets-search");
    await page.getByLabel(/search by ticket number or summary/i).fill("");
    await page.waitForTimeout(700);

    await page.getByLabel(/filter by category/i).selectOption({ index: 1 });
    await page.waitForTimeout(500);
    await shoot(page, "13-my-tickets-filter-category");
    await page.getByRole("button", { name: /clear filters/i }).click();
    await page.waitForTimeout(500);

    await page.getByRole("button", { name: /created date/i }).click();
    await page.waitForTimeout(500);
    await shoot(page, "14-my-tickets-sorted-created-date-asc");

    const nextButton = page.getByRole("button", { name: /^next/i });
    if (await nextButton.isEnabled()) {
      await nextButton.click();
      await page.waitForTimeout(500);
      await shoot(page, "15-my-tickets-page-2");
    }

    // Switch to Requester B: Requester A tickets are no longer listed.
    await page.getByRole("button", { name: REQUESTER_A }).click();
    await page.getByRole("button", { name: /change requester/i }).click();
    await page.waitForURL(/\/select-requester$/);
    await page.getByLabel(/development requester/i).selectOption({ label: REQUESTER_B });
    await page.getByRole("button", { name: /continue/i }).click();
    await page.waitForURL(/\/tickets$/);
    await page.waitForTimeout(700);
    await shoot(page, "16-my-tickets-requester-b-after-switch");
  });

  test("Part 8 - Ticket Detail: attachment added, removed with reason, cross-requester blocked", async ({
    page,
  }) => {
    await selectRequester(page, REQUESTER_A);
    const ticketNumber = await createTicket(page, uniqueSummary("evidence-attachments"));
    await page.getByRole("button", { name: /view ticket/i }).click();
    await page.waitForURL(/\/tickets\/\d+$/);
    const ticketUrl = page.url();

    await page.getByLabel(/choose an attachment file to add/i).setInputFiles(SAMPLE_PNG);
    await expect(page.locator(".zen-attachment-row")).toHaveCount(1);
    await page.getByLabel(/choose an attachment file to add/i).setInputFiles(SAMPLE_PNG);
    await expect(page.locator(".zen-attachment-row")).toHaveCount(2);
    await expect(page.getByText(ticketNumber)).toBeVisible();
    await settled(page);
    await shoot(page, "17-ticket-detail-with-active-attachments");

    await page.locator(".zen-attachment-row").last().getByRole("button", { name: /^remove$/i }).click();
    await page.getByLabel(/reason for removal/i).fill("Uploaded the wrong screenshot by mistake");
    await shoot(page, "18-ticket-detail-remove-dialog-with-reason");

    await page.getByRole("button", { name: /^remove attachment$/i }).click();
    await expect(page.getByText("Removed")).toBeVisible();
    await expect(page.getByText(/uploaded the wrong screenshot by mistake/i)).toBeVisible();
    await settled(page);
    await expect(page.locator(".zen-attachment-row.is-removed")).toBeVisible();
    await shoot(page, "19-ticket-detail-removed-attachment-metadata-kept");

    // Same Ticket, different Requester: rejected as not found.
    await page.getByRole("button", { name: REQUESTER_A }).click();
    await page.getByRole("button", { name: /change requester/i }).click();
    await page.waitForURL(/\/select-requester$/);
    await page.getByLabel(/development requester/i).selectOption({ label: REQUESTER_B });
    await page.getByRole("button", { name: /continue/i }).click();
    await page.waitForURL(/\/tickets$/);
    await page.goto(ticketUrl);
    await expect(page.getByText(/ticket not found/i)).toBeVisible();
    await shoot(page, "20-ticket-detail-other-requester-rejected");
  });

  test("Part 8b - Attachment limit reached disables the Add control", async ({ page }) => {
    await selectRequester(page, REQUESTER_A);
    await createTicket(page, uniqueSummary("evidence-limit"));
    await page.getByRole("button", { name: /view ticket/i }).click();
    await page.waitForURL(/\/tickets\/\d+$/);

    for (let i = 0; i < 5; i += 1) {
      await page.getByLabel(/choose an attachment file to add/i).setInputFiles(SAMPLE_PNG);
      await expect(page.locator(".zen-attachment-row")).toHaveCount(i + 1);
    }

    await expect(page.getByRole("button", { name: /add attachment/i })).toBeDisabled();
    await settled(page);
    await shoot(page, "21-ticket-detail-five-attachment-limit");
  });
});
