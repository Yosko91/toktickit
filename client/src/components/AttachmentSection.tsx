import { useRef } from "react";
import type { AttachmentMeta } from "../api";
import { AttachmentStateBadge } from "./Badge";
import { MAX_ACTIVE_ATTACHMENTS, formatFileSize } from "../utils/attachmentRules";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function fileIcon(mimeType: string): string {
  if (mimeType === "application/pdf") return "📄";
  return "🖼️";
}

// ui-spec.md section 11 - the Attachments panel: add/download/remove
// actions, clearly separated from the read-only Ticket fields above it.
// BR-28: a removed row renders no download/preview control at all.
export function AttachmentSection({
  attachments,
  uploading,
  uploadError,
  onAddFile,
  onDownload,
  onRemoveRequest,
}: {
  attachments: AttachmentMeta[];
  uploading: boolean;
  uploadError: string | null;
  onAddFile: (file: File) => void;
  onDownload: (attachment: AttachmentMeta) => void;
  onRemoveRequest: (attachment: AttachmentMeta) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const active = attachments.filter((a) => !a.removedAt);
  const removed = attachments.filter((a) => a.removedAt);
  const canAddMore = active.length < MAX_ACTIVE_ATTACHMENTS;

  return (
    <div className="zen-card">
      <div className="zen-attachments-header">
        <h2 style={{ margin: 0 }}>Attachments ({active.length}/{MAX_ACTIVE_ATTACHMENTS} active)</h2>
        <div>
          <button
            type="button"
            className={`zen-btn zen-btn-secondary ${uploading ? "is-busy" : ""}`}
            onClick={() => inputRef.current?.click()}
            disabled={!canAddMore || uploading}
            title={canAddMore ? "Add attachment" : "Maximum of 5 active attachments reached"}
          >
            + Add Attachment
          </button>
          <input
            ref={inputRef}
            type="file"
            className="zen-visually-hidden"
            aria-label="Choose an attachment file to add"
            accept=".jpg,.jpeg,.png,.webp,.pdf,image/jpeg,image/png,image/webp,application/pdf"
            disabled={!canAddMore || uploading}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onAddFile(file);
              e.target.value = "";
            }}
          />
        </div>
      </div>

      {!canAddMore && (
        <p className="zen-field-hint">
          This ticket already has the maximum of {MAX_ACTIVE_ATTACHMENTS} active attachments.
          Remove one before adding another.
        </p>
      )}

      {uploadError && (
        <div className="zen-banner zen-banner-error" role="alert">
          <span aria-hidden="true">⚠️</span>
          <span>{uploadError}</span>
        </div>
      )}

      {attachments.length === 0 ? (
        <p style={{ color: "var(--zen-text-muted)" }}>No attachments yet.</p>
      ) : (
        <div>
          {active.map((attachment) => (
            <div key={attachment.id} className="zen-attachment-row">
              <span className="zen-attachment-icon" aria-hidden="true">
                {fileIcon(attachment.mimeType)}
              </span>
              <div className="zen-attachment-info">
                <div className="zen-attachment-name" title={attachment.originalName}>
                  {attachment.originalName}
                </div>
                <div className="zen-attachment-meta">
                  {formatFileSize(attachment.sizeBytes)} · Uploaded {formatDate(attachment.uploadedAt)}{" "}
                  <AttachmentStateBadge removed={false} />
                </div>
              </div>
              <div className="zen-attachment-actions">
                <button
                  type="button"
                  className="zen-btn zen-btn-tertiary"
                  onClick={() => onDownload(attachment)}
                >
                  Download
                </button>
                <button
                  type="button"
                  className="zen-btn zen-btn-destructive"
                  onClick={() => onRemoveRequest(attachment)}
                >
                  Remove
                </button>
              </div>
            </div>
          ))}

          {removed.map((attachment) => (
            <div key={attachment.id} className="zen-attachment-row is-removed">
              <span className="zen-attachment-icon" aria-hidden="true">
                {fileIcon(attachment.mimeType)}
              </span>
              <div className="zen-attachment-info">
                <div className="zen-attachment-name" title={attachment.originalName}>
                  {attachment.originalName}
                </div>
                <div className="zen-attachment-meta">
                  {formatFileSize(attachment.sizeBytes)} · Removed{" "}
                  {attachment.removedAt && formatDate(attachment.removedAt)} ·{" "}
                  <AttachmentStateBadge removed />
                </div>
                {attachment.removedReason && (
                  <div className="zen-attachment-meta">Reason: {attachment.removedReason}</div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
