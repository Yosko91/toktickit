import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SEEDED_REQUESTER, renderWithProviders } from "../lab-02/testUtils";
import { RequesterDashboard } from "../../src/pages/RequesterDashboard";
import { ApiError, getCurrentUser, getRequesterDashboard } from "../../src/api";
import type { DashboardTicket, RequesterDashboardData } from "../../src/api";

vi.mock("../../src/api", async () => {
  const actual = await vi.importActual<typeof import("../../src/api")>("../../src/api");
  return { ...actual, getCurrentUser: vi.fn(), getRequesterDashboard: vi.fn() };
});

const mocked = {
  getCurrentUser: vi.mocked(getCurrentUser),
  getRequesterDashboard: vi.mocked(getRequesterDashboard),
};

function item(overrides: Partial<DashboardTicket> = {}): DashboardTicket {
  return {
    id: 3,
    ticketNumber: "TKT-2026-000003",
    summary: "Cannot connect to VPN from home",
    currentStatus: "WAITING_FOR_REQUESTER",
    itPriority: "HIGH",
    ownerName: "Emily Davis",
    updatedAt: "2026-10-25T09:00:00.000Z",
    resolvedAt: null,
    ...overrides,
  };
}

function data(values: number[], lists: Partial<RequesterDashboardData> = {}): RequesterDashboardData {
  const [active, waiting, resolved, closed] = values;
  return {
    generatedAt: "2026-10-26T05:00:00.000Z",
    metrics: [
      { key: "active", label: "My Active Tickets", value: active!, link: "/tickets?statusGroup=active" },
      { key: "waiting", label: "Waiting for Me", value: waiting!, link: "/tickets?currentStatus=WAITING_FOR_REQUESTER" },
      { key: "resolved", label: "Resolved", value: resolved!, link: "/tickets?currentStatus=RESOLVED" },
      { key: "closed", label: "Closed", value: closed!, link: "/tickets?currentStatus=CLOSED" },
    ],
    needsAttention: [],
    recentlyUpdated: [],
    recentlyResolved: [],
    ...lists,
  };
}

beforeEach(() => {
  vi.resetAllMocks();
  mocked.getCurrentUser.mockResolvedValue(SEEDED_REQUESTER);
});

describe("Requester dashboard", () => {
  // UI-04 - FR-09
  it("shows the Requester's own metrics and the ticket that needs them", async () => {
    mocked.getRequesterDashboard.mockResolvedValue(
      data([3, 1, 1, 2], {
        needsAttention: [item()],
        recentlyUpdated: [item(), item({ id: 4, ticketNumber: "TKT-2026-000004", summary: "Printer offline", currentStatus: "OPEN" })],
        recentlyResolved: [item({ id: 6, ticketNumber: "TKT-2026-000006", summary: "Grade page freezes", currentStatus: "RESOLVED" })],
      })
    );
    renderWithProviders(<RequesterDashboard />, { route: "/dashboard" });

    expect(await screen.findByRole("heading", { name: /welcome, jennifer/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View Waiting for Me: 1" })).toHaveAttribute(
      "href",
      "/tickets?currentStatus=WAITING_FOR_REQUESTER"
    );
    const attention = screen.getByRole("region", { name: /needs my attention/i });
    expect(within(attention).getByRole("link", { name: /TKT-2026-000003/ })).toHaveAttribute("href", "/tickets/3");
    expect(within(screen.getByRole("region", { name: /recently resolved/i })).getByText("Grade page freezes")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /create ticket/i })).toHaveAttribute("href", "/tickets/new");
  });

  // UI-04 - AC-20
  it("shows four zeros and the empty sentences for a Requester with no ticket", async () => {
    mocked.getRequesterDashboard.mockResolvedValue(data([0, 0, 0, 0]));
    renderWithProviders(<RequesterDashboard />, { route: "/dashboard" });

    expect(await screen.findByRole("link", { name: "View My Active Tickets: 0" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View Closed: 0" })).toBeInTheDocument();
    expect(screen.getByText(/nothing is waiting for you/i)).toBeInTheDocument();
    expect(screen.getByText(/you have no tickets yet/i)).toBeInTheDocument();
    expect(screen.getByText(/nothing was resolved in the last 30 days/i)).toBeInTheDocument();
  });

  // UI-05 - FR-15
  it("shows a safe failure and loads again on Retry", async () => {
    mocked.getRequesterDashboard
      .mockRejectedValueOnce(new ApiError(500, "Unable to load the dashboard"))
      .mockResolvedValueOnce(data([1, 0, 0, 0]));
    const user = userEvent.setup();
    renderWithProviders(<RequesterDashboard />, { route: "/dashboard" });

    expect(await screen.findByRole("alert")).toHaveTextContent(/unable to load your dashboard/i);
    await user.click(screen.getByRole("button", { name: /retry/i }));

    expect(await screen.findByRole("link", { name: "View My Active Tickets: 1" })).toBeInTheDocument();
    expect(mocked.getRequesterDashboard).toHaveBeenCalledTimes(2);
  });
});
