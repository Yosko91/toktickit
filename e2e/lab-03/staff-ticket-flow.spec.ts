import { expect, test } from "@playwright/test";
import {
  ACCOUNTS,
  createTicket,
  searchAndSettle,
  settle,
  signInAs,
  signOut,
  uniqueSummary,
} from "./helpers";

test.describe("IT Staff working a ticket", () => {
  // E2E-04 - AC-11 to AC-14
  test("E2E-04: find a ticket in the queue, claim it, prioritise it and move its status", async ({
    page,
  }) => {
    // A Requester raises the ticket first, so the staff journey runs against a
    // real ticket rather than a seeded one another test may have moved.
    const summary = uniqueSummary("staff-flow");
    await signInAs(page, ACCOUNTS.requester);
    const ticketNumber = await createTicket(page, summary);
    await signOut(page);

    await signInAs(page, ACCOUNTS.staff);
    await expect(page).toHaveURL(/\/queue/);

    // AC-11: the queue carries tickets raised by other people.
    await searchAndSettle(page, /^search$/i, ticketNumber);
    await page.getByRole("link", { name: ticketNumber }).first().click();
    await page.waitForURL(/\/queue\/\d+$/);

    // AC-12: claim it.
    await page.getByRole("button", { name: /^claim$/i }).click();
    await expect(page.getByLabel(/ticket owner/i)).toHaveValue(/\d+/);
    await expect(page.getByText(/owner saved/i)).toBeVisible();

    // AC-13: IT Priority moves, Requested Priority does not.
    await page.getByLabel(/it priority/i).selectOption("HIGH");
    await expect(page.getByText(/it priority saved/i)).toBeVisible();
    await expect(page.getByLabel(/it priority/i)).toHaveValue("HIGH");

    // AC-14: a NEW ticket is not offered the jump straight to Resolved.
    const statusSelect = page.getByLabel(/current status/i);
    await expect(statusSelect.getByRole("option", { name: /move to open/i })).toHaveCount(1);
    await expect(statusSelect.getByRole("option", { name: /move to resolved/i })).toHaveCount(0);

    await statusSelect.selectOption("OPEN");
    await expect(page.getByText(/status saved/i)).toBeVisible();

    // The change survives a reload, so it really was written.
    await page.reload();
    await settle(page);
    await expect(page.getByLabel(/it priority/i)).toHaveValue("HIGH");
    // The badge, not getByText: the status select's first option carries the
    // same label and an <option> is never "visible" to Playwright.
    await expect(page.locator(".zen-detail-grid .zen-badge-status")).toHaveText("Open");
  });

  // E2E-05 - AC-16
  test("E2E-05: an internal note is invisible to the Requester who raised the ticket", async ({
    page,
  }) => {
    const summary = uniqueSummary("note-privacy");
    const secret = `Internal only - do not show the requester ${Date.now()}`;

    await signInAs(page, ACCOUNTS.requester);
    const ticketNumber = await createTicket(page, summary);
    await page.getByRole("button", { name: /view ticket/i }).click();
    await page.waitForURL(/\/tickets\/\d+$/);
    const requesterUrl = page.url();
    await signOut(page);

    await signInAs(page, ACCOUNTS.staff);
    await searchAndSettle(page, /^search$/i, ticketNumber);
    await page.getByRole("link", { name: ticketNumber }).first().click();
    await page.waitForURL(/\/queue\/\d+$/);

    await page.getByLabel(/add internal note/i).fill(secret);
    await page.getByRole("button", { name: /save note/i }).click();
    await expect(page.getByText(secret)).toBeVisible();
    await signOut(page);

    // The Requester opens the very same ticket: the note text is nowhere on the
    // page, and there is no Internal Notes panel at all.
    await signInAs(page, ACCOUNTS.requester);
    await page.goto(requesterUrl);
    await settle(page);

    await expect(page.getByText(ticketNumber)).toBeVisible();
    await expect(page.getByText(secret)).toHaveCount(0);
    await expect(page.getByText(/internal notes/i)).toHaveCount(0);
    // Not only hidden from view: absent from what the page received.
    expect(await page.content()).not.toContain(secret);
  });

  // E2E-06 - AC-09, AC-10
  test("E2E-06: a Requester comments and reports the problem looks resolved", async ({ page }) => {
    const summary = uniqueSummary("requester-comment");
    const comment = `Any update on this please? ${Date.now()}`;

    await signInAs(page, ACCOUNTS.requester);
    await createTicket(page, summary);
    await page.getByRole("button", { name: /view ticket/i }).click();
    await page.waitForURL(/\/tickets\/\d+$/);
    await settle(page);

    // AC-09: the comment appears with the author's name.
    await page.getByLabel(/add public comment/i).fill(comment);
    await page.getByRole("button", { name: /post comment/i }).click();
    await expect(page.getByText(comment)).toBeVisible();
    await expect(page.getByText(ACCOUNTS.requester.name).first()).toBeVisible();

    // BR-24 made visible before the action: the screen warns that this does not
    // move the status, because a Requester could reasonably expect it to.
    await expect(page.getByText(/only it staff can resolve or close a ticket/i)).toBeVisible();

    // AC-10: and it genuinely does not change the status badge.
    const statusBefore = await page.locator(".zen-badge-status").first().textContent();
    await page.getByRole("button", { name: /problem appears resolved/i }).click();
    await settle(page);

    await expect(page.getByText(/you reported this looks resolved/i)).toBeVisible();
    const statusAfter = await page.locator(".zen-badge-status").first().textContent();
    expect(statusAfter).toBe(statusBefore);
  });
});
