import { expect, test } from "@playwright/test";
import {
  ACCOUNTS,
  STAFF_2,
  actionRow,
  addAction,
  createTicket,
  settle,
  signInAs,
  signOut,
  ticketIdFor,
  uniqueSummary,
} from "./helpers";

// E2E-01 (docs/lab-04/tests.md): AC-01, AC-03, AC-07 and AC-09 through the real
// screens, the real API and the real database.
test("E2E-01 IT Staff record actions, a colleague's planned action is completed, the Requester reads them", async ({ page }) => {
  // The Requester raises a ticket.
  await signInAs(page, ACCOUNTS.requester);
  const ticketNumber = await createTicket(page, uniqueSummary("E2E Lab4 actions"));
  const ticketId = await ticketIdFor(page, ticketNumber);
  await signOut(page);

  // IT Staff claim it and record what was done.
  await signInAs(page, ACCOUNTS.staff);
  await page.goto(`/queue/${ticketId}`);
  await page.getByRole("button", { name: /claim/i }).click();
  await expect(page.getByText("Owner saved")).toBeVisible();

  await addAction(page, {
    description: "Checked the cable and the network port",
    result: "The cable was damaged, replaced it",
  });
  const first = actionRow(page, "Checked the cable and the network port");
  await expect(first).toContainText("Completed");
  await expect(first).toContainText(`Performed by ${ACCOUNTS.staff.name}`);
  // AC-01: a completed action is read only straight away.
  await expect(first.getByRole("button", { name: /edit/i })).toHaveCount(0);

  // AC-03: planned for a colleague. The owner stays the same person.
  await addAction(page, {
    description: "Visit the user desk to test the new cable",
    status: "Planned",
    performer: STAFF_2.name,
  });
  const planned = actionRow(page, "Visit the user desk to test the new cable");
  await expect(planned).toContainText("Planned");
  await expect(planned).toContainText(`Performed by ${STAFF_2.name} · recorded by ${ACCOUNTS.staff.name}`);
  await expect(page.getByLabel(/ticket owner/i)).toHaveValue(/\d+/);

  // AC-07: start it, then complete it with a result.
  await planned.getByRole("button", { name: /edit action/i }).click();
  const edit = page.getByRole("form", { name: "Edit action" });
  await edit.getByLabel(/^status/i).selectOption({ label: "In Progress" });
  await edit.getByRole("button", { name: /save action/i }).click();
  await expect(planned).toContainText("In Progress");

  await planned.getByRole("button", { name: /edit action/i }).click();
  await edit.getByLabel(/^status/i).selectOption({ label: "Completed" });
  await edit.getByLabel(/^result/i).fill("Network works at full speed now");
  await edit.getByRole("button", { name: /save action/i }).click();
  await expect(planned).toContainText("Completed");
  await expect(planned).toContainText("Network works at full speed now");
  await expect(planned.getByRole("button", { name: /edit/i })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Actions Taken (2)" })).toBeVisible();
  await signOut(page);

  // AC-09: the Requester sees both actions and no control at all.
  await signInAs(page, ACCOUNTS.requester);
  await page.goto(`/tickets/${ticketId}`);
  await settle(page);
  const card = page.locator("section", { has: page.getByRole("heading", { name: /work done by it/i }) });
  await expect(card.getByRole("heading")).toHaveText("Work done by IT (2)");
  await expect(card).toContainText("Checked the cable and the network port");
  await expect(card).toContainText("Network works at full speed now");
  await expect(card.getByRole("button")).toHaveCount(0);
});

test("E2E-01b a follow-up without a note is refused under the field and the typed text stays", async ({ page }) => {
  await signInAs(page, ACCOUNTS.requester);
  const ticketNumber = await createTicket(page, uniqueSummary("E2E Lab4 validation"));
  const ticketId = await ticketIdFor(page, ticketNumber);
  await signOut(page);

  await signInAs(page, ACCOUNTS.staff);
  await page.goto(`/queue/${ticketId}`);
  await page.getByRole("button", { name: /add action/i }).click();
  const form = page.getByRole("form", { name: "New action" });
  await form.getByLabel(/action description/i).fill("Called the requester");
  await form.getByLabel(/^result/i).fill("No answer");
  await form.getByLabel(/follow-up required/i).check();
  await form.getByRole("button", { name: /save action/i }).click();

  const noteField = form.getByLabel(/follow-up note/i).locator("xpath=..");
  await expect(noteField).toContainText(/a follow-up note is required/i);
  await expect(form.getByLabel(/action description/i)).toHaveValue("Called the requester");
  await expect(page.getByRole("heading", { name: "Actions Taken (0)" })).toBeVisible();
});
