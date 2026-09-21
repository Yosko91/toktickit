import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  ASSIGNABLE_USERS,
  makeAuthUser,
  makeStaffTicketListItem,
  renderWithProviders,
} from "../lab-02/testUtils";
import { StaffTicketQueue } from "../../src/pages/StaffTicketQueue";
import { getAssignableUsers, getCategories, getCurrentUser, listStaffTickets } from "../../src/api";

vi.mock("../../src/api", async () => {
  const actual = await vi.importActual<typeof import("../../src/api")>("../../src/api");
  return {
    ...actual,
    getCurrentUser: vi.fn(),
    getCategories: vi.fn(),
    getAssignableUsers: vi.fn(),
    listStaffTickets: vi.fn(),
  };
});

const mocked = {
  getCurrentUser: vi.mocked(getCurrentUser),
  getCategories: vi.mocked(getCategories),
  getAssignableUsers: vi.mocked(getAssignableUsers),
  listStaffTickets: vi.mocked(listStaffTickets),
};

function queueResponse(data: ReturnType<typeof makeStaffTicketListItem>[]) {
  return {
    data,
    pagination: { page: 1, pageSize: 20, totalItems: data.length, totalPages: 1 },
  };
}

beforeEach(() => {
  vi.resetAllMocks();
  mocked.getCurrentUser.mockResolvedValue(makeAuthUser({ role: "IT_STAFF", name: "Michael Brown" }));
  mocked.getCategories.mockResolvedValue([{ id: 1, name: "Hardware" }]);
  mocked.getAssignableUsers.mockResolvedValue(ASSIGNABLE_USERS);
});

describe("StaffTicketQueue", () => {
  // UI-06 - AC-11
  it("renders the returned tickets with both priorities and the owner", async () => {
    mocked.listStaffTickets.mockResolvedValue(
      queueResponse([
        makeStaffTicketListItem({
          id: 1,
          ticketNumber: "TKT-2026-000101",
          requestedPriority: "LOW",
          itPriority: "HIGH",
          ownerId: 21,
          ownerName: "Michael Brown",
        }),
        makeStaffTicketListItem({ id: 2, ticketNumber: "TKT-2026-000102" }),
      ])
    );

    renderWithProviders(<StaffTicketQueue />);

    expect(await screen.findAllByText("TKT-2026-000101")).not.toHaveLength(0);
    expect(screen.getAllByText("Michael Brown").length).toBeGreaterThan(0);
    // The whole point of IT Priority is that it can differ from what the
    // Requester asked for, so both have to be on screen.
    expect(screen.getAllByText("High").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Low").length).toBeGreaterThan(0);
  });

  it("shows Unassigned rather than an empty cell for unclaimed work", async () => {
    mocked.listStaffTickets.mockResolvedValue(
      queueResponse([makeStaffTicketListItem({ ownerId: null, ownerName: null })])
    );

    renderWithProviders(<StaffTicketQueue />);

    expect(await screen.findAllByText(/unassigned/i)).not.toHaveLength(0);
  });

  it("shows the empty-queue state when nothing is filtered and nothing exists", async () => {
    mocked.listStaffTickets.mockResolvedValue(queueResponse([]));

    renderWithProviders(<StaffTicketQueue />);

    expect(await screen.findByText(/no tickets in the queue yet/i)).toBeInTheDocument();
    expect(screen.queryByText(/no tickets match these filters/i)).not.toBeInTheDocument();
  });

  // UI-07 - FR-10
  it("shows the no-results state with a clear-filters control once a filter is applied", async () => {
    mocked.listStaffTickets.mockResolvedValue(queueResponse([]));
    const user = userEvent.setup();

    renderWithProviders(<StaffTicketQueue />);
    await screen.findByText(/no tickets in the queue yet/i);

    await user.selectOptions(screen.getByLabelText(/^status$/i), "IN_PROGRESS");

    expect(await screen.findByText(/no tickets match these filters/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /clear filters/i })).toBeInTheDocument();
  });

  it("offers Unassigned as an owner filter, because finding unclaimed work is the point", async () => {
    mocked.listStaffTickets.mockResolvedValue(queueResponse([makeStaffTicketListItem()]));
    const user = userEvent.setup();

    renderWithProviders(<StaffTicketQueue />);
    await screen.findAllByText("TKT-2026-000001");

    await user.selectOptions(screen.getByLabelText(/^owner$/i), "unassigned");

    expect(mocked.listStaffTickets).toHaveBeenLastCalledWith(
      expect.objectContaining({ ownerId: "unassigned" })
    );
  });

  it("shows a retry control when the queue cannot be loaded", async () => {
    const { ApiError } = await import("../../src/api");
    mocked.listStaffTickets.mockRejectedValue(new ApiError(0, "Unable to reach the TokTickIT server"));

    renderWithProviders(<StaffTicketQueue />);

    expect(await screen.findByText(/unable to load the ticket queue/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();
  });
});
