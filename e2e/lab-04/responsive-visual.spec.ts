import fs from "node:fs/promises";
import path from "node:path";
import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";
import { ACCOUNTS, API, EMPTY_REQUESTER, VIEWPORTS, settle, signInAs } from "./helpers";

// VIS-01 to VIS-03 and A11Y-01 (docs/lab-04/tests.md). Desktop, tablet and
// mobile evidence for the Lab 4 screens, with the overflow measured rather
// than only looked at (AC-23), and no console error allowed (handout 8.5).

const ROOT = path.join(__dirname, "..", "..", "artifacts", "lab-04", "screenshots");

async function shoot(page: Page, group: string, viewport: string, name: string) {
  const dir = path.join(ROOT, group, viewport);
  await fs.mkdir(dir, { recursive: true });
  await settle(page);
  await page.screenshot({ path: path.join(dir, `${name}.png`), fullPage: true });
}

async function assertNoHorizontalOverflow(page: Page) {
  const size = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(size.scrollWidth).toBeLessThanOrEqual(size.clientWidth + 1);
}

/**
 * JavaScript errors only. Chrome also logs every HTTP error answer as "Failed
 * to load resource"; here those are expected ones (the 401 of the session
 * check on the login page, the 400 of the validation we trigger on purpose).
 */
function watchConsole(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error" && !msg.text().startsWith("Failed to load resource")) errors.push(msg.text());
  });
  page.on("pageerror", (err) => errors.push(err.message));
  return errors;
}

/** The seeded ticket with several actions, one by a colleague (seed.ts). */
async function seededActionsTicket(page: Page): Promise<number> {
  const list = await page.request.get(`${API}/api/staff/tickets?search=${encodeURIComponent("Laptop battery drains quickly")}`);
  for (const t of (await list.json()).data as { id: number }[]) {
    const detail = await (await page.request.get(`${API}/api/staff/tickets/${t.id}`)).json();
    if (detail.actionsTaken.length >= 2) return t.id;
  }
  throw new Error("Seeded ticket with actions not found, run npm run prisma:seed");
}

