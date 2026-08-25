import { describe, expect, it } from "vitest";
import { formatTicketNumber } from "../../src/services/ticketNumber.js";

// UNIT-01 - BR-01: TKT-{year}-{6-digit sequence}, no database involved.
describe("formatTicketNumber", () => {
  it("pads a small sequence to six digits", () => {
    expect(formatTicketNumber(2026, 1)).toBe("TKT-2026-000001");
  });

  it("does not truncate a sequence already six digits or longer", () => {
    expect(formatTicketNumber(2026, 123456)).toBe("TKT-2026-123456");
    expect(formatTicketNumber(2026, 1234567)).toBe("TKT-2026-1234567");
  });

  it("accepts a bigint sequence value (as returned by nextval)", () => {
    expect(formatTicketNumber(2026, 42n)).toBe("TKT-2026-000042");
  });

  it("uses the given year, not the current one", () => {
    expect(formatTicketNumber(2031, 7)).toBe("TKT-2031-000007");
  });
});
