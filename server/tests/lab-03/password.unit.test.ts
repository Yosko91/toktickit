import { describe, expect, it } from "vitest";
import { hashPassword, validatePassword, verifyPassword } from "../../src/services/password.js";

// UNIT-01 - BR-06
describe("validatePassword", () => {
  it("accepts a password meeting every rule", () => {
    expect(validatePassword("TokTick!2026")).toBeNull();
  });

  it.each([
    ["shorter than 8 characters", "Ab1!xy"],
    ["missing an upper case letter", "toktick!2026"],
    ["missing a lower case letter", "TOKTICK!2026"],
    ["missing a digit", "TokTickIT!"],
    ["missing a special character", "TokTick2026"],
  ])("rejects a password %s", (_label, value) => {
    expect(validatePassword(value)).not.toBeNull();
  });

  it("rejects a missing or non-string value", () => {
    expect(validatePassword(undefined)).not.toBeNull();
    expect(validatePassword("")).not.toBeNull();
    expect(validatePassword(12345678)).not.toBeNull();
  });
});

// UNIT-02 - BR-04
describe("hashPassword and verifyPassword", () => {
  it("never stores the plaintext, and salts each hash differently", async () => {
    const first = await hashPassword("TokTick!2026");
    const second = await hashPassword("TokTick!2026");

    expect(first).not.toContain("TokTick!2026");
    // Different salts mean the same password hashes to two different strings,
    // which is what stops a stolen table being reversed in bulk.
    expect(first).not.toBe(second);
  });

  it("accepts the right password and rejects a wrong one", async () => {
    const hash = await hashPassword("TokTick!2026");

    expect(await verifyPassword("TokTick!2026", hash)).toBe(true);
    expect(await verifyPassword("toktick!2026", hash)).toBe(false);
    expect(await verifyPassword("", hash)).toBe(false);
  });
});
