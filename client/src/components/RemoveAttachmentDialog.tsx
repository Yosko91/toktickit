import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { FieldWrapper } from "./Field";

// ui-spec.md section 13 - traps focus, closes on Escape, returns focus to
// the control that opened it. BR-27: a 3-200 character reason is required.
export function RemoveAttachmentDialog({
  fileName,
  onCancel,
  onConfirm,
  submitting,
}: {
  fileName: string;
  onCancel: () => void;
  onConfirm: (reason: string) => void;
  submitting: boolean;
}) {
  const [reason, setReason] = useState("");
  const [touched, setTouched] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const firstFocusable = dialogRef.current?.querySelector<HTMLElement>("textarea, button");
    firstFocusable?.focus();

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onCancel();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      previouslyFocused?.focus();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const trimmed = reason.trim();
  const invalid = trimmed.length < 3 || trimmed.length > 200;
  const error = touched && invalid ? "Removal reason must be 3-200 characters" : undefined;

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setTouched(true);
    if (invalid) return;
    onConfirm(trimmed);
  }

  return (
    <div
      className="zen-modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div
        className="zen-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="remove-attachment-title"
        ref={dialogRef}
      >
        <h2 id="remove-attachment-title">Remove attachment</h2>
        <p>
          Remove <strong>{fileName}</strong>? It will remain visible as removed metadata but can
          no longer be downloaded.
        </p>
        <form onSubmit={handleSubmit}>
          <FieldWrapper label="Reason for removal" htmlFor="remove-reason" required error={error}>
            <textarea
              id="remove-reason"
              className="zen-textarea"
              style={{ minHeight: 80 }}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              onBlur={() => setTouched(true)}
              disabled={submitting}
            />
          </FieldWrapper>
          <div className="zen-modal-actions">
            <button
              type="button"
              className="zen-btn zen-btn-secondary"
              onClick={onCancel}
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className={`zen-btn zen-btn-destructive ${submitting ? "is-busy" : ""}`}
              disabled={submitting}
            >
              Remove Attachment
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
