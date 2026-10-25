import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  ASSIGNABLE_USERS,
  makeAuthUser,
  makeStaffTicketDetail,
  renderWithProviders,
} from "../lab-02/testUtils";
import { StaffTicketDetail } from "../../src/pages/StaffTicketDetail";
import { StatusHistory } from "../../src/components/StatusHistory";
import { AppShell } from "../../src/components/AppShell";
import { StaffTicketQueue } from "../../src/pages/StaffTicketQueue";
import { MyTickets } from "../../src/pages/MyTickets";
import {
  ApiError,
  getAssignableUsers,
  getCategories,
  getCurrentUser,
  getStaffTicket,
  listStaffTickets,
  listTickets,
  setTicketStatus,
} from "../../src/api";
import type { Role } from "../../src/api";

vi.mock("../../src/api", async () => {
  const actual = await vi.importActual<typeof import("../../src/api")>("../../src/api");
  return {
    ...actual,
    getCurrentUser: vi.fn(),
    getStaffTicket: vi.fn(),
    getAssignableUsers: vi.fn(),
    setTicketStatus: vi.fn(),
    getCategories: vi.fn(),
    listStaffTickets: vi.fn(),
    listTickets: vi.fn(),
  };
});

const mocked = {
  getCurrentUser: vi.mocked(getCurrentUser),
  getStaffTicket: vi.mocked(getStaffTicket),
  getAssignableUsers: vi.mocked(getAssignableUsers),
  setTicketStatus: vi.mocked(setTicketStatus),
  getCategories: vi.mocked(getCategories),
  listStaffTickets: vi.mocked(listStaffTickets),
  listTickets: vi.mocked(listTickets),
};

const EMPTY_PAGE = { data: [], pagination: { page: 1, pageSize: 20, totalItems: 0, totalPages: 0 } };

const STAFF = makeAuthUser({ id: 21, name: "Michael Brown", role: "IT_STAFF" });

function renderDetail() {
  return renderWithProviders(<StaffTicketDetail />, { route: "/queue/1", path: "/queue/:id" });
}

beforeEach(() => {
  vi.resetAllMocks();
  mocked.getCurrentUser.mockResolvedValue(STAFF);
  mocked.getAssignableUsers.mockResolvedValue(ASSIGNABLE_USERS);
});

describe("Ticket workflow on the IT Staff Ticket Detail", () => {
  // UI-11 - AC-10
  it("shows the reason from the gate under the status control", async () => {
    mocked.getStaffTicket.mockResolvedValue(
      makeStaffTicketDetail({ currentStatus: "IN_PROGRESS", ownerId: 21, ownerName: "Michael Brown" })
    );
    mocked.setTicketStatus.mockRejectedValue(
      new ApiError(409, "Complete or cancel the open actions before resolving this ticket", undefined, "OPEN_ACTIONS")
    );
    const user = userEvent.setup();
    renderDetail();

    const select = await screen.findByLabelText(/current status/i);
    await user.selectOptions(select, "RESOLVED");

    const field = select.closest(".zen-field") as HTMLElement;
    expect(await within(field).findByText(/complete or cancel the open actions/i)).toBeInTheDocument();
    // A gate refusal is not a conflict: there is nothing to reload.
    expect(within(field).queryByRole("button", { name: /reload/i })).not.toBeInTheDocument();
  });

  // UI-12 - AC-13, BR-22
  it("sends the version on screen and offers a reload when someone changed the ticket", async () => {
    mocked.getStaffTicket.mockResolvedValue(
      makeStaffTicketDetail({ currentStatus: "OPEN", ownerId: 21, ownerName: "Michael Brown", version: 4 })
    );
    mocked.setTicketStatus.mockRejectedValue(
      new ApiError(409, "This ticket was changed by someone else. Reload it and try again.", undefined, "STALE_UPDATE")
    );
    const user = userEvent.setup();
    renderDetail();

    await user.selectOptions(await screen.findByLabelText(/current status/i), "IN_PROGRESS");

    expect(mocked.setTicketStatus).toHaveBeenCalledWith(1, "IN_PROGRESS", 4);
    expect(await screen.findByText(/changed by someone else/i)).toBeInTheDocument();

    mocked.getStaffTicket.mockResolvedValue(
      makeStaffTicketDetail({ currentStatus: "WAITING_FOR_REQUESTER", ownerId: 21, version: 5 })
    );
    await user.click(screen.getByRole("button", { name: /reload the ticket/i }));

    expect(mocked.getStaffTicket).toHaveBeenCalledTimes(2);
    expect(await screen.findByText(/^Waiting For Requester$/, { selector: "option" })).toBeInTheDocument();
    expect(screen.queryByText(/changed by someone else/i)).not.toBeInTheDocument();
  });

  // UI-13 - AC-14
  it("lists the status history oldest first, with who and when", () => {
    render(
      <StatusHistory
        changes={[
          { id: 1, fromStatus: "NEW", toStatus: "OPEN", changedById: 21, changedByName: "Michael Brown", changedAt: "2026-10-20T09:00:00.000Z" },
          { id: 2, fromStatus: "OPEN", toStatus: "RESOLVED", changedById: 22, changedByName: "Emily Davis", changedAt: "2026-10-21T09:00:00.000Z" },
        ]}
      />
    );

    const rows = screen.getAllByRole("listitem");
    expect(rows[0]).toHaveTextContent(/New.*to.*Open/);
    expect(rows[0]).toHaveTextContent("Michael Brown");
    expect(rows[1]).toHaveTextContent(/Open.*to.*Resolved/);
    expect(rows[1]).toHaveTextContent("Emily Davis");
  });

  it("says when a ticket has no history yet (legacy ticket)", () => {
    render(<StatusHistory changes={[]} />);
    expect(screen.getByText(/no status changes recorded/i)).toBeInTheDocument();
  });
});

