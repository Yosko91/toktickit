import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  ApiError,
  downloadAttachment,
  getTicket,
  markRequesterResolved,
  postComment,
  removeAttachment,
  uploadAttachment,
} from "../api";
import type { AttachmentMeta, TicketDetail as TicketDetailType } from "../api";
import { LoadingPanel, StatePanel } from "../components/StatePanel";
import { ReadOnlyField } from "../components/Field";
import { PriorityBadge, StatusBadge } from "../components/Badge";
import { AttachmentSection } from "../components/AttachmentSection";
import { RemoveAttachmentDialog } from "../components/RemoveAttachmentDialog";
import { CommentPanel } from "../components/CommentPanel";
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

// ui-spec.md section 4 - Requester Ticket Detail. Read-only ticket header plus
// the Attachment lifecycle from Lab 2, and now a Public Comments panel and the
// "problem appears resolved" action (FR-08, FR-09). There is deliberately no
// Internal Notes panel, no owner control, no IT Priority control and no status
// control: a Requester has none of those rights (BR-24, BR-26).
export function TicketDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();

  const [state, setState] = useState<LoadState>("loading");
  const [error, setError] = useState<string | null>(null);
  const [ticket, setTicket] = useState<TicketDetailType | null>(null);

  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [removeTarget, setRemoveTarget] = useState<AttachmentMeta | null>(null);
  const [removing, setRemoving] = useState(false);
  const [resolveError, setResolveError] = useState<string | null>(null);
  const [resolving, setResolving] = useState(false);

  const load = useCallback(() => {
    if (!user || !id) return;
    setState("loading");
    setError(null);
    getTicket(Number(id))
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
  }, [user, id]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleAddFile(file: File) {
    if (!ticket) return;
    const clientError = validateAttachmentFile(file);
    if (clientError) {
      setUploadError(clientError);
      return;
    }
    setUploadError(null);
    setUploading(true);
    try {
      await uploadAttachment(ticket.id, file);
      load();
    } catch (err) {
      setUploadError(err instanceof ApiError ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function handleConfirmRemove(reason: string) {
    if (!removeTarget) return;
    setRemoving(true);
    try {
      await removeAttachment(removeTarget.id, reason);
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
    try {
      await downloadAttachment(attachment.id, attachment.originalName);
    } catch (err) {
      setUploadError(err instanceof ApiError ? err.message : "Download failed");
    }
  }

  async function handlePostComment(body: string) {
    if (!ticket) return;
    await postComment(ticket.id, body);
    load();
  }

  // FR-09/BR-31: records the Requester's own opinion. It is explicitly not a
  // status change, and the screen says so, because a Requester could
  // reasonably expect the badge to move.
  async function handleRequesterResolved() {
    if (!ticket) return;
    setResolving(true);
    setResolveError(null);
    try {
      await markRequesterResolved(ticket.id);
      load();
    } catch (err) {
      setResolveError(
        err instanceof ApiError ? err.message : "Unable to record that the problem looks resolved"
      );
    } finally {
      setResolving(false);
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

      {ticket.requesterResolvedAt ? (
        <div className="zen-banner zen-banner-success">
          <span aria-hidden="true">✅</span>
          <span>
            You reported this looks resolved on {formatDate(ticket.requesterResolvedAt)}. IT Staff
            will confirm and close the ticket.
          </span>
        </div>
      ) : (
        !["RESOLVED", "CLOSED", "CANCELLED"].includes(ticket.currentStatus) && (
          <div className="zen-card">
            <button
              type="button"
              className="zen-btn zen-btn-secondary"
              onClick={handleRequesterResolved}
              disabled={resolving}
            >
              {resolving ? "Saving…" : "Problem appears resolved"}
            </button>
            <p className="zen-field-hint" style={{ marginTop: "var(--zen-space-2)" }}>
              This tells IT Staff that the problem looks fixed to you. It does not change the
              ticket status: only IT Staff can resolve or close a ticket.
            </p>
            {resolveError && <div className="zen-field-error">{resolveError}</div>}
          </div>
        )
      )}

      <AttachmentSection
        attachments={ticket.attachments}
        uploading={uploading}
        uploadError={uploadError}
        onAddFile={handleAddFile}
        onDownload={handleDownload}
        onRemoveRequest={setRemoveTarget}
      />

      <CommentPanel
        variant="public"
        messages={ticket.publicComments}
        onPost={handlePostComment}
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
