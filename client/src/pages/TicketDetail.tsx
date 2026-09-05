import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useRequester } from "../context/RequesterContext";
import { ApiError, downloadAttachment, getTicket, removeAttachment, uploadAttachment } from "../api";
import type { AttachmentMeta, TicketDetail as TicketDetailType } from "../api";
import { LoadingPanel, StatePanel } from "../components/StatePanel";
import { ReadOnlyField } from "../components/Field";
import { PriorityBadge, StatusBadge } from "../components/Badge";
import { AttachmentSection } from "../components/AttachmentSection";
import { RemoveAttachmentDialog } from "../components/RemoveAttachmentDialog";
import { validateAttachmentFile } from "../utils/attachmentRules";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

type LoadState = "loading" | "ready" | "not-found" | "error";

// ui-spec.md section 11 - Requester Ticket Detail (view mode): read-only
// header + the Attachment lifecycle. No comments/notes/status controls here
// (explicit exclusion, handout section 8.5).
export function TicketDetail() {
  const { id } = useParams<{ id: string }>();
  const { requester } = useRequester();

  const [state, setState] = useState<LoadState>("loading");
  const [error, setError] = useState<string | null>(null);
  const [ticket, setTicket] = useState<TicketDetailType | null>(null);

  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [removeTarget, setRemoveTarget] = useState<AttachmentMeta | null>(null);
  const [removing, setRemoving] = useState(false);

  const load = useCallback(() => {
    if (!requester || !id) return;
    setState("loading");
    setError(null);
    getTicket(requester.id, Number(id))
      .then((t) => {
        setTicket(t);
        setState("ready");
      })
      .catch((err: unknown) => {
        if (err instanceof ApiError && err.status === 404) {
          setState("not-found"); // BR-13/AC-03: identical to "doesn't exist"
        } else {
          setError(err instanceof ApiError ? err.message : "Unable to load ticket");
          setState("error");
        }
      });
  }, [requester, id]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleAddFile(file: File) {
    if (!ticket || !requester) return;
    const clientError = validateAttachmentFile(file);
    if (clientError) {
      setUploadError(clientError);
      return;
    }
    setUploadError(null);
    setUploading(true);
    try {
      await uploadAttachment(requester.id, ticket.id, file);
      load();
    } catch (err) {
      setUploadError(err instanceof ApiError ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function handleConfirmRemove(reason: string) {
    if (!removeTarget || !requester) return;
    setRemoving(true);
    try {
      await removeAttachment(requester.id, removeTarget.id, reason);
      setRemoveTarget(null);
      load();
    } catch (err) {
      setUploadError(err instanceof ApiError ? err.message : "Unable to remove attachment");
      setRemoveTarget(null);
    } finally {
      setRemoving(false);
    }
  }

  async function handleDownload(attachment: AttachmentMeta) {
    if (!requester) return;
    try {
      await downloadAttachment(requester.id, attachment.id, attachment.originalName);
    } catch (err) {
      setUploadError(err instanceof ApiError ? err.message : "Download failed");
    }
  }

  if (state === "loading") {
    return <LoadingPanel label="Loading ticket…" />;
  }

  if (state === "not-found") {
    return (
      <StatePanel
        icon="🚫"
        title="Ticket not found"
        description="This ticket does not exist, or does not belong to the current Requester."
        action={
          <Link to="/tickets" className="zen-btn zen-btn-primary">
            Back to My Tickets
          </Link>
        }
      />
    );
  }

  if (state === "error") {
    return (
      <StatePanel
        icon="⚠️"
        title="Unable to load ticket"
        description={error ?? undefined}
        alert
        action={
          <button type="button" className="zen-btn zen-btn-primary" onClick={load}>
            Retry
          </button>
        }
      />
    );
  }

  if (!ticket) return null;

  return (
    <div>
      <div className="zen-breadcrumb" style={{ justifyContent: "space-between", display: "flex" }}>
        <span>
          <Link to="/tickets">My Tickets</Link> <span aria-hidden="true">›</span>{" "}
          <span>Ticket Details</span>
        </span>
        <Link to="/tickets" className="zen-btn zen-btn-secondary">
          ← Back to My Tickets
        </Link>
      </div>

      <div className="zen-card">
        <div className="zen-detail-grid">
          <ReadOnlyField label="Ticket No." value={ticket.ticketNumber} />
          <ReadOnlyField label="Ticket Date" value={formatDate(ticket.createdAt)} />
          <ReadOnlyField label="Category" value={ticket.categoryName} />
          <ReadOnlyField label="Related System" value={ticket.relatedSystemName} />
          <ReadOnlyField label="Requester" value={ticket.requesterName} />
          <ReadOnlyField label="Requested Priority" value={<PriorityBadge priority={ticket.requestedPriority} />} />
          <ReadOnlyField label="Current Status" value={<StatusBadge status={ticket.currentStatus} />} />
          <ReadOnlyField label="Last Updated" value={formatDate(ticket.updatedAt)} />
          <ReadOnlyField label="Summary" value={ticket.summary} className="zen-field--full" />
          <div className="zen-field zen-field--readonly zen-field--full">
            <span className="zen-field-label">Description</span>
            <div className="zen-readonly-value zen-description">{ticket.description}</div>
          </div>
        </div>
      </div>

      <AttachmentSection
        attachments={ticket.attachments}
        uploading={uploading}
        uploadError={uploadError}
        onAddFile={handleAddFile}
        onDownload={handleDownload}
        onRemoveRequest={setRemoveTarget}
      />

      {removeTarget && (
        <RemoveAttachmentDialog
          fileName={removeTarget.originalName}
          submitting={removing}
          onCancel={() => setRemoveTarget(null)}
          onConfirm={handleConfirmRemove}
        />
      )}
    </div>
  );
}
