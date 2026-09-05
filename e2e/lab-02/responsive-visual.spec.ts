import fs from "node:fs/promises";
import path from "node:path";
import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";
import { REQUESTER_A, VIEWPORTS, createTicket, selectRequester, uniqueSummary } from "./helpers";

// docs/lab-02/tests.md VIS-01/VIS-02 and docs/lab-02/ui-spec.md section 14.
const ARTIFACTS_ROOT = path.join(__dirname, "..", "..", "artifacts", "lab-02", "screenshots");

// AC-23: no horizontal page scrolling at any of the three required widths.
async function assertNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => {
    const doc = document.documentElement;
    return doc.scrollWidth - doc.clientWidth;
  });
  expect(overflow, "page should not scroll horizontally").toBeLessThanOrEqual(1);
}

async function shoot(page: Page, screen: string, viewportName: string, stateName: string) {
  const dir = path.join(ARTIFACTS_ROOT, screen, viewportName);
  await fs.mkdir(dir, { recursive: true });
  await page.screenshot({ path: path.join(dir, `${stateName}.png`), fullPage: true });
}

test.describe("Responsive and visual evidence", () => {
  let ticketNumber: string;
  let ticketDetailPath: string;

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    await selectRequester(page, REQUESTER_A);
    ticketNumber = await createTicket(page, uniqueSummary("visual-evidence"));
    await page.getByRole("button", { name: /view ticket/i }).click();
    await page.waitForURL(/\/tickets\/\d+$/);
    ticketDetailPath = new URL(page.url()).pathname;
    await page.close();
  });

  for (const [viewportName, size] of Object.entries(VIEWPORTS)) {
    test(`Create Ticket - ${viewportName}`, async ({ page }) => {
      await page.setViewportSize(size);
      await selectRequester(page, REQUESTER_A);
      await page.goto("/tickets/new");
      await expect(page.getByLabel(/^category/i)).toBeVisible(); // past the reference-data loading state

      await shoot(page, "create-ticket", viewportName, "initial");
      await assertNoHorizontalOverflow(page);

      // Validation failure state (AC-04/AC-05).
      await page.getByRole("button", { name: /submit ticket/i }).click();
      await expect(page.locator(".zen-field--error").first()).toBeVisible();
      await shoot(page, "create-ticket", viewportName, "validation-failure");
      await assertNoHorizontalOverflow(page);

      // Success state (AC-01/AC-25).
      await page.getByLabel(/^category/i).selectOption({ index: 1 });
      await page.getByLabel(/related system/i).selectOption({ index: 1 });
      await page.getByLabel(/ticket summary/i).fill(uniqueSummary("visual"));
      await page
        .getByLabel(/^description/i)
        .fill("Automated visual-evidence description with enough length to pass validation.");
      await page.getByRole("button", { name: /submit ticket/i }).click();
      await expect(page.locator(".zen-confirmation-number")).toBeVisible();
      await shoot(page, "create-ticket", viewportName, "success");
      await assertNoHorizontalOverflow(page);
    });

    test(`My Tickets - ${viewportName}`, async ({ page }) => {
      await page.setViewportSize(size);
      await selectRequester(page, REQUESTER_A);

      // Wait past the loading state to the populated list before shooting -
      // Requester A has at least the beforeAll Ticket by this point.
      await expect(page.getByText(/showing \d+ to \d+ of \d+ tickets/i)).toBeVisible();
      await shoot(page, "my-tickets", viewportName, "populated");
      await assertNoHorizontalOverflow(page);

      // No-results state (BR-31/AC-09) - Requester A has tickets by now.
      await page.getByLabel(/search by ticket number or summary/i).fill("zzz-no-such-ticket-zzz");
      await expect(page.getByText(/no tickets match your filters/i)).toBeVisible();
      await shoot(page, "my-tickets", viewportName, "no-results");
      await assertNoHorizontalOverflow(page);
    });

    // BR-31/AC-08: Priya Nair is seeded specifically to demonstrate the
    // empty state (server/prisma/seed.ts) - never given a Ticket anywhere.
    test(`My Tickets empty state - ${viewportName}`, async ({ page }) => {
      await page.setViewportSize(size);
      await selectRequester(page, "Priya Nair");
      await expect(page.getByText(/haven't created any tickets yet/i)).toBeVisible();
      await shoot(page, "my-tickets", viewportName, "empty");
      await assertNoHorizontalOverflow(page);
    });

    test(`Ticket Detail - ${viewportName}`, async ({ page }) => {
      await page.setViewportSize(size);
      await selectRequester(page, REQUESTER_A);
      await page.goto(ticketDetailPath);
      await expect(page.getByText(ticketNumber)).toBeVisible();

      await shoot(page, "ticket-detail", viewportName, "populated");
      await assertNoHorizontalOverflow(page);
    });
  }

  // VIS-02: required CSS state classes are present (handout section 8.8).
  test("required CSS state classes render on real pages", async ({ page }) => {
    await selectRequester(page, REQUESTER_A);

    await page.goto("/tickets/new");
    await page.getByRole("button", { name: /submit ticket/i }).click();
    await expect(page.locator(".zen-field--error").first()).toBeVisible();
    await expect(page.locator(".zen-field-error").first()).toBeVisible();
    await expect(page.locator(".zen-required-asterisk").first()).toBeVisible();
    await expect(page.locator(".zen-readonly-value").first()).toBeVisible();

    await page.goto("/tickets");
    await expect(page.locator(".zen-badge").first()).toBeVisible();
    await expect(page.locator(".zen-btn-primary").first()).toBeVisible();
  });
});
