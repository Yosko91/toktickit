import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  ASSIGNABLE_USERS,
  makeAuthUser,
  makeMessage,
  makeStaffTicketDetail,
  renderWithProviders,
} from "../lab-02/testUtils";
import { StaffTicketDetail } from "../../src/pages/StaffTicketDetail";
import {
  getAssignableUsers,
  getCurrentUser,
  getStaffTicket,
  setTicketOwner,
  setTicketStatus,
} from "../../src/api";

vi.mock("../../src/api", async () => {
  const actual = await vi.importActual<typeof import("../../src/api")>("../../src/api");
  return {
    ...actual,
    getCurrentUser: vi.fn(),
    getStaffTicket: vi.fn(),
    getAssignableUsers: vi.fn(),
    setTicketOwner: vi.fn(),
    setTicketStatus: vi.fn(),
  };
});

const mocked = {
  getCurrentUser: vi.mocked(getCurrentUser),
  getStaffTicket: vi.mocked(getStaffTicket),
  getAssignableUsers: vi.mocked(getAssignableUsers),
  setTicketOwner: vi.mocked(setTicketOwner),
  setTicketStatus: vi.mocked(setTicketStatus),
};

const STAFF = makeAuthUser({ id: 21, name: "Michael Brown", role: "IT_STAFF" });

function renderDetail() {
  return renderWithProviders(<StaffTicketDetail />, { route: "/queue/1", path: "/queue/:id" });
}

beforeEach(() => {
  vi.resetAllMocks();
  mocked.getCurrentUser.mockResolvedValue(STAFF);
  mocked.getAssignableUsers.mockResolvedValue(ASSIGNABLE_USERS);
});

describe("StaffTicketDetail", () => {
  // UI-08 - AC-12
  it("claims the ticket for the signed-in staff member and shows the new owner", async () => {
    mocked.getStaffTicket
      .mockResolvedValueOnce(makeStaffTicketDetail({ ownerId: null, ownerName: null }))
      .mockResolvedValue(makeStaffTicketDetail({ ownerId: 21, ownerName: "Michael Brown" }));
    mocked.setTicketOwner.mockResolvedValue({ id: 1, ownerId: 21, ownerName: "Michael Brown" });
    const user = userEvent.setup();

    renderDetail();

    await user.click(await screen.findByRole("button", { name: /claim/i }));

    expect(mocked.setTicketOwner).toHaveBeenCalledWith(1, STAFF.id);
    // Reloaded in place, without a full page navigation.
    expect(await screen.findByDisplayValue("Michael Brown")).toBeInTheDocument();
  });

  // UI-09 - BR-22
  it("offers only the transitions permitted from the current status", async () => {
    mocked.getStaffTicket.mockResolvedValue(makeStaffTicketDetail({ currentStatus: "NEW" }));

    renderDetail();

    const statusSelect = await screen.findByLabelText(/current status/i);
    const options = within(statusSelect).getAllByRole("option").map((o) => o.textContent);

    expect(options).toEqual(
      expect.arrayContaining(["Move to Open", "Move to In Progress", "Move to Cancelled"])
    );
    // A NEW ticket cannot jump to Resolved or Closed, so those are not offered.
    expect(options).not.toContain("Move to Resolved");
    expect(options).not.toContain("Move to Closed");
  });

  it("offers nothing and says so once the ticket is closed", async () => {
    mocked.getStaffTicket.mockResolvedValue(makeStaffTicketDetail({ currentStatus: "CLOSED" }));

    renderDetail();

    expect(await screen.findByText(/closed is final/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/current status/i)).toBeDisabled();
  });

  it("sends the chosen status and shows a refusal next to the control", async () => {
    const { ApiError } = await import("../../src/api");
    mocked.getStaffTicket.mockResolvedValue(
      makeStaffTicketDetail({ currentStatus: "OPEN", ownerId: null, ownerName: null })
    );
    mocked.setTicketStatus.mockRejectedValue(
      new ApiError(409, "A ticket must have an owner before it can be resolved")
    );
    const user = userEvent.setup();

    renderDetail();

    await user.selectOptions(await screen.findByLabelText(/current status/i), "RESOLVED");

    expect(mocked.setTicketStatus).toHaveBeenCalledWith(1, "RESOLVED");
    expect(await screen.findByText(/must have an owner/i)).toBeInTheDocument();
  });

  // UI-10 - BR-26
  it("renders both message streams, with the internal one clearly marked private", async () => {
    mocked.getStaffTicket.mockResolvedValue(
      makeStaffTicketDetail({
        publicComments: [makeMessage({ id: 1, body: "We are looking into this." })],
        internalNotes: [
          makeMessage({ id: 2, body: "Replacement already ordered.", authorRole: "IT_STAFF" }),
        ],
      })
    );

    renderDetail();

    expect(await screen.findByText(/public comments - visible to the requester/i)).toBeInTheDocument();
    expect(screen.getByText(/internal notes - never visible to the requester/i)).toBeInTheDocument();
    expect(screen.getByText("Replacement already ordered.")).toBeInTheDocument();
  });

  it("keeps the requested priority read-only while IT priority is editable", async () => {
    mocked.getStaffTicket.mockResolvedValue(
      makeStaffTicketDetail({ requestedPriority: "LOW", itPriority: "HIGH" })
    );

    renderDetail();

    // BR-19: there is no control at all for the priority the Requester chose.
    expect(await screen.findByLabelText(/it priority/i)).toBeEnabled();
    expect(screen.queryByLabelText(/requested priority/i)).not.toBeInTheDocument();
  });

  it("shows the requester resolution signal as a notice, not as a status", async () => {
    mocked.getStaffTicket.mockResolvedValue(
      makeStaffTicketDetail({
        currentStatus: "IN_PROGRESS",
        requesterResolvedAt: "2026-09-01T10:00:00.000Z",
      })
    );

    renderDetail();

    const notice = await screen.findByText(/the requester reported this looks resolved/i);
    expect(notice).toBeInTheDocument();
    expect(notice).toHaveTextContent(/still in progress/i);
  });
});
