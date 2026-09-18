import type { TicketStatus } from "../api";

// BR-22. Mirrors server/src/services/ticketWorkflow.ts so the status select can
// offer only the transitions that will actually be accepted. The server is
// still the authority and refuses anything else independently - this copy only
// stops the interface offering a choice it knows will fail.

const TRANSITIONS: Record<string, TicketStatus[]> = {
  NEW: ["OPEN", "IN_PROGRESS", "CANCELLED"],
  OPEN: ["IN_PROGRESS", "WAITING_FOR_REQUESTER", "RESOLVED", "CANCELLED"],
  IN_PROGRESS: ["WAITING_FOR_REQUESTER", "RESOLVED", "CANCELLED"],
  WAITING_FOR_REQUESTER: ["IN_PROGRESS", "RESOLVED", "CANCELLED"],
  RESOLVED: ["CLOSED", "REOPENED"],
  REOPENED: ["IN_PROGRESS", "WAITING_FOR_REQUESTER", "RESOLVED", "CANCELLED"],
  CLOSED: [],
  CANCELLED: [],
  PENDING: [],
};

export const ALL_STATUSES: TicketStatus[] = [
  "NEW",
  "OPEN",
  "IN_PROGRESS",
  "WAITING_FOR_REQUESTER",
  "RESOLVED",
  "CLOSED",
  "REOPENED",
  "CANCELLED",
];

export function permittedNextStatuses(from: TicketStatus): TicketStatus[] {
  return TRANSITIONS[from] ?? [];
}

export function statusLabel(status: TicketStatus): string {
  return status
    .toLowerCase()
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
