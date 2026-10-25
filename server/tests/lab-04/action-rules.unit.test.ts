import { describe, expect, it } from "vitest";
import type { ActionStatus } from "@prisma/client";
import {
  ACTION_STATUSES,
  checkActionRules,
  isActionMovePermitted,
  parseActionInput,
  type ActionFields,
} from "../../src/services/actionRules.js";

const CREATED = new Date("2026-10-20T08:00:00.000Z");
const NOW = new Date("2026-10-25T08:00:00.000Z");

function action(overrides: Partial<ActionFields> = {}): ActionFields {
  return {
    actionAt: new Date("2026-10-24T08:00:00.000Z"),
    description: "Checked the cable",
    result: "Cable was loose",
    status: "COMPLETED",
    followUpRequired: false,
    followUpNote: null,
    attachmentNotes: null,
    ...overrides,
  };
}

const check = (a: ActionFields) => checkActionRules(a, { ticketCreatedAt: CREATED, now: NOW });

describe("Action Taken status moves (BR-08)", () => {
  // UNIT-01
  it("accepts exactly the permitted moves and treats Completed and Cancelled as final", () => {
    const permitted: Record<ActionStatus, ActionStatus[]> = {
      PLANNED: ["IN_PROGRESS", "COMPLETED", "CANCELLED"],
      IN_PROGRESS: ["COMPLETED", "CANCELLED"],
      COMPLETED: [],
      CANCELLED: [],
    };
    for (const from of ACTION_STATUSES) {
      for (const to of ACTION_STATUSES) {
        const expected = from === to || permitted[from].includes(to);
        expect(isActionMovePermitted(from, to), `${from} -> ${to}`).toBe(expected);
      }
    }
  });
});

describe("Action Taken field rules", () => {
  // UNIT-02
  it("requires a description and limits its length", () => {
    expect(parseActionInput({ actionAt: NOW.toISOString(), description: "   " }, "create").errors.description).toBeDefined();
    expect(
      parseActionInput({ actionAt: NOW.toISOString(), description: "x".repeat(2001) }, "create").errors.description
    ).toBeDefined();
    expect(parseActionInput({ actionAt: NOW.toISOString(), description: "ok" }, "create").errors).toEqual({});
  });

  it("refuses Cancelled at creation and a date that is not a date", () => {
    const { errors } = parseActionInput(
      { actionAt: "yesterday", description: "ok", status: "CANCELLED" },
      "create"
    );
    expect(errors.actionAt).toBeDefined();
    expect(errors.status).toBeDefined();
  });

  it("needs a follow-up note only when a follow-up is required", () => {
    expect(check(action({ followUpRequired: true, followUpNote: null })).followUpNote).toBeDefined();
    expect(check(action({ followUpRequired: true, followUpNote: "Call back" }))).toEqual({});
    expect(check(action({ followUpRequired: false, followUpNote: null }))).toEqual({});
  });

  it("needs a result to complete an action but not to plan one", () => {
    expect(check(action({ status: "COMPLETED", result: null })).result).toBeDefined();
    expect(check(action({ status: "PLANNED", result: null }))).toEqual({});
  });

  it("allows a future date only for a planned action, and never a date before the ticket", () => {
    const tomorrow = new Date(NOW.getTime() + 24 * 3600 * 1000);
    expect(check(action({ actionAt: tomorrow })).actionAt).toBeDefined();
    expect(check(action({ actionAt: tomorrow, status: "PLANNED", result: null }))).toEqual({});
    expect(check(action({ actionAt: new Date("2026-10-19T08:00:00.000Z") })).actionAt).toBeDefined();
    // Five minutes of clock difference is tolerated.
    expect(check(action({ actionAt: new Date(NOW.getTime() + 2 * 60 * 1000) }))).toEqual({});
  });
});
