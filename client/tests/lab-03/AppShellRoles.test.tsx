import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { makeAuthUser, renderWithProviders } from "../lab-02/testUtils";
import { AppShell } from "../../src/components/AppShell";
import { getCurrentUser } from "../../src/api";
import type { Role } from "../../src/api";

vi.mock("../../src/api", async () => {
  const actual = await vi.importActual<typeof import("../../src/api")>("../../src/api");
  return { ...actual, getCurrentUser: vi.fn() };
});

const mockedGetCurrentUser = vi.mocked(getCurrentUser);

beforeEach(() => {
  vi.resetAllMocks();
});

async function renderShellAs(role: Role) {
  mockedGetCurrentUser.mockResolvedValue(makeAuthUser({ role }));
  renderWithProviders(<AppShell />);
  // Wait for the provider to resolve the current user before asserting.
  return screen.findByRole("navigation", { name: /main navigation/i });
}

describe("Application shell navigation by role", () => {
  // UI-13 - AC-25
  it("shows a Requester only their own destinations", async () => {
    const nav = await renderShellAs("REQUESTER");

    expect(nav).toHaveTextContent(/my tickets/i);
    expect(nav).toHaveTextContent(/create ticket/i);
    expect(nav).not.toHaveTextContent(/ticket queue/i);
    expect(nav).not.toHaveTextContent(/users/i);
  });

  it("shows IT Staff the queue, and neither the requester screens nor user management", async () => {
    const nav = await renderShellAs("IT_STAFF");

    expect(nav).toHaveTextContent(/ticket queue/i);
    expect(nav).not.toHaveTextContent(/create ticket/i);
    expect(nav).not.toHaveTextContent(/users/i);
  });

  it("shows an Administrator the queue and user management", async () => {
    const nav = await renderShellAs("ADMINISTRATOR");

    expect(nav).toHaveTextContent(/ticket queue/i);
    expect(nav).toHaveTextContent(/users/i);
    expect(nav).not.toHaveTextContent(/create ticket/i);
  });

  // UI-14 - BR-42
  it("has no Change Requester control left for any role", async () => {
    for (const role of ["REQUESTER", "IT_STAFF", "ADMINISTRATOR"] as Role[]) {
      mockedGetCurrentUser.mockResolvedValue(makeAuthUser({ role }));
      const { unmount } = renderWithProviders(<AppShell />);
      await screen.findByRole("navigation", { name: /main navigation/i });

      expect(screen.queryByText(/change requester/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/development requester/i)).not.toBeInTheDocument();
      unmount();
    }
  });
});