describe("Lab 4 navigation and drill-down", () => {
  // UI-14 - FR-13
  it("puts Dashboard first in the navigation of every role, next to the Lab 3 items", async () => {
    const expected: Record<Role, string[]> = {
      REQUESTER: ["Dashboard", "My Tickets", "Create Ticket"],
      IT_STAFF: ["Dashboard", "Ticket Queue"],
      ADMINISTRATOR: ["Dashboard", "Ticket Queue", "Users"],
    };
    for (const role of Object.keys(expected) as Role[]) {
      mocked.getCurrentUser.mockResolvedValue(makeAuthUser({ role }));
      const { unmount } = renderWithProviders(<AppShell />, { route: "/dashboard" });
      const nav = await screen.findByRole("navigation", { name: /main navigation/i });
      const labels = within(nav).getAllByRole("link").map((l) => l.textContent?.replace(/^\S+\s/, ""));
      expect(labels).toEqual(expected[role]);
      expect(within(nav).getByRole("link", { name: /dashboard/i })).toHaveClass("is-active");
      unmount();
    }
  });

  // UI-15 - FR-12
  it("starts the queue and My Tickets with the filter written in the URL", async () => {
    mocked.getCategories.mockResolvedValue([]);
    mocked.listStaffTickets.mockResolvedValue(EMPTY_PAGE);
    mocked.listTickets.mockResolvedValue(EMPTY_PAGE);

    const queue = renderWithProviders(<StaffTicketQueue />, { route: "/queue?ownerId=unassigned&statusGroup=active" });
    await screen.findByRole("heading", { name: /ticket queue/i });
    expect(mocked.listStaffTickets.mock.calls[0]![0]).toMatchObject({
      ownerId: "unassigned",
      statusGroup: "active",
      currentStatus: undefined,
    });
    expect(screen.getByLabelText(/^status$/i)).toHaveDisplayValue("Active (not finished)");
    queue.unmount();

    mocked.getCurrentUser.mockResolvedValue(makeAuthUser());
    renderWithProviders(<MyTickets />, { route: "/tickets?currentStatus=WAITING_FOR_REQUESTER" });
    await screen.findByRole("heading", { name: /my tickets/i });
    await vi.waitFor(() => expect(mocked.listTickets).toHaveBeenCalled());
    expect(mocked.listTickets.mock.calls[0]![0]).toMatchObject({ currentStatus: "WAITING_FOR_REQUESTER" });
    expect(screen.getByLabelText(/filter by current status/i)).toHaveDisplayValue("Waiting For Requester");
  });
});
