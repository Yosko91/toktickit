import { describe, expect, it } from "vitest";
import type { TicketStatus } from "@prisma/client";
import {
  ASSIGNABLE_STATUSES,
  isTransitionPermitted,
  permittedNextStatuses,
  requiresOwner,
} from "../../src/services/ticketWorkflow.js";

// The matrix from specification.md BR-22, restated here independently. If the
// service is edited to allow something extra, this copy fails rather than
// agreeing with it, which is the whole point of writing it out twice.
const EXPECTED: Record<string, TicketStatus[]> = {
  NEW: ["OPEN", "IN_PROGRESS", "CANCELLED"],
  OPEN: ["IN_PROGRESS", "WAITING_FOR_REQUESTER", "RESOLVED", "CANCELLED"],
  IN_PROGRESS: ["WAITING_FOR_REQUESTER", "RESOLVED", "CANCELLED"],
  WAITING_FOR_REQUESTER: ["IN_PROGRESS", "RESOLVED", "CANCELLED"],
  RESOLVED: ["CLOSED", "REOPENED"],
  REOPENED: ["IN_PROGRESS", "WAITING_FOR_REQUESTER", "RESOLVED", "CANCELLED"],
  CLOSED: [],
  CANCELLED: [],
};

// UNIT-03 - BR-22
describe("status transition matrix", () => {
  it("permits exactly the listed transitions and refuses every other pair", () => {
    for (const from of ASSIGNABLE_STATUSES) {
      const allowed = EXPECTED[from] ?? [];
      expect(permittedNextStatuses(from).sort()).toEqual([...allowed].sort());

      for (const to of ASSIGNABLE_STATUSES) {
        expect(isTransitionPermitted(from, to)).toBe(allowed.includes(to));
      }
    }
  });

  it("refuses the shortcut from NEW straight to RESOLVED", () => {
    expect(isTransitionPermitted("NEW", "RESOLVED")).toBe(false);
  });

  it("never permits a ticket to stay in the same status", () => {
    for (const status of ASSIGNABLE_STATUSES) {
      expect(isTransitionPermitted(status, status)).toBe(false);
    }
  });
});

// UNIT-04 - BR-25
describe("terminal statuses", () => {
  it("allows nothing out of CLOSED or CANCELLED", () => {
    expect(permittedNextStatuses("CLOSED")).toEqual([]);
    expect(permittedNextStatuses("CANCELLED")).toEqual([]);
  });

  it("leaves RESOLVED only by closing or reopening", () => {
    expect(permittedNextStatuses("RESOLVED").sort()).toEqual(["CLOSED", "REOPENED"]);
  });
});

// BR-23
describe("requiresOwner", () => {
  it("requires an owner only for RESOLVED", () => {
    expect(requiresOwner("RESOLVED")).toBe(true);
    for (const status of ASSIGNABLE_STATUSES.filter((s) => s !== "RESOLVED")) {
      expect(requiresOwner(status)).toBe(false);
    }
  });
});
