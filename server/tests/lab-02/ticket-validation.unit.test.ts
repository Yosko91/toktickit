import { describe, expect, it } from "vitest";
import { validateRemovalReason, validateTicketInput } from "../../src/services/ticketValidation.js";

// UNIT-03 - BR-14/BR-15: trims, then enforces length bounds.
describe("validateTicketInput", () => {
  const base = {
    categoryId: 1,
    relatedSystemId: 1,
    summary: "Laptop battery drains quickly",
    description: "My laptop battery is draining much faster than usual even when the system is idle.",
    requestedPriority: "MEDIUM",
  };

  it("accepts a fully valid body", () => {
    const result = validateTicketInput(base);
    expect(result.valid).toBe(true);
    expect(result.value?.summary).toBe(base.summary);
  });

  it("trims surrounding whitespace before checking length", () => {
    const result = validateTicketInput({ ...base, summary: `   ${base.summary}   ` });
    expect(result.valid).toBe(true);
    expect(result.value?.summary).toBe(base.summary);
  });

  it("rejects a summary shorter than 5 characters after trimming", () => {
    const result = validateTicketInput({ ...base, summary: "   Hi  " });
    expect(result.valid).toBe(false);
    expect(result.errors.summary).toBeDefined();
  });

  it("rejects a summary longer than 120 characters", () => {
    const result = validateTicketInput({ ...base, summary: "a".repeat(121) });
    expect(result.valid).toBe(false);
    expect(result.errors.summary).toBeDefined();
  });

  it("rejects a description shorter than 20 characters", () => {
    const result = validateTicketInput({ ...base, description: "too short" });
    expect(result.valid).toBe(false);
    expect(result.errors.description).toBeDefined();
  });

  it("rejects a description longer than 2000 characters", () => {
    const result = validateTicketInput({ ...base, description: "a".repeat(2001) });
    expect(result.valid).toBe(false);
    expect(result.errors.description).toBeDefined();
  });

  it("rejects a missing categoryId / relatedSystemId", () => {
    const result = validateTicketInput({ ...base, categoryId: undefined, relatedSystemId: undefined });
    expect(result.valid).toBe(false);
    expect(result.errors.categoryId).toBeDefined();
    expect(result.errors.relatedSystemId).toBeDefined();
  });

  it("rejects a requestedPriority outside LOW/MEDIUM/HIGH", () => {
    const result = validateTicketInput({ ...base, requestedPriority: "URGENT" });
    expect(result.valid).toBe(false);
    expect(result.errors.requestedPriority).toBeDefined();
  });

  it("normalizes requestedPriority casing", () => {
    const result = validateTicketInput({ ...base, requestedPriority: "high" });
    expect(result.valid).toBe(true);
    expect(result.value?.requestedPriority).toBe("HIGH");
  });

  it("collects every field error at once rather than stopping at the first", () => {
    const result = validateTicketInput({});
    expect(result.valid).toBe(false);
    expect(Object.keys(result.errors).sort()).toEqual(
      ["categoryId", "description", "relatedSystemId", "requestedPriority", "summary"].sort()
    );
  });
});

// BR-27: removal reason.
describe("validateRemovalReason", () => {
  it("accepts a reason within 3-200 characters", () => {
    expect(validateRemovalReason("Wrong file, replacing it").valid).toBe(true);
  });

  it("rejects a reason shorter than 3 characters", () => {
    expect(validateRemovalReason("Hi").valid).toBe(false);
  });

  it("rejects a missing reason", () => {
    expect(validateRemovalReason(undefined).valid).toBe(false);
  });

  it("rejects a reason longer than 200 characters", () => {
    expect(validateRemovalReason("a".repeat(201)).valid).toBe(false);
  });
});
