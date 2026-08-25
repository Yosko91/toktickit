import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders, SEEDED_REQUESTER, selectSeededRequester } from "./testUtils";
import { CreateTicket } from "../../src/pages/CreateTicket";
import {
  ApiError,
  createTicket,
  getActiveRequesters,
  getCategories,
  getRelatedSystems,
} from "../../src/api";
import type { TicketDetail } from "../../src/api";

vi.mock("../../src/api", async () => {
  const actual = await vi.importActual<typeof import("../../src/api")>("../../src/api");
  return {
    ...actual,
    getActiveRequesters: vi.fn(),
    getCategories: vi.fn(),
    getRelatedSystems: vi.fn(),
    createTicket: vi.fn(),
  };
});

const mocked = {
  getActiveRequesters: vi.mocked(getActiveRequesters),
  getCategories: vi.mocked(getCategories),
  getRelatedSystems: vi.mocked(getRelatedSystems),
  createTicket: vi.mocked(createTicket),
};

function ticketFixture(overrides: Partial<TicketDetail> = {}): TicketDetail {
  return {
    id: 42,
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
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    attachments: [],
    ...overrides,
  };
}

beforeEach(() => {
  sessionStorage.clear();
  vi.resetAllMocks();
  selectSeededRequester();
  mocked.getActiveRequesters.mockResolvedValue([SEEDED_REQUESTER]);
  mocked.getCategories.mockResolvedValue([{ id: 1, name: "Hardware" }]);
  mocked.getRelatedSystems.mockResolvedValue([{ id: 1, name: "Corporate Laptop" }]);
});

async function fillValidForm(user: ReturnType<typeof userEvent.setup>) {
  await user.selectOptions(await screen.findByLabelText(/category/i), "1");
  await user.selectOptions(screen.getByLabelText(/related system/i), "1");
  await user.type(screen.getByLabelText(/ticket summary/i), "Laptop battery drains quickly");
  await user.type(
    screen.getByLabelText(/description/i),
    "My laptop battery is draining much faster than usual even when idle."
  );
}

describe("CreateTicket", () => {
  it("shows the Requester populated from the selected development requester context", async () => {
    renderWithProviders(<CreateTicket />);
    expect(await screen.findByText(SEEDED_REQUESTER.name)).toBeInTheDocument();
  });

  // UI-03 - AC-04
  it("shows a field error and does not call the API when Summary is empty", async () => {
    const user = userEvent.setup();
    renderWithProviders(<CreateTicket />);

    await user.selectOptions(await screen.findByLabelText(/category/i), "1");
    await user.selectOptions(screen.getByLabelText(/related system/i), "1");
    await user.type(
      screen.getByLabelText(/description/i),
      "My laptop battery is draining much faster than usual even when idle."
    );
    await user.click(screen.getByRole("button", { name: /submit ticket/i }));

    expect(await screen.findByText(/summary must be 5-120 characters/i)).toBeInTheDocument();
    expect(mocked.createTicket).not.toHaveBeenCalled();
  });

  // UI-04 - AC-07
  it("disables Submit and calls the API only once when clicked twice", async () => {
    const user = userEvent.setup();
    let resolveCreate!: (value: TicketDetail) => void;
    mocked.createTicket.mockReturnValue(
      new Promise<TicketDetail>((resolve) => {
        resolveCreate = resolve;
      })
    );

    renderWithProviders(<CreateTicket />);
    await fillValidForm(user);

    const submit = screen.getByRole("button", { name: /submit ticket/i });
    await user.click(submit);
    await user.click(submit);

    expect(submit).toBeDisabled();
    expect(mocked.createTicket).toHaveBeenCalledTimes(1);

    resolveCreate(ticketFixture());
  });

  // UI-05 - AC-06
  it("shows a banner and keeps entered values when the server is unreachable", async () => {
    const user = userEvent.setup();
    mocked.createTicket.mockRejectedValue(new ApiError(0, "Unable to reach the TokTickIT server"));

    renderWithProviders(<CreateTicket />);
    await fillValidForm(user);
    await user.click(screen.getByRole("button", { name: /submit ticket/i }));

    expect(await screen.findByText(/unable to reach the toktickit server/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/ticket summary/i)).toHaveValue("Laptop battery drains quickly");
  });

  // UI-06 - AC-25
  it("shows the confirmation with the backend-issued Ticket Number on success", async () => {
    const user = userEvent.setup();
    mocked.createTicket.mockResolvedValue(ticketFixture());

    renderWithProviders(<CreateTicket />);
    await fillValidForm(user);
    await user.click(screen.getByRole("button", { name: /submit ticket/i }));

    expect(await screen.findByText("TKT-2026-000042")).toBeInTheDocument();
  });

  // UI-07 - AC-16
  it("rejects a disallowed attachment type client-side without adding it to the list", async () => {
    // applyAccept: false - the `accept` attribute is a UX hint (an OS file
    // dialog filter, and one a drag-and-drop can bypass entirely); the real
    // check is validateAttachmentFile() below it, which this test targets.
    const user = userEvent.setup({ applyAccept: false });
    renderWithProviders(<CreateTicket />);
    await screen.findByLabelText(/category/i);

    const fileInput = screen.getByLabelText(/choose attachment files/i);
    const badFile = new File(["x"], "malware.exe", { type: "application/x-msdownload" });
    await user.upload(fileInput, badFile);

    expect(
      await screen.findByText(/only jpg, png, webp, and pdf files are permitted/i)
    ).toBeInTheDocument();
  });
});
