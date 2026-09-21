import fs from "node:fs/promises";
import path from "node:path";
import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";
import {
  ACCOUNTS,
  VIEWPORTS,
  createTicket,
  createUserViaApi,
  searchAndSettle,
  settle,
  signIn,
  signInAs,
  signOut,
  uniqueSummary,
} from "./helpers";

// VIS-01 to VIS-04 (docs/lab-03/tests.md). Captures the desktop, tablet and
// mobile evidence for every new Lab 3 screen and asserts there is no horizontal
// overflow at any of the three widths (AC-26).

const SCREENSHOT_ROOT = path.join(__dirname, "..", "..", "artifacts", "lab-03", "screenshots");

async function shoot(page: Page, group: string, viewport: string, name: string) {
  const dir = path.join(SCREENSHOT_ROOT, group, viewport);
  await fs.mkdir(dir, { recursive: true });
  await settle(page);
  await page.screenshot({ path: path.join(dir, `${name}.png`), fullPage: true });
}

/**
 * AC-26. Compares the document width against the viewport width rather than
 * looking at the screenshot, because a clipped control is not always visible in
 * a full-page capture.
 */
async function assertNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  // One pixel of tolerance for sub-pixel rounding at fractional device ratios.
  expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth + 1);
}

test.describe("Lab 3 responsive and visual evidence", () => {
  for (const [viewportName, size] of Object.entries(VIEWPORTS)) {
    // VIS-01 - Login and Change Password
    test(`VIS-01 Login and Change Password - ${viewportName}`, async ({ page, request }) => {
      await page.setViewportSize(size);

      await page.goto("/login");
      await shoot(page, "authentication", viewportName, "login-idle");
      await assertNoHorizontalOverflow(page);

      // The refused-credential state, as a real application state.
      await signIn(page, ACCOUNTS.requester.email, "DefinitelyWrong!1");
      await expect(page.getByRole("alert")).toBeVisible();
      await shoot(page, "authentication", viewportName, "login-invalid");
      await assertNoHorizontalOverflow(page);

      // A throw-away account so the mandatory change screen is always reachable.
      const user = await createUserViaApi(request, { role: "REQUESTER" });
      await signIn(page, user.email, user.initialPassword);
      await page.waitForURL(/\/change-password/);
      await page.getByLabel(/^new password$/i).fill("Changed!2026");
      await shoot(page, "authentication", viewportName, "change-password");
      await assertNoHorizontalOverflow(page);
    });

    // VIS-02 - IT Staff Ticket Queue
    test(`VIS-02 Ticket Queue - ${viewportName}`, async ({ page }) => {
      await page.setViewportSize(size);
      await signInAs(page, ACCOUNTS.staff);
      await settle(page);

      await expect(page.getByRole("heading", { name: /ticket queue/i })).toBeVisible();
      await shoot(page, "staff-queue", viewportName, "populated");
      await assertNoHorizontalOverflow(page);

      // The no-results state, reached through the real filters.
      await searchAndSettle(page, /^search$/i, "no-ticket-will-ever-match-this-string");
      await expect(page.getByText(/no tickets match these filters/i)).toBeVisible();
      await shoot(page, "staff-queue", viewportName, "no-results");
      await assertNoHorizontalOverflow(page);
    });

    // VIS-03 - IT Staff Ticket Detail
    test(`VIS-03 Staff Ticket Detail - ${viewportName}`, async ({ page }) => {
      await page.setViewportSize(size);

      const summary = uniqueSummary("visual");
      await signInAs(page, ACCOUNTS.requester);
      const ticketNumber = await createTicket(page, summary);
      await signOut(page);

      await signInAs(page, ACCOUNTS.staff);
      await searchAndSettle(page, /^search$/i, ticketNumber);
      await page.getByRole("link", { name: ticketNumber }).first().click();
      await page.waitForURL(/\/queue\/\d+$/);
      await settle(page);

      // Both message panels carry content, so the evidence shows the visual
      // difference between the public and private streams.
      // Waiting on getByText here would be wrong: Playwright's text engine also
      // matches a textarea's own value, so the assertion passed the instant the
      // box was typed into, before the post had happened. The reload that
      // follows a successful post then wiped the next panel mid-fill. The
      // textarea clearing is the signal that the post actually went through.
      const commentBox = page.getByLabel(/add public comment/i);
      await commentBox.fill("We are looking into this now.");
      await page.getByRole("button", { name: /post comment/i }).click();
      await expect(commentBox).toHaveValue("");
      await settle(page);

      const noteBox = page.getByLabel(/add internal note/i);
      await noteBox.fill("Spare part ordered from stock.");
      await expect(noteBox).toHaveValue("Spare part ordered from stock.");
      await page.getByRole("button", { name: /save note/i }).click();
      await expect(noteBox).toHaveValue("");
      await settle(page);

      await shoot(page, "staff-ticket-detail", viewportName, "populated");
      await assertNoHorizontalOverflow(page);
    });

    // VIS-04 - Administrator User Management
    test(`VIS-04 User Management - ${viewportName}`, async ({ page }) => {
      await page.setViewportSize(size);
      await signInAs(page, ACCOUNTS.admin);
      await page.goto("/admin/users");
      await settle(page);

      await expect(page.getByRole("heading", { name: /^users$/i })).toBeVisible();
      await shoot(page, "user-management", viewportName, "list");
      await assertNoHorizontalOverflow(page);

      await page.getByRole("button", { name: /create user/i }).click();
      await settle(page);
      await shoot(page, "user-management", viewportName, "create-panel");
      await assertNoHorizontalOverflow(page);
    });
  }

  test("role-specific navigation is visibly different for each role", async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.desktop);

    for (const [role, account] of [
      ["requester", ACCOUNTS.requester],
      ["staff", ACCOUNTS.staff],
      ["administrator", ACCOUNTS.admin],
    ] as const) {
      await signInAs(page, account);
      await settle(page);
      await shoot(page, "authentication", "desktop", `shell-${role}`);
      await signOut(page);
    }
  });
});
