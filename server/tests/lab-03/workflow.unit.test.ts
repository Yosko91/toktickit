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

// BR-35: the pure part of the last-administrator rule.
describe("couldRemoveAnAdministrator", () => {
  it("fires only for a change that takes an active administrator out of the role", async () => {
    const { couldRemoveAnAdministrator } = await import("../../src/services/userAdmin.js");
    const activeAdmin = { role: "ADMINISTRATOR" as const, isActive: true };

    expect(couldRemoveAnAdministrator(activeAdmin, { isActive: false })).toBe(true);
    expect(couldRemoveAnAdministrator(activeAdmin, { role: "REQUESTER" })).toBe(true);
    expect(couldRemoveAnAdministrator(activeAdmin, { role: "IT_STAFF" })).toBe(true);

    // A rename, or a change that keeps them an active administrator, is not a risk.
    expect(couldRemoveAnAdministrator(activeAdmin, { name: "New Name" })).toBe(false);
    expect(couldRemoveAnAdministrator(activeAdmin, { role: "ADMINISTRATOR" })).toBe(false);
    expect(couldRemoveAnAdministrator(activeAdmin, { isActive: true })).toBe(false);

    // Somebody who is not an active administrator cannot be the last one.
    expect(
      couldRemoveAnAdministrator({ role: "ADMINISTRATOR", isActive: false }, { isActive: false })
    ).toBe(false);
    expect(couldRemoveAnAdministrator({ role: "IT_STAFF", isActive: true }, { isActive: false })).toBe(
      false
    );
  });
});
