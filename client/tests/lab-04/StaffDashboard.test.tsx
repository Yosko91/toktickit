import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { makeAuthUser, renderWithProviders } from "../lab-02/testUtils";
import { StaffDashboard } from "../../src/pages/StaffDashboard";
import { ApiError, getCurrentUser, getStaffDashboard } from "../../src/api";
import type { StaffDashboardData } from "../../src/api";

vi.mock("../../src/api", async () => {
  const actual = await vi.importActual<typeof import("../../src/api")>("../../src/api");
  return { ...actual, getCurrentUser: vi.fn(), getStaffDashboard: vi.fn() };
});

const mocked = {
  getCurrentUser: vi.mocked(getCurrentUser),
  getStaffDashboard: vi.mocked(getStaffDashboard),
};

const STAFF = makeAuthUser({ id: 21, name: "Michael Brown", role: "IT_STAFF" });
const ADMIN = makeAuthUser({ id: 30, name: "John Smith", role: "ADMINISTRATOR" });

function dashboard(overrides: Partial<StaffDashboardData> = {}): StaffDashboardData {
  return {
    generatedAt: "2026-10-26T05:00:00.000Z",
    metrics: [
      { key: "unassigned", label: "Unassigned", value: 4, link: "/queue?ownerId=unassigned&statusGroup=active" },
      { key: "assignedToMe", label: "Assigned to Me", value: 0, link: "/queue?ownerId=21&statusGroup=active" },
      { key: "myOpenActions", label: "My Open Actions", value: 1, link: "#my-open-actions" },
    ],
    byStatus: [
      { status: "NEW", value: 3, link: "/queue?currentStatus=NEW" },
      { status: "RESOLVED", value: 0, link: "/queue?currentStatus=RESOLVED" },
    ],
    byItPriority: [{ priority: "HIGH", value: 2, link: "/queue?itPriority=HIGH&statusGroup=active" }],
    myOpenActions: [
      { id: 7, ticketId: 5, ticketNumber: "TKT-2026-000005", description: "Replace the battery", status: "PLANNED", actionAt: "2026-10-26T03:00:00.000Z" },
    ],
    urgentTickets: [],
    recentlyUpdated: [
      {
        id: 5,
        ticketNumber: "TKT-2026-000005",
        summary: "Laptop battery drains quickly",
        currentStatus: "IN_PROGRESS",
        itPriority: "MEDIUM",
        ownerName: "Michael Brown",
        updatedAt: "2026-10-26T04:00:00.000Z",
        resolvedAt: null,
      },
    ],
    ...overrides,
  };
}

function renderDashboard() {
  return renderWithProviders(<StaffDashboard />, { route: "/dashboard" });
}

beforeEach(() => {
  vi.resetAllMocks();
  mocked.getCurrentUser.mockResolvedValue(STAFF);
});

describe("IT Staff dashboard", () => {
  // UI-01 - FR-10, AC-19
  it("shows each metric with its value and a link to the filtered list", async () => {
    mocked.getStaffDashboard.mockResolvedValue(dashboard());
    renderDashboard();

    const unassigned = await screen.findByRole("link", { name: "View Unassigned: 4" });
    expect(unassigned).toHaveAttribute("href", "/queue?ownerId=unassigned&statusGroup=active");
    expect(screen.getByRole("link", { name: "View My Open Actions: 1" })).toHaveAttribute("href", "#my-open-actions");
    expect(screen.getByRole("heading", { name: /welcome back, michael/i })).toBeInTheDocument();

    // Status and priority counts are links too, with a text badge.
    const newLink = screen.getByRole("link", { name: /^New:\s*3$/ });
    expect(newLink).toHaveAttribute("href", "/queue?currentStatus=NEW");
    expect(screen.getByRole("link", { name: /^High:\s*2$/ })).toHaveAttribute(
      "href",
      "/queue?itPriority=HIGH&statusGroup=active"
    );
    expect(screen.getByRole("link", { name: /TKT-2026-000005.*Replace the battery/ })).toHaveAttribute("href", "/queue/5");
  });

  // UI-02 - AC-17
  it("adds the user counts card for an Administrator only", async () => {
    mocked.getStaffDashboard.mockResolvedValue(dashboard());
    const { unmount } = renderDashboard();
    await screen.findByRole("link", { name: "View Unassigned: 4" });
    expect(screen.queryByText(/active users/i)).not.toBeInTheDocument();
    unmount();

    mocked.getCurrentUser.mockResolvedValue(ADMIN);
    mocked.getStaffDashboard.mockResolvedValue(
      dashboard({
        userCounts: { activeRequesters: 7, activeItStaff: 3, activeAdministrators: 2, inactiveUsers: 2, link: "/admin/users" },
      })
    );
    renderDashboard();

    expect(await screen.findByRole("link", { name: "View Active Users: 12" })).toHaveAttribute("href", "/admin/users");
    expect(screen.getByText(/7 requesters · 3 IT staff · 2 admins · 2 inactive/)).toBeInTheDocument();
  });

  // UI-03 - BR-31, FR-15
  it("shows loading, then a safe failure with Retry, then zeros and empty lists", async () => {
    let fail: (err: unknown) => void = () => {};
    mocked.getStaffDashboard.mockImplementationOnce(
      () => new Promise((_resolve, reject) => {
        fail = reject;
      })
    );
    const user = userEvent.setup();
    renderDashboard();

    expect(await screen.findByRole("status")).toHaveTextContent(/loading the dashboard/i);
    fail(new ApiError(0, "Unable to reach the TokTickIT server"));
    expect(await screen.findByRole("alert")).toHaveTextContent(/unable to reach the toktickit server/i);

    mocked.getStaffDashboard.mockResolvedValue(
      dashboard({
        metrics: dashboard().metrics.map((m) => ({ ...m, value: 0 })),
        myOpenActions: [],
        urgentTickets: [],
        recentlyUpdated: [],
      })
    );
    await user.click(screen.getByRole("button", { name: /retry/i }));

    // A zero is still a card with a working link.
    expect(await screen.findByRole("link", { name: "View Unassigned: 0" })).toBeInTheDocument();
    expect(screen.getByText(/no planned or running actions/i)).toBeInTheDocument();
    expect(screen.getByText(/no active high priority ticket/i)).toBeInTheDocument();
    expect(mocked.getStaffDashboard).toHaveBeenCalledTimes(2);
  });
});
