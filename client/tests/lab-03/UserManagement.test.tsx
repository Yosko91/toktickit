import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { makeAuthUser, renderWithProviders } from "../lab-02/testUtils";
import { UserManagement } from "../../src/pages/UserManagement";
import { ApiError, createUser, getCurrentUser, listUsers, updateUser } from "../../src/api";
import type { ManagedUser, Role } from "../../src/api";

vi.mock("../../src/api", async () => {
  const actual = await vi.importActual<typeof import("../../src/api")>("../../src/api");
  return {
    ...actual,
    getCurrentUser: vi.fn(),
    listUsers: vi.fn(),
    createUser: vi.fn(),
    updateUser: vi.fn(),
    setInitialPassword: vi.fn(),
  };
});

const mocked = {
  getCurrentUser: vi.mocked(getCurrentUser),
  listUsers: vi.mocked(listUsers),
  createUser: vi.mocked(createUser),
  updateUser: vi.mocked(updateUser),
};

const ADMIN = makeAuthUser({ id: 31, name: "John Smith", role: "ADMINISTRATOR" });

function makeUser(overrides: Partial<ManagedUser> = {}): ManagedUser {
  return {
    id: 1,
    name: "Michael Brown",
    email: "michael.brown@toktickit.dev",
    role: "IT_STAFF" as Role,
    isActive: true,
    mustChangePassword: false,
    createdAt: "2026-08-20T09:00:00.000Z",
    ...overrides,
  };
}

beforeEach(() => {
  vi.resetAllMocks();
  mocked.getCurrentUser.mockResolvedValue(ADMIN);
});

describe("UserManagement", () => {
  // UI-11 - AC-18
  it("lists users with their name, email, role and status", async () => {
    mocked.listUsers.mockResolvedValue([
      makeUser(),
      makeUser({ id: 2, name: "Kevin Patel", email: "kevin@toktickit.dev", isActive: false }),
    ]);

    renderWithProviders(<UserManagement />);

    expect(await screen.findByText("Michael Brown")).toBeInTheDocument();
    expect(screen.getByText("michael.brown@toktickit.dev")).toBeInTheDocument();
    expect(screen.getAllByText("IT Staff").length).toBeGreaterThan(0);
    expect(screen.getByText("Active")).toBeInTheDocument();
    // A deactivated account has to be visible at a glance, not only in text.
    expect(screen.getByText("Inactive")).toBeInTheDocument();
  });

  it("narrows the list by role", async () => {
    mocked.listUsers.mockResolvedValue([makeUser()]);
    const user = userEvent.setup();

    renderWithProviders(<UserManagement />);
    await screen.findByText("Michael Brown");

    await user.selectOptions(screen.getByLabelText(/^role$/i), "ADMINISTRATOR");

    expect(mocked.listUsers).toHaveBeenLastCalledWith(
      expect.objectContaining({ role: "ADMINISTRATOR" })
    );
  });

  // UI-12 - AC-19
  it("shows a duplicate email refusal under the email field", async () => {
    mocked.listUsers.mockResolvedValue([makeUser()]);
    mocked.createUser.mockRejectedValue(
      new ApiError(409, "Validation failed", {
        email: "An account with this email address already exists",
      })
    );
    const user = userEvent.setup();

    renderWithProviders(<UserManagement />);
    await user.click(await screen.findByRole("button", { name: /create user/i }));

    await user.type(screen.getByLabelText(/full name/i), "Alex Thompson");
    await user.type(screen.getByLabelText(/email address/i), "michael.brown@toktickit.dev");
    await user.type(screen.getByLabelText(/initial password/i), "Initial!2026");
    await user.click(screen.getByRole("button", { name: /save user/i }));

    expect(
      await screen.findByText(/an account with this email address already exists/i)
    ).toBeInTheDocument();
  });

  it("keeps Save disabled until the initial password meets every rule", async () => {
    mocked.listUsers.mockResolvedValue([]);
    const user = userEvent.setup();

    renderWithProviders(<UserManagement />);
    await user.click(await screen.findByRole("button", { name: /create user/i }));

    const save = screen.getByRole("button", { name: /save user/i });
    expect(save).toBeDisabled();

    await user.type(screen.getByLabelText(/initial password/i), "Initial!2026");
    expect(save).toBeEnabled();
  });

  // AC-21 - BR-35: a rule refusal is about the operation, not one field, so it
  // is shown as an alert rather than under an input.
  it("shows the last-administrator refusal as a panel-level alert", async () => {
    mocked.listUsers.mockResolvedValue([
      makeUser({ id: 9, name: "Lisa Martinez", role: "ADMINISTRATOR" }),
    ]);
    mocked.updateUser.mockRejectedValue(
      new ApiError(409, "The last active administrator cannot be deactivated or demoted")
    );
    const user = userEvent.setup();

    renderWithProviders(<UserManagement />);
    await user.click(await screen.findByRole("button", { name: /edit/i }));
    await user.click(screen.getByRole("button", { name: /deactivate user/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/last active administrator/i);
  });

  // AC-22 - BR-34
  it("disables the self-deactivation and self-demotion controls on the administrator's own row", async () => {
    mocked.listUsers.mockResolvedValue([
      makeUser({ id: ADMIN.id, name: ADMIN.name, email: ADMIN.email, role: "ADMINISTRATOR" }),
    ]);
    const user = userEvent.setup();

    renderWithProviders(<UserManagement />);
    await user.click(await screen.findByRole("button", { name: /edit/i }));

    expect(screen.getByRole("button", { name: /deactivate user/i })).toBeDisabled();
    expect(screen.getByLabelText(/^role$/i, { selector: "#user-role" })).toBeDisabled();
    expect(screen.getByText(/you cannot deactivate your own account/i)).toBeInTheDocument();
  });

  it("creates a user and reports that they must change the password", async () => {
    mocked.listUsers.mockResolvedValue([]);
    mocked.createUser.mockResolvedValue(makeUser({ id: 5, name: "Alex Thompson" }));
    const user = userEvent.setup();

    renderWithProviders(<UserManagement />);
    await user.click(await screen.findByRole("button", { name: /create user/i }));

    await user.type(screen.getByLabelText(/full name/i), "Alex Thompson");
    await user.type(screen.getByLabelText(/email address/i), "alex.thompson@toktickit.dev");
    await user.selectOptions(screen.getByLabelText(/^role$/i, { selector: "#user-role" }), "IT_STAFF");
    await user.type(screen.getByLabelText(/initial password/i), "Initial!2026");
    await user.click(screen.getByRole("button", { name: /save user/i }));

    expect(mocked.createUser).toHaveBeenCalledWith({
      name: "Alex Thompson",
      email: "alex.thompson@toktickit.dev",
      role: "IT_STAFF",
      isActive: true,
      initialPassword: "Initial!2026",
    });
    expect(await screen.findByRole("status")).toHaveTextContent(/must change the password/i);
  });

  it("shows a retry control when the list cannot be loaded", async () => {
    mocked.listUsers.mockRejectedValue(new ApiError(0, "Unable to reach the TokTickIT server"));

    renderWithProviders(<UserManagement />);

    expect(await screen.findByText(/unable to load users/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();
  });

  it("does not offer any way to delete a user", async () => {
    mocked.listUsers.mockResolvedValue([makeUser()]);
    const user = userEvent.setup();

    renderWithProviders(<UserManagement />);
    await user.click(await screen.findByRole("button", { name: /edit/i }));

    // BR-36: deactivation replaces deletion entirely.
    const panel = screen.getByRole("complementary");
    expect(within(panel).queryByRole("button", { name: /delete/i })).not.toBeInTheDocument();
  });
});
