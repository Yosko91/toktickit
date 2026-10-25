import type { ActionStatus, TicketStatus } from "../api";

// Mirrors server/src/services/actionRules.ts so the form only offers what the
// API will accept. The server still checks everything on its own (BR-08).

const MOVES: Record<ActionStatus, ActionStatus[]> = {
  PLANNED: ["IN_PROGRESS", "COMPLETED", "CANCELLED"],
  IN_PROGRESS: ["COMPLETED", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
};

export const ACTION_STATUS_LABEL: Record<ActionStatus, string> = {
  PLANNED: "Planned",
  IN_PROGRESS: "In Progress",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

/** The current status first, then the moves BR-08 permits from it. */
export function statusChoicesFor(current: ActionStatus): ActionStatus[] {
  return [current, ...MOVES[current]];
}

export function isActionFinal(status: ActionStatus): boolean {
  return MOVES[status].length === 0;
}

const WORKABLE: TicketStatus[] = ["NEW", "OPEN", "IN_PROGRESS", "WAITING_FOR_REQUESTER", "REOPENED"];

/** BR-11: no new work on a resolved, closed or cancelled ticket. */
export function isTicketWorkable(status: TicketStatus): boolean {
  return WORKABLE.includes(status);
}
