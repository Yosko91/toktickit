import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ActionsTakenSection } from "../../src/components/ActionsTakenSection";
import { ApiError, createAction, updateAction } from "../../src/api";
import { ASSIGNABLE_USERS, makeAction } from "../lab-02/testUtils";

vi.mock("../../src/api", async () => {
  const actual = await vi.importActual<typeof import("../../src/api")>("../../src/api");
  return { ...actual, createAction: vi.fn(), updateAction: vi.fn() };
});

const mocked = {
  createAction: vi.mocked(createAction),
  updateAction: vi.mocked(updateAction),
};

const ME = 21; // Michael Brown in ASSIGNABLE_USERS

function renderStaff(actions = [makeAction()], onChanged = vi.fn()) {
  render(
    <ActionsTakenSection
      ticketId={1}
      ticketStatus="IN_PROGRESS"
      actions={actions}
      mode="staff"
      currentUserId={ME}
      staffUsers={ASSIGNABLE_USERS}
      onChanged={onChanged}
    />
  );
  return onChanged;
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("Actions Taken", () => {
  // UI-06 - FR-04, BR-15
  it("lists the actions in the order of the API with their status, performer and follow-up", () => {
    renderStaff([
      makeAction({ id: 1, description: "First action", status: "COMPLETED" }),
      makeAction({
        id: 2,
        description: "Second action",
        status: "PLANNED",
        result: null,
        performedById: 22,
        performedByName: "Emily Davis",
        followUpRequired: true,
        followUpNote: "Call the requester back",
        attachmentNotes: "photo-of-cable.jpg",
      }),
    ]);

    const rows = screen.getAllByRole("listitem");
    expect(rows[0]).toHaveTextContent("First action");
    expect(rows[0]).toHaveTextContent("Completed");
    expect(rows[1]).toHaveTextContent("Second action");
    expect(rows[1]).toHaveTextContent("Planned");
    // BR-02: a colleague did the work, the person who recorded it is shown too.
    expect(rows[1]).toHaveTextContent("Performed by Emily Davis · recorded by Michael Brown");
    expect(rows[1]).toHaveTextContent("Follow-up needed: Call the requester back");
    expect(rows[1]).toHaveTextContent("photo-of-cable.jpg");
    expect(screen.getByRole("heading", { name: /actions taken \(2\)/i })).toBeInTheDocument();
  });

  // UI-07 - AC-05, FR-14
  it("creates an action with me as default performer, shows the field error and blocks double clicks", async () => {
    let reject: (err: unknown) => void = () => {};
    mocked.createAction.mockImplementation(
      () => new Promise((_resolve, rej) => {
        reject = rej;
      })
    );
    const user = userEvent.setup();
    renderStaff([]);

    await user.click(screen.getByRole("button", { name: /add action/i }));
    const form = screen.getByRole("form", { name: /new action/i });

    expect(within(form).getByLabelText(/performed by/i)).toHaveDisplayValue("Michael Brown (me)");
    expect(within(form).getByLabelText(/^status/i)).toHaveDisplayValue("Completed");

    await user.type(within(form).getByLabelText(/action description/i), "Replaced the cable");
    await user.type(within(form).getByLabelText(/^result/i), "Works again");
    await user.click(within(form).getByLabelText(/follow-up required/i));
    await user.click(within(form).getByRole("button", { name: /save action/i }));

    // While the request is running the button cannot be used again.
    const saving = within(form).getByRole("button", { name: /saving/i });
    expect(saving).toBeDisabled();
    await user.click(saving);
    expect(mocked.createAction).toHaveBeenCalledTimes(1);
    expect(mocked.createAction).toHaveBeenCalledWith(
      1,
      expect.objectContaining({
        description: "Replaced the cable",
        performedById: ME,
        followUpRequired: true,
        clientRequestId: expect.any(String),
      })
    );

    reject(
      new ApiError(400, "Validation failed", {
        followUpNote: "A follow-up note is required when a follow-up is needed",
      })
    );

    const noteField = await within(form).findByLabelText(/follow-up note/i);
    expect(noteField.closest(".zen-field")).toHaveTextContent(/a follow-up note is required/i);
    // AC-24: what was typed is still there.
    expect(within(form).getByLabelText(/action description/i)).toHaveValue("Replaced the cable");
  });

  it("sends the same request id again when the user retries after a failure", async () => {
    mocked.createAction
      .mockRejectedValueOnce(new ApiError(0, "Unable to reach the TokTickIT server"))
      .mockResolvedValueOnce(makeAction());
    const onChanged = vi.fn();
    const user = userEvent.setup();
    renderStaff([], onChanged);

    await user.click(screen.getByRole("button", { name: /add action/i }));
    await user.type(screen.getByLabelText(/action description/i), "Rebooted the switch");
    await user.type(screen.getByLabelText(/^result/i), "Network is back");
    await user.click(screen.getByRole("button", { name: /save action/i }));
    expect(await screen.findByText(/unable to reach the toktickit server/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /save action/i }));

    const [first, second] = mocked.createAction.mock.calls;
    expect(second[1].clientRequestId).toBe(first[1].clientRequestId);
    expect(await screen.findByText(/action saved/i)).toBeInTheDocument();
    expect(onChanged).toHaveBeenCalled();
  });

  // UI-08 - BR-08, BR-10
  it("offers only the permitted statuses when editing, and no edit on finished actions", async () => {
    const user = userEvent.setup();
    renderStaff([
      makeAction({ id: 1, description: "Done already", status: "COMPLETED" }),
      makeAction({ id: 2, description: "Still to do", status: "IN_PROGRESS", result: null }),
    ]);

    expect(screen.queryByRole("button", { name: /edit action: done already/i })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /edit action: still to do/i }));
    const form = screen.getByRole("form", { name: /edit action/i });
    const options = within(within(form).getByLabelText(/^status/i))
      .getAllByRole("option")
      .map((o) => o.textContent);

    expect(options).toEqual(["In Progress", "Completed", "Cancelled"]);
  });

  // UI-09 - AC-08, AC-24
  it("shows a reload warning on a stale save and keeps what was typed", async () => {
    mocked.updateAction.mockRejectedValue(
      new ApiError(409, "This action was changed by someone else.", undefined, "STALE_UPDATE")
    );
    const onChanged = vi.fn();
    const user = userEvent.setup();
    renderStaff([makeAction({ id: 5, description: "Planned visit", status: "PLANNED", result: null, version: 3 })], onChanged);

    await user.click(screen.getByRole("button", { name: /edit action: planned visit/i }));
    const description = screen.getByLabelText(/action description/i);
    await user.clear(description);
    await user.type(description, "Planned visit on Monday");
    await user.click(screen.getByRole("button", { name: /save action/i }));

    expect(mocked.updateAction).toHaveBeenCalledWith(1, 5, expect.objectContaining({ version: 3 }));
    expect(await screen.findByText(/changed by someone else/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/action description/i)).toHaveValue("Planned visit on Monday");

    await user.click(screen.getByRole("button", { name: /reload/i }));
    expect(onChanged).toHaveBeenCalled();
  });

  // UI-10 - AC-09, FR-05
  it("shows the Requester every action with no control at all", () => {
    render(
      <ActionsTakenSection
        ticketId={1}
        ticketStatus="IN_PROGRESS"
        actions={[makeAction({ status: "PLANNED", result: null }), makeAction({ id: 2 })]}
        mode="readonly"
      />
    );

    expect(screen.getByRole("heading", { name: /work done by it \(2\)/i })).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("hides Add Action on a closed ticket and says how to record more work", () => {
    render(
      <ActionsTakenSection
        ticketId={1}
        ticketStatus="CLOSED"
        actions={[]}
        mode="staff"
        currentUserId={ME}
        staffUsers={ASSIGNABLE_USERS}
      />
    );

    expect(screen.queryByRole("button", { name: /add action/i })).not.toBeInTheDocument();
    expect(screen.getByText(/reopen the ticket to record more work/i)).toBeInTheDocument();
    expect(screen.getByText(/no actions recorded yet/i)).toBeInTheDocument();
  });
});
