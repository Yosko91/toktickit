// Client-side mirror of BR-22/BR-23/BR-24 (server/src/services/attachmentStorage.ts is
// authoritative - BR-18). Used for immediate feedback before a file is sent.

export const ALLOWED_ATTACHMENT_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
];
export const ALLOWED_ATTACHMENT_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp", ".pdf"];
export const MAX_ATTACHMENT_SIZE_BYTES = 5 * 1024 * 1024;
export const MAX_ACTIVE_ATTACHMENTS = 5;

export function validateAttachmentFile(file: File): string | null {
  const dot = file.name.lastIndexOf(".");
  const ext = dot >= 0 ? file.name.slice(dot).toLowerCase() : "";
  const extensionOk = ALLOWED_ATTACHMENT_EXTENSIONS.includes(ext);
  // Some browser/OS combinations leave `file.type` empty; only reject on
  // type when the browser actually reported one.
  const typeOk = file.type === "" || ALLOWED_ATTACHMENT_MIME_TYPES.includes(file.type);

  if (!extensionOk || !typeOk) {
    return "Only JPG, PNG, WEBP, and PDF files are permitted.";
  }
  if (file.size > MAX_ATTACHMENT_SIZE_BYTES) {
    return "File exceeds the 5 MB size limit.";
  }
  return null;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
