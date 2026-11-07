import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { makeAuthUser, renderWithProviders } from "../lab-02/testUtils";
import { AppShell } from "../../src/components/AppShell";
import { getCurrentUser, getVersion } from "../../src/api";

vi.mock("../../src/api", async () => {
  const actual = await vi.importActual<typeof import("../../src/api")>("../../src/api");
  return { ...actual, getCurrentUser: vi.fn(), getVersion: vi.fn() };
});

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(getCurrentUser).mockResolvedValue(makeAuthUser({ role: "REQUESTER" }));
});

// Lab 5 - R-08: the footer shows the commit of the running release.
describe("Release footer", () => {
  it("shows the short commit of the running release", async () => {
    vi.mocked(getVersion).mockResolvedValue({ commit: "a1b2c3d4e5f60718293a4b5c6d7e8f9012345678" });

    renderWithProviders(<AppShell />);

    expect(await screen.findByText("TokTickIT release a1b2c3d")).toBeInTheDocument();
  });

  it("shows nothing when the version cannot be loaded", async () => {
    vi.mocked(getVersion).mockRejectedValue(new Error("offline"));

    renderWithProviders(<AppShell />);
    await screen.findByRole("navigation", { name: /main navigation/i });

    expect(screen.queryByText(/TokTickIT release/)).not.toBeInTheDocument();
  });
});
