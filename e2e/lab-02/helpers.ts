import type { Page } from "@playwright/test";

// Lab 3 replaced the Development Requester selector with a real login
// (BR-42), so these are now accounts rather than selector labels. The Lab 2
// journeys themselves are unchanged, which is the point: they are the
// regression evidence that the Lab 2 increment still works.
export const REQUESTER_A = "jennifer.anderson@toktickit.dev";
export const REQUESTER_B = "sarah.johnson@toktickit.dev";
export const DEV_PASSWORD = "TokTick!2026";

export const VIEWPORTS = {
  desktop: { width: 1280, height: 800 },
  tablet: { width: 834, height: 1112 },
  mobile: { width: 390, height: 844 },
} as const;

// Lab 3: the same intent as the Lab 2 selectRequester, through the real Login
// screen instead of the removed selector.
export async function selectRequester(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel(/email address/i).fill(email);
  await page.getByLabel(/^password$/i).fill(DEV_PASSWORD);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL(/\/tickets$/);
}

export function uniqueSummary(prefix = "E2E"): string {
  return `${prefix} test ticket ${Date.now()}-${Math.floor(Math.random() * 10000)}`;
}

// Fills and submits a valid Create Ticket form, returns the issued Ticket
// Number. Assumes a Requester is already selected.
export async function createTicket(page: Page, summary: string): Promise<string> {
  await page.goto("/tickets/new");
  await page.getByLabel(/^category/i).selectOption({ index: 1 });
  await page.getByLabel(/related system/i).selectOption({ index: 1 });
  await page.getByLabel(/ticket summary/i).fill(summary);
  await page
    .getByLabel(/^description/i)
    .fill("This is an automated end-to-end test description with enough length to pass validation.");
  await page.getByRole("button", { name: /submit ticket/i }).click();

  const numberLocator = page.locator(".zen-confirmation-number");
  await numberLocator.waitFor({ state: "visible" });
  const ticketNumber = (await numberLocator.textContent())?.trim();
  if (!ticketNumber) throw new Error("Ticket Number was not rendered after submission");
  return ticketNumber;
}
