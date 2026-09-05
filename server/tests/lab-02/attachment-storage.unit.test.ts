import { describe, expect, it } from "vitest";
import {
  generateStoredFilename,
  isAllowedAttachment,
  sanitizeOriginalName,
} from "../../src/services/attachmentStorage.js";

// UNIT-02 - BR-22/BR-26: stored filename never reuses the original name.
describe("generateStoredFilename", () => {
  it("keeps the original extension but replaces the rest with a UUID", () => {
    const stored = generateStoredFilename("../../etc/passwd.png");
    expect(stored).toMatch(/^[0-9a-f-]{36}\.png$/);
    expect(stored).not.toContain("passwd");
    expect(stored).not.toContain("..");
  });

  it("generates a different name on every call", () => {
    const a = generateStoredFilename("screenshot.png");
    const b = generateStoredFilename("screenshot.png");
    expect(a).not.toBe(b);
  });
});

describe("sanitizeOriginalName", () => {
  it("strips path separators so it can never be read as a path", () => {
    expect(sanitizeOriginalName("../../secrets/file.pdf")).toBe(".._.._secrets_file.pdf");
  });

  it("falls back to a default name when nothing printable remains", () => {
    expect(sanitizeOriginalName("")).toBe("attachment");
  });

  it("truncates very long names", () => {
    const longName = `${"a".repeat(300)}.png`;
    expect(sanitizeOriginalName(longName).length).toBeLessThanOrEqual(200);
  });
});

// BR-22 - allowed types are checked by extension AND mime type together.
describe("isAllowedAttachment", () => {
  it("accepts a matching mime type and extension pair", () => {
    expect(isAllowedAttachment("image/png", "photo.png")).toBe(true);
    expect(isAllowedAttachment("application/pdf", "report.PDF")).toBe(true);
  });

  it("rejects a disallowed mime type", () => {
    expect(isAllowedAttachment("application/x-msdownload", "tool.exe")).toBe(false);
  });

  it("rejects a mismatched extension for an otherwise allowed mime type", () => {
    expect(isAllowedAttachment("image/png", "photo.exe")).toBe(false);
  });
});
