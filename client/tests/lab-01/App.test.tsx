import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../../src/App";
import { checkSystem } from "../../src/api";
import type { SystemStatus } from "../../src/api";

vi.mock("../../src/api", () => ({ checkSystem: vi.fn() }));

const mockCheckSystem = vi.mocked(checkSystem);

const SEEDED: SystemStatus = {
  online: true,
  categories: [
    { id: 1, name: "Account and Access" },
    { id: 2, name: "Hardware" },
    { id: 3, name: "Software" },
    { id: 4, name: "Network" },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("App", () => {
  // UI-01
  it("renders the TokTickIT heading", () => {
    render(<App />);
    expect(screen.getByText(/TokTickIT/i)).toBeInTheDocument();
  });

  // UI-02
  it("shows the loading state, then Online and the category list", async () => {
    let resolveCheck!: (value: SystemStatus) => void;
    mockCheckSystem.mockReturnValue(
      new Promise<SystemStatus>((resolve) => {
        resolveCheck = resolve;
      })
    );

    render(<App />);
    await userEvent.click(screen.getByRole("button", { name: /check system/i }));

    expect(screen.getByRole("status")).toHaveTextContent(/loading/i);

    resolveCheck(SEEDED);

    expect(await screen.findByText("Online")).toBeInTheDocument();
    expect(screen.getByText("Account and Access")).toBeInTheDocument();
    expect(screen.getByText("Hardware")).toBeInTheDocument();
    expect(screen.getByText("Software")).toBeInTheDocument();
    expect(screen.getByText("Network")).toBeInTheDocument();
  });

  // UI-03
  it("shows an Offline error message when the API is unavailable", async () => {
    mockCheckSystem.mockRejectedValue(new Error("API unreachable"));

    render(<App />);
    await userEvent.click(screen.getByRole("button", { name: /check system/i }));

    expect(await screen.findByText("Offline")).toBeInTheDocument();
    expect(
      screen.getByText(/Unable to connect to TokTickIT API/i)
    ).toBeInTheDocument();
  });
});
