import type { APIRequestContext, Page } from "@playwright/test";

// Shared helpers for the Lab 3 end-to-end suites.
//
// Every account below comes from server/prisma/seed.ts and exists only for
// local development. The password is the documented development password, not
// a real credential (specification.md section 7).

export const DEV_PASSWORD = "TokTick!2026";

export const ACCOUNTS = {
  requester: { email: "jennifer.anderson@toktickit.dev", name: "Jennifer Anderson" },
  otherRequester: { email: "sarah.johnson@toktickit.dev", name: "Sarah Johnson" },
  staff: { email: "michael.brown@toktickit.dev", name: "Michael Brown" },
  admin: { email: "john.smith@toktickit.dev", name: "John Smith" },
} as const;

export const VIEWPORTS = {
  desktop: { width: 1440, height: 900 },
  tablet: { width: 768, height: 1024 },
  mobile: { width: 390, height: 844 },
} as const;

/** Signs in through the real Login screen, as a user would. */
export async function signIn(page: Page, email: string, password: string = DEV_PASSWORD) {
  await page.goto("/login");
  await page.getByLabel(/email address/i).fill(email);
  await page.getByLabel(/^password$/i).fill(password);
  await page.getByRole("button", { name: /sign in/i }).click();
}

export async function signInAs(page: Page, account: { email: string }) {
  await signIn(page, account.email);
  // Requesters land on My Tickets, staff and administrators on the queue.
  await page.waitForURL(/\/(tickets|queue)/);
}

export async function signOut(page: Page) {
  await page.getByRole("button", { name: /👤/ }).click();
  await page.getByRole("button", { name: /^logout$/i }).click();
  await page.waitForURL(/\/login/);
}

/**
 * Creates a throw-away account through the real Administrator API, so tests
 * that consume a first-login password do not depend on a seeded account whose
 * flag they would clear permanently.
 */
export async function createUserViaApi(
  request: APIRequestContext,
  overrides: { role?: string; isActive?: boolean; name?: string } = {}
) {
  const login = await request.post("http://localhost:3000/api/auth/login", {
    data: { email: ACCOUNTS.admin.email, password: DEV_PASSWORD },
  });
  if (!login.ok()) throw new Error(`Administrator login failed: ${login.status()}`);

  const suffix = `${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  const email = `e2e-user-${suffix}@toktickit.test`;
  const initialPassword = "Initial!2026";

  const created = await request.post("http://localhost:3000/api/admin/users", {
    data: {
      name: overrides.name ?? `E2E User ${suffix}`,
      email,
      role: overrides.role ?? "REQUESTER",
      isActive: overrides.isActive ?? true,
      initialPassword,
    },
  });
  if (!created.ok()) throw new Error(`Creating the test user failed: ${created.status()}`);

  return { ...(await created.json()), email, initialPassword };
}

export function uniqueSummary(prefix = "E2E Lab3"): string {
  return `${prefix} ticket ${Date.now()}-${Math.floor(Math.random() * 10000)}`;
}

/** Creates a ticket as the signed-in Requester and returns its ticket number. */
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

/**
 * Fills a debounced search box and waits for the result it causes.
 *
 * Waiting for network idle alone is not enough: the search inputs debounce by
 * 300ms, so "idle" can be satisfied during the quiet period before the request
 * has even been made, and the test then acts on the previous, unfiltered list.
 */
export async function searchAndSettle(page: Page, label: RegExp, term: string) {
  await page.getByLabel(label).fill(term);
  await page.waitForTimeout(450);
  await settle(page);
}

/** Waits for the page to settle so screenshots are never taken mid-spinner. */
export async function settle(page: Page) {
  await page.waitForLoadState("networkidle");
  await page.locator(".zen-spinner").waitFor({ state: "detached" }).catch(() => undefined);
}
