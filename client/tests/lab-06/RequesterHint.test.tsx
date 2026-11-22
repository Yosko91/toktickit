import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders, SEEDED_REQUESTER } from "../lab-02/testUtils";
import { CreateTicket } from "../../src/pages/CreateTicket";
import { getCategories, getCurrentUser, getRelatedSystems } from "../../src/api";

vi.mock("../../src/api", async () => {
  const actual = await vi.importActual<typeof import("../../src/api")>("../../src/api");
  return {
    ...actual,
    getCurrentUser: vi.fn(),
    getCategories: vi.fn(),
    getRelatedSystems: vi.fn(),
  };
});

// Lab 6, UAT finding F-B1 (issue #75). The Development Requester selector was removed in
// Lab 3 (BR-42), so the help text under "Requester" on Create Ticket must describe the
// signed-in account and must not mention the selector any more.
describe("Create Ticket: help text under Requester (F-B1)", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(getCurrentUser).mockResolvedValue(SEEDED_REQUESTER);
    vi.mocked(getCategories).mockResolvedValue([{ id: 1, name: "Hardware" }]);
    vi.mocked(getRelatedSystems).mockResolvedValue([{ id: 1, name: "Corporate Laptop" }]);
  });

  async function requesterHint(): Promise<string> {
    renderWithProviders(<CreateTicket />);
    const value = await screen.findByText(SEEDED_REQUESTER.name);
    return value.parentElement?.querySelector(".zen-field-hint")?.textContent ?? "";
  }

  it("does not mention the Development Requester selector", async () => {
    const hint = await requesterHint();
    expect(hint).not.toMatch(/development requester/i);
    expect(screen.queryByText(/development requester/i)).toBeNull();
  });

  it("says that the Requester comes from the signed-in account", async () => {
    const hint = await requesterHint();
    expect(hint).toMatch(/signed in/i);
  });
});
