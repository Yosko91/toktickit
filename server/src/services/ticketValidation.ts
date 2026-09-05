// BR-14 to BR-17: pure, unit-testable validation for the Create Ticket
// request body. The frontend repeats these rules for immediate feedback
// (BR-18), but this is the authoritative check.

export const REQUESTED_PRIORITIES = ["LOW", "MEDIUM", "HIGH"] as const;
export type RequestedPriority = (typeof REQUESTED_PRIORITIES)[number];

export interface TicketInputValue {
  categoryId: number;
  relatedSystemId: number;
  summary: string;
  description: string;
  requestedPriority: RequestedPriority;
}

export interface TicketValidationResult {
  valid: boolean;
  errors: Record<string, string>;
  value?: TicketInputValue;
}

function toPositiveInt(value: unknown): number | null {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
}

export function validateTicketInput(body: unknown): TicketValidationResult {
  const errors: Record<string, string> = {};
  const source = (body ?? {}) as Record<string, unknown>;

  const categoryId = toPositiveInt(source.categoryId);
  if (categoryId === null) {
    errors.categoryId = "Category is required";
  }

  const relatedSystemId = toPositiveInt(source.relatedSystemId);
  if (relatedSystemId === null) {
    errors.relatedSystemId = "Related System is required";
  }

  const summary = typeof source.summary === "string" ? source.summary.trim() : "";
  if (summary.length < 5 || summary.length > 120) {
    errors.summary = "Summary must be 5-120 characters";
  }

  const description = typeof source.description === "string" ? source.description.trim() : "";
  if (description.length < 20 || description.length > 2000) {
    errors.description = "Description must be 20-2000 characters";
  }

  const requestedPriorityRaw =
    typeof source.requestedPriority === "string" ? source.requestedPriority.toUpperCase() : "";
  const requestedPriority = REQUESTED_PRIORITIES.includes(requestedPriorityRaw as RequestedPriority)
    ? (requestedPriorityRaw as RequestedPriority)
    : null;
  if (requestedPriority === null) {
    errors.requestedPriority = `Requested Priority must be one of ${REQUESTED_PRIORITIES.join(", ")}`;
  }

  if (Object.keys(errors).length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    errors: {},
    value: {
      categoryId: categoryId!,
      relatedSystemId: relatedSystemId!,
      summary,
      description,
      requestedPriority: requestedPriority!,
    },
  };
}

// BR-27: removal reason, required on every soft removal.
export interface RemovalReasonResult {
  valid: boolean;
  value?: string;
  error?: string;
}

export function validateRemovalReason(reason: unknown): RemovalReasonResult {
  const trimmed = typeof reason === "string" ? reason.trim() : "";
  if (trimmed.length < 3 || trimmed.length > 200) {
    return { valid: false, error: "Removal reason must be 3-200 characters" };
  }
  return { valid: true, value: trimmed };
}
