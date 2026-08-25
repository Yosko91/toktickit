import type { Page } from "@playwright/test";

export const REQUESTER_A = "Jennifer Anderson";
export const REQUESTER_B = "Sarah Johnson";

export const VIEWPORTS = {
  desktop: { width: 1280, height: 800 },
  tablet: { width: 834, height: 1112 },
  mobile: { width: 390, height: 844 },
} as const;

// BR-05: goes through the real (non-authentication) Development Requester
// selector, exactly as a Requester would.
export async function selectRequester(page: Page, name: string) {
  await page.goto("/select-requester");
  await page.getByLabel(/development requester/i).selectOption({ label: name });
  await page.getByRole("button", { name: /continue/i }).click();
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
