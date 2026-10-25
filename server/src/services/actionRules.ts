import type { ActionStatus, TicketStatus } from "@prisma/client";
import { ACTIVE_STATUSES } from "./ticketWorkflow.js";

// Lab 4 - the Action Taken rules in one place (specification.md BR-05 to
// BR-11), kept free of the database so they can be unit tested on their own.

export const ACTION_STATUSES: ActionStatus[] = ["PLANNED", "IN_PROGRESS", "COMPLETED", "CANCELLED"];

// BR-08. COMPLETED and CANCELLED are final (BR-10).
const ACTION_MOVES: Record<ActionStatus, ActionStatus[]> = {
  PLANNED: ["IN_PROGRESS", "COMPLETED", "CANCELLED"],
  IN_PROGRESS: ["COMPLETED", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
};

export function permittedActionMoves(from: ActionStatus): ActionStatus[] {
  return ACTION_MOVES[from] ?? [];
}

export function isActionMovePermitted(from: ActionStatus, to: ActionStatus): boolean {
  return from === to || permittedActionMoves(from).includes(to);
}

export function isActionFinal(status: ActionStatus): boolean {
  return status === "COMPLETED" || status === "CANCELLED";
}

// BR-11: work can only be recorded while the ticket is still active (BR-25).
export function isTicketWorkable(status: TicketStatus): boolean {
  return ACTIVE_STATUSES.includes(status);
}

export const MAX_DESCRIPTION = 2000;
export const MAX_RESULT = 2000;
export const MAX_FOLLOW_UP_NOTE = 1000;
export const MAX_ATTACHMENT_NOTES = 500;
// BR-07: small tolerance for the clock of the browser being a little ahead.
export const FUTURE_TOLERANCE_MS = 5 * 60 * 1000;
// The date field in the form has minute precision, so an action recorded in
// the same minute the ticket was created must still be accepted.
const SAME_MINUTE_MS = 60 * 1000;

export interface ActionFields {
  actionAt: Date;
  description: string;
  result: string | null;
  status: ActionStatus;
  performedById?: number;
  followUpRequired: boolean;
  followUpNote: string | null;
  attachmentNotes: string | null;
}

type Errors = Record<string, string>;

function optionalText(value: unknown, field: string, max: number, errors: Errors): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== "string") {
    errors[field] = "Must be text";
    return undefined;
  }
  const trimmed = value.trim();
  if (trimmed.length > max) {
    errors[field] = `Must be at most ${max} characters`;
    return undefined;
  }
  return trimmed === "" ? null : trimmed;
}

/**
 * Checks the type of every field that is present. `create` makes the date and
 * the description required. Returns only the fields that were sent, so a PATCH
 * can merge them on top of the stored action.
 */
export function parseActionInput(body: unknown, mode: "create" | "update") {
  const input = (body ?? {}) as Record<string, unknown>;
  const errors: Errors = {};
  const fields: Partial<ActionFields> = {};

  if (input.actionAt !== undefined) {
    const date = typeof input.actionAt === "string" ? new Date(input.actionAt) : null;
    if (!date || Number.isNaN(date.getTime())) {
      errors.actionAt = "A valid date and time is required";
    } else {
      fields.actionAt = date;
    }
  } else if (mode === "create") {
    errors.actionAt = "The action date and time is required";
  }

  if (input.description !== undefined) {
    const text = typeof input.description === "string" ? input.description.trim() : "";
    if (text.length === 0) {
      errors.description = "The action description is required";
    } else if (text.length > MAX_DESCRIPTION) {
      errors.description = `Must be at most ${MAX_DESCRIPTION} characters`;
    } else {
      fields.description = text;
    }
  } else if (mode === "create") {
    errors.description = "The action description is required";
  }

  const result = optionalText(input.result, "result", MAX_RESULT, errors);
  if (result !== undefined) fields.result = result;

  const followUpNote = optionalText(input.followUpNote, "followUpNote", MAX_FOLLOW_UP_NOTE, errors);
  if (followUpNote !== undefined) fields.followUpNote = followUpNote;

  const attachmentNotes = optionalText(input.attachmentNotes, "attachmentNotes", MAX_ATTACHMENT_NOTES, errors);
  if (attachmentNotes !== undefined) fields.attachmentNotes = attachmentNotes;

  if (input.status !== undefined) {
    if (!ACTION_STATUSES.includes(input.status as ActionStatus)) {
      errors.status = `Must be one of ${ACTION_STATUSES.join(", ")}`;
    } else if (mode === "create" && input.status === "CANCELLED") {
      errors.status = "An action cannot be created as Cancelled";
    } else {
      fields.status = input.status as ActionStatus;
    }
  }

  if (input.performedById !== undefined) {
    if (!Number.isInteger(input.performedById) || (input.performedById as number) <= 0) {
      errors.performedById = "Must be a user id";
    } else {
      fields.performedById = input.performedById as number;
    }
  }

  if (input.followUpRequired !== undefined) {
    if (typeof input.followUpRequired !== "boolean") {
      errors.followUpRequired = "Must be true or false";
    } else {
      fields.followUpRequired = input.followUpRequired;
    }
  }

  return { fields, errors };
}

/**
 * The rules that need several fields together (BR-06, BR-07, BR-09). They are
 * checked on the action as it will be after the change, which is what stops a
 * PATCH from completing an action that has no result.
 */
export function checkActionRules(
  action: ActionFields,
  context: { ticketCreatedAt: Date; now: Date }
): Errors {
  const errors: Errors = {};

  if (action.followUpRequired && !action.followUpNote) {
    errors.followUpNote = "A follow-up note is required when a follow-up is needed";
  }
  if (action.status === "COMPLETED" && !action.result) {
    errors.result = "A result is required to complete the action";
  }
  if (action.actionAt.getTime() < context.ticketCreatedAt.getTime() - SAME_MINUTE_MS) {
    errors.actionAt = "The action date cannot be before the ticket was created";
  } else if (
    action.status !== "PLANNED" &&
    action.actionAt.getTime() > context.now.getTime() + FUTURE_TOLERANCE_MS
  ) {
    errors.actionAt = "Only a planned action can have a date in the future";
  }

  return errors;
}
