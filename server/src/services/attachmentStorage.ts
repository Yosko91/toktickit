import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

// BR-22/BR-23/BR-24: fixed attachment limits from the Lab 2 handout.
export const ALLOWED_ATTACHMENT_MIME_TYPES: Record<string, string[]> = {
  "image/jpeg": [".jpg", ".jpeg"],
  "image/png": [".png"],
  "image/webp": [".webp"],
  "application/pdf": [".pdf"],
};

export const MAX_ATTACHMENT_SIZE_BYTES = 5 * 1024 * 1024;
export const MAX_ACTIVE_ATTACHMENTS_PER_TICKET = 5;

// Files live outside the repo tree's git-tracked area: server/uploads/lab-02/
// is listed in .gitignore. One subfolder per Ticket id.
const UPLOAD_ROOT = path.join(process.cwd(), "uploads", "lab-02");

export class UnsupportedAttachmentTypeError extends Error {
  constructor() {
    super("Attachment type not permitted");
    this.name = "UnsupportedAttachmentTypeError";
  }
}

export function isAllowedAttachment(mimeType: string, originalName: string): boolean {
  const ext = path.extname(originalName).toLowerCase();
  const allowedExts = ALLOWED_ATTACHMENT_MIME_TYPES[mimeType];
  return Boolean(allowedExts && allowedExts.includes(ext));
}

// Printable characters only (code point 32 and above) - drops any control
// character a malicious or corrupted upload might carry in its filename.
function stripControlCharacters(value: string): string {
  let result = "";
  for (const char of value) {
    if ((char.codePointAt(0) ?? 0) >= 32) {
      result += char;
    }
  }
  return result;
}

// BR-26: display metadata only, sanitized so it can never be treated as a
// path. Never used to build the on-disk location.
export function sanitizeOriginalName(name: string): string {
  const withoutSeparators = name.replace(/[\\/]/g, "_");
  const cleaned = stripControlCharacters(withoutSeparators).trim();
  return cleaned.slice(0, 200) || "attachment";
}

// BR-26: the actual on-disk name is a random id plus the validated
// extension - never derived from user input, so it cannot be used for path
// traversal and cannot collide across uploads.
export function generateStoredFilename(originalName: string): string {
  const ext = path.extname(originalName).toLowerCase();
  return `${randomUUID()}${ext}`;
}

function ticketUploadDir(ticketId: number): string {
  return path.join(UPLOAD_ROOT, String(ticketId));
}

export function attachmentFilePath(ticketId: number, storedFilename: string): string {
  return path.join(ticketUploadDir(ticketId), storedFilename);
}

export async function saveAttachmentFile(
  ticketId: number,
  storedFilename: string,
  buffer: Buffer
): Promise<void> {
  const dir = ticketUploadDir(ticketId);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, storedFilename), buffer);
}

// Best-effort cleanup if the DB write that should follow a file write fails.
// Never throws - a leftover orphan file is a harmless, documented limitation
// (tests.md section 7), losing the Attachment's own error is not.
export async function deleteAttachmentFileQuietly(ticketId: number, storedFilename: string): Promise<void> {
  try {
    await fs.unlink(attachmentFilePath(ticketId, storedFilename));
  } catch {
    // ignored - see comment above
  }
}
