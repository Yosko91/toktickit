import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { makeTicketListItem, renderWithProviders, SEEDED_REQUESTER } from "./testUtils";
import { MyTickets } from "../../src/pages/MyTickets";
import { getCurrentUser, getCategories, listTickets } from "../../src/api";

vi.mock("../../src/api", async () => {
  const actual = await vi.importActual<typeof import("../../src/api")>("../../src/api");
  return { ...actual, getCurrentUser: vi.fn(), getCategories: vi.fn(), listTickets: vi.fn() };
});

const mocked = {
  getCurrentUser: vi.mocked(getCurrentUser),
  getCategories: vi.mocked(getCategories),
  listTickets: vi.mocked(listTickets),
};

beforeEach(() => {
  sessionStorage.clear();
  vi.resetAllMocks();
  mocked.getCurrentUser.mockResolvedValue(SEEDED_REQUESTER);
  mocked.getCategories.mockResolvedValue([{ id: 1, name: "Hardware" }]);
});

describe("MyTickets", () => {
  // UI-08 - AC-08
  it("shows the empty state (not no-results) when the requester has zero tickets", async () => {
    mocked.listTickets.mockResolvedValue({
      data: [],
      pagination: { page: 1, pageSize: 10, totalItems: 0, totalPages: 0 },
    });

    renderWithProviders(<MyTickets />);

    expect(await screen.findByText(/haven't created any tickets yet/i)).toBeInTheDocument();
    expect(screen.queryByText(/no tickets match your filters/i)).not.toBeInTheDocument();
  });

  // UI-09 - AC-09
  it("shows the no-results state once a search matches nothing, for a requester with tickets", async () => {
    mocked.listTickets
      .mockResolvedValueOnce({
        data: [makeTicketListItem()],
        pagination: { page: 1, pageSize: 10, totalItems: 1, totalPages: 1 },
      })
      .mockResolvedValueOnce({
        data: [],
        pagination: { page: 1, pageSize: 10, totalItems: 0, totalPages: 0 },
      });

    const user = userEvent.setup();
    renderWithProviders(<MyTickets />);
    // Desktop table and mobile cards both render in the DOM at once (CSS
    // toggles visibility per viewport - see ui-spec.md section 10), so more
    // than one match is expected here.
    await screen.findAllByText(makeTicketListItem().summary);

    await user.type(screen.getByLabelText(/search by ticket number or summary/i), "nomatch");

    expect(
      await screen.findByText(/no tickets match your filters/i, {}, { timeout: 2000 })
    ).toBeInTheDocument();
  });

  // UI-11 - AC-12
  it("requests page 2 when Next is clicked", async () => {
    mocked.listTickets.mockImplementation(async (params) => ({
      data: [makeTicketListItem({ id: params?.page === 2 ? 99 : 1 })],
      pagination: { page: params?.page ?? 1, pageSize: 10, totalItems: 15, totalPages: 2 },
    }));

    const user = userEvent.setup();
    renderWithProviders(<MyTickets />);
    await screen.findByText(/showing 1 to 10 of 15 tickets/i);

    await user.click(screen.getByRole("button", { name: /^next/i }));

    await waitFor(() =>
      expect(mocked.listTickets).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 }))
    );
  });

  // UI-10 - AC-21
  // UI-14 (Lab 3) - BR-42. Lab 2 tested that switching Development Requester
  // reloaded the list. There is no switching any more: the list is scoped by
  // the session on the server, so the guarantee worth testing is that the
  // client never sends a requester id at all and so cannot widen its own scope.
  it("never sends a requester id with the list request", async () => {
    mocked.listTickets.mockResolvedValue({
      data: [],
      pagination: { page: 1, pageSize: 10, totalItems: 0, totalPages: 0 },
    });

    renderWithProviders(<MyTickets />);
    await screen.findByText(/haven't created any tickets yet/i);

    for (const call of mocked.listTickets.mock.calls) {
      expect(typeof call[0]).not.toBe("number");
      expect(JSON.stringify(call[0] ?? {})).not.toMatch(/requesterId/);
    }
  });
});
