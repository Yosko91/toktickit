import { useRef } from "react";
import { formatFileSize } from "../utils/attachmentRules";

export interface StagedFile {
  file: File;
  error: string | null;
}

// ui-spec.md section 9 - Create Ticket's attachment picker: files are held
// client-side (no Ticket exists yet) and uploaded once creation succeeds
// (BR-25).
export function StagedAttachmentPicker({
  items,
  onAdd,
  onRemove,
  disabled,
}: {
  items: StagedFile[];
  onAdd: (files: FileList) => void;
  onRemove: (index: number) => void;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div>
      <div className={`zen-dropzone ${disabled ? "is-disabled" : ""}`}>
        <p>Attach supporting evidence</p>
        <button
          type="button"
          className="zen-btn zen-btn-secondary"
          onClick={() => inputRef.current?.click()}
          disabled={disabled}
        >
          Browse files
        </button>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept=".jpg,.jpeg,.png,.webp,.pdf,image/jpeg,image/png,image/webp,application/pdf"
          className="zen-visually-hidden"
          aria-label="Choose attachment files"
          disabled={disabled}
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0) {
              onAdd(e.target.files);
            }
            e.target.value = "";
          }}
        />
        <p className="zen-field-hint">JPG, PNG, WEBP, or PDF — up to 5 MB each, 5 files max.</p>
      </div>

      {items.length > 0 && (
        <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 8 }}>
          {items.map((item, idx) => (
            <li key={`${item.file.name}-${idx}`} className="zen-attachment-row">
              <span className="zen-attachment-icon" aria-hidden="true">
                📎
              </span>
              <div className="zen-attachment-info">
                <div className="zen-attachment-name" title={item.file.name}>
                  {item.file.name}
                </div>
                <div className="zen-attachment-meta">{formatFileSize(item.file.size)}</div>
                {item.error && (
                  <p className="zen-field-error" role="alert">
                    {item.error}
                  </p>
                )}
              </div>
              <div className="zen-attachment-actions">
                <button
                  type="button"
                  className="zen-btn zen-btn-tertiary"
                  onClick={() => onRemove(idx)}
                  aria-label={`Remove ${item.file.name}`}
                  title={`Remove ${item.file.name}`}
                  disabled={disabled}
                >
                  ✕
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
