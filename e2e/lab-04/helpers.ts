import type { Locator, Page } from "@playwright/test";
import { expect } from "@playwright/test";

// Lab 4 end-to-end helpers. The sign-in and ticket helpers of Lab 3 are reused
// as they are, so the Lab 4 journeys start exactly like the Lab 3 ones.
export {
  ACCOUNTS,
  DEV_PASSWORD,
  VIEWPORTS,
  createTicket,
  settle,
  signIn,
  signInAs,
  signOut,
  uniqueSummary,
} from "../lab-03/helpers";

export const API = "http://localhost:3000";

export const STAFF_2 = { email: "emily.davis@toktickit.dev", name: "Emily Davis" } as const;
export const EMPTY_REQUESTER = { email: "priya.nair@toktickit.dev", name: "Priya Nair" } as const;

/** The id of a ticket the signed-in user can see, found by its number. */
export async function ticketIdFor(page: Page, ticketNumber: string, asStaff = false): Promise<number> {
  const path = asStaff ? "/api/staff/tickets" : "/api/tickets";
  const response = await page.request.get(`${API}${path}?search=${encodeURIComponent(ticketNumber)}`);
  const body = await response.json();
  const ticket = body.data.find((t: { ticketNumber: string }) => t.ticketNumber === ticketNumber);
  if (!ticket) throw new Error(`Ticket ${ticketNumber} not found`);
  return ticket.id;
}

export function actionRow(page: Page, description: string): Locator {
  return page.locator(".zen-action-row").filter({ hasText: description });
}

/** Fills and saves the Add Action form of the IT Staff Ticket Detail. */
export async function addAction(
  page: Page,
  values: { description: string; result?: string; status?: string; performer?: string }
) {
  await page.getByRole("button", { name: /add action/i }).click();
  const form = page.getByRole("form", { name: "New action" });
  if (values.status) await form.getByLabel(/^status/i).selectOption({ label: values.status });
  if (values.performer) await form.getByLabel(/performed by/i).selectOption({ label: values.performer });
  await form.getByLabel(/action description/i).fill(values.description);
  if (values.result) await form.getByLabel(/^result/i).fill(values.result);
  await form.getByRole("button", { name: /save action/i }).click();
  await expect(page.getByText("Action saved")).toBeVisible();
  await expect(actionRow(page, values.description)).toBeVisible();
}

/** Picks a status in the Current Status select and waits for the result. */
export async function moveTicketTo(page: Page, status: string) {
  await page.getByLabel(/current status/i).selectOption(status);
}
