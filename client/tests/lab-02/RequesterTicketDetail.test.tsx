import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders, SEEDED_REQUESTER } from "./testUtils";
import { TicketDetail } from "../../src/pages/TicketDetail";
import { RemoveAttachmentDialog } from "../../src/components/RemoveAttachmentDialog";
import { getCurrentUser, getTicket } from "../../src/api";
import type { TicketDetail as TicketDetailType } from "../../src/api";

vi.mock("../../src/api", async () => {
  const actual = await vi.importActual<typeof import("../../src/api")>("../../src/api");
  return { ...actual, getCurrentUser: vi.fn(), getTicket: vi.fn() };
});

const mocked = {
  getCurrentUser: vi.mocked(getCurrentUser),
  getTicket: vi.mocked(getTicket),
};

beforeEach(() => {
  sessionStorage.clear();
  vi.resetAllMocks();
  mocked.getCurrentUser.mockResolvedValue(SEEDED_REQUESTER);
});

const TICKET: TicketDetailType = {
  id: 1,
  ticketNumber: "TKT-2026-000042",
  requesterId: SEEDED_REQUESTER.id,
  requesterName: SEEDED_REQUESTER.name,
  categoryId: 1,
  categoryName: "Hardware",
  relatedSystemId: 1,
  relatedSystemName: "Corporate Laptop",
  summary: "Laptop battery drains quickly",
  description: "My laptop battery is draining much faster than usual even when idle.",
  requestedPriority: "MEDIUM",
  currentStatus: "NEW",
  createdAt: "2026-08-20T09:00:00.000Z",
  updatedAt: "2026-08-20T09:00:00.000Z",
  attachments: [],
  // Lab 3 additions to the Requester ticket shape.
  ownerId: null,
  ownerName: null,
  itPriority: "MEDIUM",
  requesterResolvedAt: null,
  publicComments: [],
};

describe("RequesterTicketDetail (Ticket Detail screen)", () => {
  it("renders the read-only ticket fields, the comments panel and no staff controls", async () => {
    mocked.getTicket.mockResolvedValue(TICKET);

    renderWithProviders(<TicketDetail />, { route: "/tickets/1", path: "/tickets/:id" });

    expect(await screen.findByText("TKT-2026-000042")).toBeInTheDocument();
    expect(screen.getByText("Corporate Laptop")).toBeInTheDocument();
    expect(screen.getByText(SEEDED_REQUESTER.name)).toBeInTheDocument();

    // Lab 3 adds Public Comments to this screen (FR-08).
    expect(screen.getByText(/public comments/i)).toBeInTheDocument();

    // BR-26/BR-24: a Requester must never see the private note stream, and has
    // no ownership, IT Priority or status control on this screen.
    expect(screen.queryByText(/internal notes/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/it priority/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/ticket owner/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/actions taken/i)).not.toBeInTheDocument();
  });

  it("shows a not-found message for a ticket that is missing or not owned (BR-13)", async () => {
    const { ApiError } = await import("../../src/api");
    mocked.getTicket.mockRejectedValue(new ApiError(404, "Ticket not found"));

    renderWithProviders(<TicketDetail />, { route: "/tickets/999", path: "/tickets/:id" });

    expect(await screen.findByText(/ticket not found/i)).toBeInTheDocument();
  });
});

describe("Remove attachment dialog (UI-12 - AC-19)", () => {
  it("does not confirm until a valid 3-200 character reason is entered", async () => {
    const onConfirm = vi.fn();
    const user = userEvent.setup();

    render(
      <RemoveAttachmentDialog
        fileName="photo.png"
        submitting={false}
        onCancel={vi.fn()}
        onConfirm={onConfirm}
      />
    );

    await user.click(screen.getByRole("button", { name: /^remove attachment$/i }));
    expect(
      await screen.findByText(/removal reason must be 3-200 characters/i)
    ).toBeInTheDocument();
    expect(onConfirm).not.toHaveBeenCalled();

    await user.type(screen.getByLabelText(/reason for removal/i), "Wrong file, replacing it");
    await user.click(screen.getByRole("button", { name: /^remove attachment$/i }));

    expect(onConfirm).toHaveBeenCalledWith("Wrong file, replacing it");
  });

  it("closes without confirming when Cancel is clicked", async () => {
    const onCancel = vi.fn();
    const user = userEvent.setup();

    render(
      <RemoveAttachmentDialog
        fileName="photo.png"
        submitting={false}
        onCancel={onCancel}
        onConfirm={vi.fn()}
      />
    );

    await user.click(screen.getByRole("button", { name: /cancel/i }));
    expect(onCancel).toHaveBeenCalled();
  });
});