test.describe("Lab 4 responsive and visual evidence", () => {
  for (const [viewportName, size] of Object.entries(VIEWPORTS)) {
    // VIS-01
    test(`VIS-01 IT Staff and Administrator dashboard - ${viewportName}`, async ({ page }) => {
      const errors = watchConsole(page);
      await page.setViewportSize(size);

      await signInAs(page, ACCOUNTS.staff);
      await page.goto("/dashboard");
      await expect(page.getByRole("heading", { name: /welcome back/i })).toBeVisible();
      await shoot(page, "staff-dashboard", viewportName, "staff");
      await assertNoHorizontalOverflow(page);

      await page.context().clearCookies();
      await signInAs(page, ACCOUNTS.admin);
      await page.goto("/dashboard");
      await expect(page.getByRole("link", { name: /^View Active Users/ })).toBeVisible();
      await shoot(page, "staff-dashboard", viewportName, "administrator");
      await assertNoHorizontalOverflow(page);

      expect(errors).toEqual([]);
    });

    // VIS-02
    test(`VIS-02 Requester dashboard - ${viewportName}`, async ({ page }) => {
      const errors = watchConsole(page);
      await page.setViewportSize(size);

      await signInAs(page, ACCOUNTS.requester);
      await page.goto("/dashboard");
      await expect(page.getByRole("heading", { name: /welcome, jennifer/i })).toBeVisible();
      await shoot(page, "requester-dashboard", viewportName, "populated");
      await assertNoHorizontalOverflow(page);

      await page.context().clearCookies();
      await signInAs(page, EMPTY_REQUESTER);
      await page.goto("/dashboard");
      await expect(page.getByText("Nothing is waiting for you.")).toBeVisible();
      await shoot(page, "requester-dashboard", viewportName, "empty");
      await assertNoHorizontalOverflow(page);

      expect(errors).toEqual([]);
    });

    // VIS-03
    test(`VIS-03 Actions Taken - ${viewportName}`, async ({ page }) => {
      const errors = watchConsole(page);
      await page.setViewportSize(size);

      await signInAs(page, ACCOUNTS.staff);
      const ticketId = await seededActionsTicket(page);
      await page.goto(`/queue/${ticketId}`);
      await expect(page.getByRole("heading", { name: /actions taken \(\d+\)/i })).toBeVisible();
      await page.getByRole("heading", { name: /actions taken/i }).scrollIntoViewIfNeeded();
      await shoot(page, "actions-taken", viewportName, "staff-list");
      await assertNoHorizontalOverflow(page);

      // Create mode, with a validation message under its field.
      await page.getByRole("button", { name: /add action/i }).click();
      const form = page.getByRole("form", { name: "New action" });
      await form.getByLabel(/action description/i).fill("Checked the charger");
      await form.getByLabel(/follow-up required/i).check();
      await form.getByRole("button", { name: /save action/i }).click();
      await expect(form.getByText(/a result is required/i)).toBeVisible();
      await shoot(page, "actions-taken", viewportName, "create-form-validation");
      await assertNoHorizontalOverflow(page);
      await form.getByRole("button", { name: /^cancel$/i }).click();

      // View/edit mode of the open action.
      await page.getByRole("button", { name: /edit action/i }).first().click();
      await expect(page.getByRole("form", { name: "Edit action" })).toBeVisible();
      await shoot(page, "actions-taken", viewportName, "edit-form");
      await assertNoHorizontalOverflow(page);

      await page.context().clearCookies();
      await signInAs(page, ACCOUNTS.requester);
      await page.goto(`/tickets/${ticketId}`);
      await expect(page.getByRole("heading", { name: /work done by it/i })).toBeVisible();
      await shoot(page, "actions-taken", viewportName, "requester-view");
      await assertNoHorizontalOverflow(page);

      expect(errors).toEqual([]);
    });
  }

  // Safe failure and loading on the staff dashboard (handout Part 5).
  test("VIS-01b dashboard loading, forbidden and safe failure states - desktop", async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.desktop);
    await signInAs(page, ACCOUNTS.staff);

    await page.route("**/api/dashboard/staff", (route) => route.abort("connectionrefused"));
    await page.goto("/dashboard");
    await expect(page.getByRole("alert")).toContainText(/unable to reach the toktickit server/i);
    await shoot(page, "staff-dashboard", "desktop", "safe-failure");

    await page.unroute("**/api/dashboard/staff");
    await page.route("**/api/dashboard/staff", (route) =>
      route.fulfill({ status: 403, json: { error: "You do not have permission to perform this action" } })
    );
    await page.getByRole("button", { name: /retry/i }).click();
    await expect(page.getByRole("alert")).toContainText(/do not have permission/i);
    await shoot(page, "staff-dashboard", "desktop", "forbidden");

    await page.unroute("**/api/dashboard/staff");
    let release: () => void = () => {};
    await page.route("**/api/dashboard/staff", async (route) => {
      await new Promise<void>((resolve) => (release = resolve));
      await route.continue();
    });
    await page.getByRole("button", { name: /retry/i }).click();
    await expect(page.getByRole("status")).toContainText(/loading the dashboard/i);
    await page.screenshot({ path: path.join(ROOT, "staff-dashboard", "desktop", "loading.png") });
    release();
    await expect(page.getByRole("heading", { name: /welcome back/i })).toBeVisible();
  });

  // A11Y-01 - AC-23: every new control can be reached with Tab and shows focus.
  test("A11Y-01 keyboard focus on the dashboard links and the action form", async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.desktop);
    await signInAs(page, ACCOUNTS.staff);
    await page.goto("/dashboard");
    await settle(page);

    const focusStyle = () =>
      page.evaluate(() => {
        const el = document.activeElement as HTMLElement;
        const style = getComputedStyle(el);
        return { label: el.getAttribute("aria-label") ?? el.textContent ?? "", outline: style.outlineStyle, width: style.outlineWidth };
      });

    let found = false;
    for (let i = 0; i < 25 && !found; i++) {
      await page.keyboard.press("Tab");
      const f = await focusStyle();
      if (f.label.startsWith("View Unassigned")) {
        expect(f.outline).not.toBe("none");
        expect(f.width).not.toBe("0px");
        found = true;
      }
    }
    expect(found).toBe(true);
    await page.screenshot({ path: path.join(ROOT, "staff-dashboard", "desktop", "keyboard-focus.png") });

    const ticketId = await seededActionsTicket(page);
    await page.goto(`/queue/${ticketId}`);
    await settle(page);
    await page.getByRole("button", { name: /add action/i }).focus();
    await page.keyboard.press("Enter");
    const form = page.getByRole("form", { name: "New action" });
    await expect(form).toBeVisible();
    // Tab moves through the form fields in reading order. It starts after the
    // date field, because Tab also walks the day, month and time parts of a
    // datetime-local input.
    await form.getByLabel(/^status/i).focus();
    for (const label of [/performed by/i, /action description/i, /^result/i]) {
      await page.keyboard.press("Tab");
      await expect(form.getByLabel(label)).toBeFocused();
    }
  });
});
