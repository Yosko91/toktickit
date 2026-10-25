import type { ActionStatus, TicketStatus } from "@prisma/client";

// BR-21/BR-22: the status transition matrix, in one place, so the API and the
// interface cannot disagree about what is permitted. The interface uses it to
// decide which options to offer; the API uses it to refuse anything else.

/**
 * The statuses Lab 3 actually uses. PENDING is the unused Lab 2 placeholder
 * kept in the database enum and never assignable (BR-21).
 */
export const ASSIGNABLE_STATUSES: TicketStatus[] = [
  "NEW",
  "OPEN",
  "IN_PROGRESS",
  "WAITING_FOR_REQUESTER",
  "RESOLVED",
  "CLOSED",
  "REOPENED",
  "CANCELLED",
];

const TRANSITIONS: Record<string, TicketStatus[]> = {
  NEW: ["OPEN", "IN_PROGRESS", "CANCELLED"],
  OPEN: ["IN_PROGRESS", "WAITING_FOR_REQUESTER", "RESOLVED", "CANCELLED"],
  IN_PROGRESS: ["WAITING_FOR_REQUESTER", "RESOLVED", "CANCELLED"],
  WAITING_FOR_REQUESTER: ["IN_PROGRESS", "RESOLVED", "CANCELLED"],
  RESOLVED: ["CLOSED", "REOPENED"],
  REOPENED: ["IN_PROGRESS", "WAITING_FOR_REQUESTER", "RESOLVED", "CANCELLED"],
  // BR-25: terminal. A closed or cancelled ticket is finished; reopening work
  // means raising a new ticket.
  CLOSED: [],
  CANCELLED: [],
  // The Lab 2 placeholder is not part of the workflow, so nothing leads out of
  // it either. No row has ever held it.
  PENDING: [],
};

export function permittedNextStatuses(from: TicketStatus): TicketStatus[] {
  return TRANSITIONS[from] ?? [];
}

export function isTransitionPermitted(from: TicketStatus, to: TicketStatus): boolean {
  return permittedNextStatuses(from).includes(to);
}

/** BR-23: somebody has to be accountable for a resolution. */
export function requiresOwner(to: TicketStatus): boolean {
  return to === "RESOLVED";
}

// Lab 4 - BR-25: the tickets that are still being worked on. Used by the
// dashboards, by the statusGroup=active filter and by BR-11 (where new work
// can be recorded), so the three can never disagree.
export const ACTIVE_STATUSES: TicketStatus[] = [
  "NEW",
  "OPEN",
  "IN_PROGRESS",
  "WAITING_FOR_REQUESTER",
  "REOPENED",
];

export interface ResolutionBlock {
  code: "OWNER_REQUIRED" | "NO_COMPLETED_ACTION" | "OPEN_ACTIONS";
  message: string;
}

/**
 * Lab 4 - BR-18, the resolution gate. Checked in the order written in
 * api-spec.md section 4. Returns null when the ticket may be resolved.
 */
export function resolutionBlocker(
  ticket: { ownerId: number | null },
  actions: { status: ActionStatus }[]
): ResolutionBlock | null {
  if (requiresOwner("RESOLVED") && ticket.ownerId === null) {
    return { code: "OWNER_REQUIRED", message: "A ticket must have an owner before it can be resolved" };
  }
  if (!actions.some((a) => a.status === "COMPLETED")) {
    return {
      code: "NO_COMPLETED_ACTION",
      message: "Record at least one completed action before resolving this ticket",
    };
  }
  if (actions.some((a) => a.status === "PLANNED" || a.status === "IN_PROGRESS")) {
    return {
      code: "OPEN_ACTIONS",
      message: "Complete or cancel the open actions before resolving this ticket",
    };
  }
  return null;
}
