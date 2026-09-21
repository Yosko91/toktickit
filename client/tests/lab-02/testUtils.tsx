import type { ReactElement } from "react";
import { render } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { AuthProvider } from "../../src/context/AuthContext";
import type {
  AuthUser,
  RequestedPriority,
  Role,
  TicketDetail,
  TicketListItem,
  TicketMessage,
  TicketStatus,
} from "../../src/api";

// Lab 3: the provider is AuthProvider rather than the Lab 2 RequesterProvider,
// and identity comes from a mocked getCurrentUser() rather than sessionStorage
// (BR-42). Every suite that renders through here must therefore mock
// getCurrentUser, which is what makeAuthUser is for.

export function makeAuthUser(overrides: Partial<AuthUser> = {}): AuthUser {
  return {
    id: 1,
    name: "Jennifer Anderson",
    email: "jennifer.anderson@toktickit.dev",
    role: "REQUESTER" as Role,
    mustChangePassword: false,
    ...overrides,
  };
}

export const SEEDED_REQUESTER = makeAuthUser();

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
      <AuthProvider>{content}</AuthProvider>
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

export function makeMessage(overrides: Partial<TicketMessage> = {}): TicketMessage {
  return {
    id: 1,
    ticketId: 1,
    authorId: 1,
    authorName: "Jennifer Anderson",
    authorRole: "REQUESTER" as Role,
    body: "Thank you for the update.",
    createdAt: "2026-08-20T10:00:00.000Z",
    ...overrides,
  };
}

export function makeTicketDetail(overrides: Partial<TicketDetail> = {}): TicketDetail {
  return {
    id: 1,
    ticketNumber: "TKT-2026-000001",
    requesterId: 1,
    requesterName: "Jennifer Anderson",
    ownerId: null,
    ownerName: null,
    categoryId: 1,
    categoryName: "Hardware",
    relatedSystemId: 1,
    relatedSystemName: "Corporate Laptop",
    summary: "Laptop battery drains quickly",
    description:
      "My laptop battery is draining much faster than usual even when the system is idle.",
    requestedPriority: "MEDIUM" as RequestedPriority,
    itPriority: "MEDIUM" as RequestedPriority,
    currentStatus: "NEW" as TicketStatus,
    requesterResolvedAt: null,
    createdAt: "2026-08-20T09:00:00.000Z",
    updatedAt: "2026-08-20T09:00:00.000Z",
    attachments: [],
    publicComments: [],
    ...overrides,
  };
}
