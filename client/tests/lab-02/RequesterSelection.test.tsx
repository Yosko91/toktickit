import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "./testUtils";
import { RequesterSelection } from "../../src/pages/RequesterSelection";
import { getActiveRequesters } from "../../src/api";

vi.mock("../../src/api", async () => {
  const actual = await vi.importActual<typeof import("../../src/api")>("../../src/api");
  return { ...actual, getActiveRequesters: vi.fn() };
});
const mockGetActiveRequesters = vi.mocked(getActiveRequesters);

beforeEach(() => {
  sessionStorage.clear();
  vi.resetAllMocks();
});

describe("RequesterSelection", () => {
  // UI-01 - BR-05
  it("shows the not-a-login-screen notice and the active requesters", async () => {
    mockGetActiveRequesters.mockResolvedValue([
      { id: 1, name: "Jennifer Anderson", email: "jennifer.anderson@toktickit.dev" },
      { id: 2, name: "Sarah Johnson", email: "sarah.johnson@toktickit.dev" },
    ]);

    renderWithProviders(<RequesterSelection />);

    expect(await screen.findByRole("option", { name: "Jennifer Anderson" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Sarah Johnson" })).toBeInTheDocument();
    expect(screen.getByText(/not a login screen/i)).toBeInTheDocument();
    expect(screen.getByText(/only active development requesters are shown/i)).toBeInTheDocument();
  });

  it("keeps Continue disabled until a requester is chosen", async () => {
    mockGetActiveRequesters.mockResolvedValue([
      { id: 1, name: "Jennifer Anderson", email: "jennifer.anderson@toktickit.dev" },
    ]);
    renderWithProviders(<RequesterSelection />);

    await screen.findByRole("option", { name: "Jennifer Anderson" });
    expect(screen.getByRole("button", { name: /continue/i })).toBeDisabled();
  });

  // UI-02 - AC-22
  it("shows a failure state with Retry when loading fails", async () => {
    mockGetActiveRequesters.mockRejectedValue(new Error("network down"));

    renderWithProviders(<RequesterSelection />);

    expect(await screen.findByText(/unable to load development requesters/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();
  });

  // AC-22 (empty branch): no active requesters is not the same as a failure.
  it("shows an empty state (not a crash) when no active requesters exist", async () => {
    mockGetActiveRequesters.mockResolvedValue([]);

    renderWithProviders(<RequesterSelection />);

    expect(
      await screen.findByText(/no active development requesters are available/i)
    ).toBeInTheDocument();
  });
});
