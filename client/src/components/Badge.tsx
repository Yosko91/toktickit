import type { ActionStatus, RequestedPriority, TicketStatus } from "../api";
import { ACTION_STATUS_LABEL } from "../utils/actionRules";

type BadgeVariant =
  | "priority-low"
  | "priority-medium"
  | "priority-high"
  | "status"
  | "active"
  | "removed"
  | "action-planned"
  | "action-in-progress"
  | "action-completed"
  | "action-cancelled";

export function Badge({ variant, children }: { variant: BadgeVariant; children: string }) {
  return <span className={`zen-badge zen-badge-${variant}`}>{children}</span>;
}

const PRIORITY_LABEL: Record<RequestedPriority, string> = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
};
const PRIORITY_VARIANT: Record<RequestedPriority, BadgeVariant> = {
  LOW: "priority-low",
  MEDIUM: "priority-medium",
  HIGH: "priority-high",
};

// ui-spec.md section 5 - badges always carry text, never color alone.
export function PriorityBadge({ priority }: { priority: RequestedPriority }) {
  return <Badge variant={PRIORITY_VARIANT[priority]}>{PRIORITY_LABEL[priority]}</Badge>;
}

function formatStatusLabel(status: TicketStatus): string {
  return status
    .toLowerCase()
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function StatusBadge({ status }: { status: TicketStatus }) {
  return <Badge variant="status">{formatStatusLabel(status)}</Badge>;
}

export function AttachmentStateBadge({ removed }: { removed: boolean }) {
  return <Badge variant={removed ? "removed" : "active"}>{removed ? "Removed" : "Active"}</Badge>;
}

const ACTION_VARIANT: Record<ActionStatus, BadgeVariant> = {
  PLANNED: "action-planned",
  IN_PROGRESS: "action-in-progress",
  COMPLETED: "action-completed",
  CANCELLED: "action-cancelled",
};

// Lab 4 - the text is always there, the colour only helps (ui-spec.md section 9).
export function ActionStatusBadge({ status }: { status: ActionStatus }) {
  return <Badge variant={ACTION_VARIANT[status]}>{ACTION_STATUS_LABEL[status]}</Badge>;
}
