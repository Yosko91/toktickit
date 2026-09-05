import type { RequestedPriority, TicketStatus } from "../api";

type BadgeVariant =
  | "priority-low"
  | "priority-medium"
  | "priority-high"
  | "status"
  | "active"
  | "removed";

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
