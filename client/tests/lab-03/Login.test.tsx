import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "../lab-02/testUtils";
import { Login } from "../../src/pages/Login";
import { ApiError, getCurrentUser, login } from "../../src/api";

vi.mock("../../src/api", async () => {
  const actual = await vi.importActual<typeof import("../../src/api")>("../../src/api");
  return { ...actual, getCurrentUser: vi.fn(), login: vi.fn() };
});

const mocked = {
  getCurrentUser: vi.mocked(getCurrentUser),
  login: vi.mocked(login),
};

beforeEach(() => {
  vi.resetAllMocks();
  // Nobody is signed in when the Login screen is shown.
  mocked.getCurrentUser.mockRejectedValue(new ApiError(401, "Authentication required"));
});

describe("Login", () => {
  // UI-01 - AC-01
  it("sends the typed credentials to the login endpoint", async () => {
    mocked.login.mockResolvedValue({
      id: 1,
      name: "Jennifer Anderson",
      email: "jennifer.anderson@toktickit.dev",
      role: "REQUESTER",
      mustChangePassword: false,
    });
    const user = userEvent.setup();

    renderWithProviders(<Login />);

    await user.type(screen.getByLabelText(/email address/i), "jennifer.anderson@toktickit.dev");
    await user.type(screen.getByLabelText(/password/i), "TokTick!2026");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() =>
      expect(mocked.login).toHaveBeenCalledWith("jennifer.anderson@toktickit.dev", "TokTick!2026")
    );
  });

  // UI-02 - AC-05
  it("shows one generic message on a refused credential and keeps the typed email", async () => {
    mocked.login.mockRejectedValue(new ApiError(401, "Invalid email or password"));
    const user = userEvent.setup();

    renderWithProviders(<Login />);

    await user.type(screen.getByLabelText(/email address/i), "someone@toktickit.dev");
    await user.type(screen.getByLabelText(/password/i), "WrongPass!23");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/invalid email or password/i);
    // Retyping the address after a typo in the password would be irritating.
    expect(screen.getByLabelText(/email address/i)).toHaveValue("someone@toktickit.dev");
  });

  it("reports an unreachable server differently from a refused credential", async () => {
    mocked.login.mockRejectedValue(new ApiError(0, "Unable to reach the TokTickIT server"));
    const user = userEvent.setup();

    renderWithProviders(<Login />);

    await user.type(screen.getByLabelText(/email address/i), "someone@toktickit.dev");
    await user.type(screen.getByLabelText(/password/i), "TokTick!2026");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/unable to reach/i);
  });

  it("does not call the API for a malformed email address", async () => {
    const user = userEvent.setup();

    renderWithProviders(<Login />);

    await user.type(screen.getByLabelText(/email address/i), "not-an-email");
    await user.type(screen.getByLabelText(/password/i), "TokTick!2026");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    expect(await screen.findByText(/enter a valid email address/i)).toBeInTheDocument();
    expect(mocked.login).not.toHaveBeenCalled();
  });

  // UI-03 - FR-01
  it("disables the button while signing in, so a double submit cannot open two sessions", async () => {
    let release: (value: never) => void = () => {};
    mocked.login.mockReturnValue(new Promise((resolve) => {
      release = resolve as unknown as (value: never) => void;
    }));
    const user = userEvent.setup();

    renderWithProviders(<Login />);

    await user.type(screen.getByLabelText(/email address/i), "jennifer.anderson@toktickit.dev");
    await user.type(screen.getByLabelText(/password/i), "TokTick!2026");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    const button = await screen.findByRole("button", { name: /signing in/i });
    expect(button).toBeDisabled();

    await user.click(button);
    expect(mocked.login).toHaveBeenCalledTimes(1);

    release(undefined as never);
  });
});
