import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { makeAuthUser, renderWithProviders } from "../lab-02/testUtils";
import { ChangePassword } from "../../src/pages/ChangePassword";
import { changePassword, getCurrentUser } from "../../src/api";

vi.mock("../../src/api", async () => {
  const actual = await vi.importActual<typeof import("../../src/api")>("../../src/api");
  return { ...actual, getCurrentUser: vi.fn(), changePassword: vi.fn() };
});

const mocked = {
  getCurrentUser: vi.mocked(getCurrentUser),
  changePassword: vi.mocked(changePassword),
};

beforeEach(() => {
  vi.resetAllMocks();
  mocked.getCurrentUser.mockResolvedValue(makeAuthUser({ mustChangePassword: true }));
});

describe("ChangePassword", () => {
  // UI-04 - BR-06
  it("marks each rule as it is satisfied and keeps Continue disabled until all pass", async () => {
    const user = userEvent.setup();
    renderWithProviders(<ChangePassword />);

    const newPassword = await screen.findByLabelText(/^new password$/i);
    const submit = screen.getByRole("button", { name: /continue/i });

    expect(submit).toBeDisabled();

    // Long enough and mixed case, but still no digit and no special character.
    await user.type(newPassword, "Abcdefgh");
    expect(screen.getByText(/at least 8 characters/i).closest("li")).toHaveAttribute(
      "data-satisfied",
      "true"
    );
    expect(screen.getByText(/a number/i).closest("li")).toHaveAttribute("data-satisfied", "false");
    expect(submit).toBeDisabled();

    await user.type(newPassword, "1!");
    expect(screen.getByText(/a number/i).closest("li")).toHaveAttribute("data-satisfied", "true");
    expect(screen.getByText(/a special character/i).closest("li")).toHaveAttribute(
      "data-satisfied",
      "true"
    );

    // Every rule passes, but the confirmation is still empty.
    expect(submit).toBeDisabled();
  });

  // UI-05 - AC-02
  it("blocks the submit while the confirmation does not match", async () => {
    const user = userEvent.setup();
    renderWithProviders(<ChangePassword />);

    await user.type(await screen.findByLabelText(/current \(temporary\) password/i), "TokTick!2026");
    await user.type(screen.getByLabelText(/^new password$/i), "Abcdefg1!");
    await user.type(screen.getByLabelText(/confirm new password/i), "Abcdefg1?");

    expect(await screen.findByText(/the two passwords do not match/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /continue/i })).toBeDisabled();
    expect(mocked.changePassword).not.toHaveBeenCalled();
  });

  it("submits once every rule passes and the confirmation matches", async () => {
    mocked.changePassword.mockResolvedValue(makeAuthUser({ mustChangePassword: false }));
    const user = userEvent.setup();
    renderWithProviders(<ChangePassword />);

    await user.type(await screen.findByLabelText(/current \(temporary\) password/i), "TokTick!2026");
    await user.type(screen.getByLabelText(/^new password$/i), "Abcdefg1!");
    await user.type(screen.getByLabelText(/confirm new password/i), "Abcdefg1!");
    await user.click(screen.getByRole("button", { name: /continue/i }));

    expect(mocked.changePassword).toHaveBeenCalledWith("TokTick!2026", "Abcdefg1!");
  });

  it("offers a way out, because a pending change removes all navigation", async () => {
    renderWithProviders(<ChangePassword />);

    expect(await screen.findByRole("button", { name: /sign out instead/i })).toBeInTheDocument();
  });
});
