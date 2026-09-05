import type { ReactElement } from "react";
import { render } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { RequesterProvider } from "../../src/context/RequesterContext";
import type { RequestedPriority, Requester, TicketListItem, TicketStatus } from "../../src/api";

export const SEEDED_REQUESTER: Requester = {
  id: 1,
  name: "Jennifer Anderson",
  email: "jennifer.anderson@toktickit.dev",
};

// BR-07: the app restores a session-stored selection on mount, so tests
// that need an already-selected Requester set this before rendering.
export function selectSeededRequester() {
  sessionStorage.setItem("toktickit.devRequesterId", String(SEEDED_REQUESTER.id));
}

export function renderWithProviders(
  ui: ReactElement,
  { route = "/", path }: { route?: string; path?: string } = {}
) {
  const content = path ? (
    <Routes>
      <Route path={path} element={ui} />
    </Routes>
  ) : (
    ui
  );

  return render(
    <MemoryRouter initialEntries={[route]}>
      <RequesterProvider>{content}</RequesterProvider>
    </MemoryRouter>
  );
}

export function makeTicketListItem(overrides: Partial<TicketListItem> = {}): TicketListItem {
  return {
    id: 1,
    ticketNumber: "TKT-2026-000001",
    summary: "Laptop battery drains quickly",
    categoryName: "Hardware",
    requestedPriority: "MEDIUM" as RequestedPriority,
    currentStatus: "NEW" as TicketStatus,
    createdAt: "2026-08-20T09:00:00.000Z",
    updatedAt: "2026-08-20T09:00:00.000Z",
    ...overrides,
  };
}
