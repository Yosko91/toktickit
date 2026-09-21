import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ApiError,
  downloadAttachment,
  getAssignableUsers,
  getStaffTicket,
  postComment,
  postInternalNote,
  setItPriority,
  setTicketOwner,
  setTicketStatus,
} from "../api";
import type {
  AssignableUser,
  AttachmentMeta,
  RequestedPriority,
  StaffTicketDetail as StaffTicketDetailType,
  TicketStatus,
} from "../api";
import { useAuth } from "../context/AuthContext";
import { LoadingPanel, StatePanel } from "../components/StatePanel";
import { ReadOnlyField } from "../components/Field";
import { PriorityBadge, StatusBadge } from "../components/Badge";
import { CommentPanel } from "../components/CommentPanel";
import { AttachmentStateBadge } from "../components/Badge";
import { permittedNextStatuses, statusLabel } from "../utils/ticketWorkflow";
import { formatFileSize } from "../utils/attachmentRules";

// ui-spec.md section 6 - the IT Staff Ticket Detail. Same information grid as
// the Requester screen so the two read as one application, with the operational
// fields made editable and the private note stream added.

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

export function StaffTicketDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();

  const [state, setState] = useState<LoadState>("loading");
  const [error, setError] = useState<string | null>(null);
  const [ticket, setTicket] = useState<StaffTicketDetailType | null>(null);
  const [owners, setOwners] = useState<AssignableUser[]>([]);

  // Each control reports its own outcome next to itself, rather than through a
  // page-level banner, so it is obvious which field was saved or refused.
  const [savingField, setSavingField] = useState<string | null>(null);
  const [savedField, setSavedField] = useState<string | null>(null);
  const [ownerError, setOwnerError] = useState<string | null>(null);
  const [priorityError, setPriorityError] = useState<string | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!id) return;
    setState("loading");
    setError(null);
    getStaffTicket(Number(id))
      .then((t) => {
        setTicket(t);
        setState("ready");
      })
      .catch((err: unknown) => {
        if (err instanceof ApiError && err.status === 404) {
          setState("not-found");
        } else {
          setError(err instanceof ApiError ? err.message : "Unable to load ticket");
          setState("error");
        }
      });
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    getAssignableUsers().then(setOwners).catch(() => setOwners([]));
  }, []);

  async function runSave(field: string, action: () => Promise<unknown>, onError: (m: string) => void) {
    setSavingField(field);
    setSavedField(null);
    onError("");
    try {
      await action();
      setSavedField(field);
      load();
    } catch (err) {
      onError(err instanceof ApiError ? err.message : "Unable to save the change");
    } finally {
      setSavingField(null);
    }
  }

  function handleOwnerChange(value: string) {
    if (!ticket) return;
    const ownerId = value === "" ? null : Number(value);
    void runSave("owner", () => setTicketOwner(ticket.id, ownerId), setOwnerError);
  }

  function handleClaim() {
    if (!ticket || !user) return;
    void runSave("owner", () => setTicketOwner(ticket.id, user.id), setOwnerError);
  }

  function handlePriorityChange(value: string) {
    if (!ticket) return;
    void runSave(
      "itPriority",
      () => setItPriority(ticket.id, value as RequestedPriority),
      setPriorityError
    );
  }

  function handleStatusChange(value: string) {
    if (!ticket || value === "") return;
    void runSave(
      "status",
      () => setTicketStatus(ticket.id, value as TicketStatus),
      setStatusError
    );
  }

  async function handleDownload(attachment: AttachmentMeta) {
    try {
      await downloadAttachment(attachment.id, attachment.originalName);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Download failed");
    }
  }

  if (state === "loading") return <LoadingPanel label="Loading ticket…" />;

  if (state === "not-found") {
    return (
      <StatePanel
        icon="🚫"
        title="Ticket not found"
        action={
          <Link to="/queue" className="zen-btn zen-btn-primary">
            Back to the queue
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

  const nextStatuses = permittedNextStatuses(ticket.currentStatus);

  return (
    <div>
      <div className="zen-breadcrumb" style={{ justifyContent: "space-between", display: "flex" }}>
        <span>
          <Link to="/queue">Ticket Queue</Link> <span aria-hidden="true">›</span>{" "}
          <span>Ticket Detail</span>
        </span>
        <Link to="/queue" className="zen-btn zen-btn-secondary">
          ← Back to Queue
        </Link>
      </div>

      {ticket.requesterResolvedAt && (
        <div className="zen-banner zen-banner-info">
          <span aria-hidden="true">💬</span>
          <span>
            The Requester reported this looks resolved on {formatDate(ticket.requesterResolvedAt)}.
            This is a message, not a status: the ticket is still {statusLabel(ticket.currentStatus)}.
          </span>
        </div>
      )}

      <div className="zen-card">
        <div className="zen-detail-grid">
          <ReadOnlyField label="Ticket No." value={ticket.ticketNumber} />
          <ReadOnlyField label="Category" value={ticket.categoryName} />
          <ReadOnlyField label="Related System" value={ticket.relatedSystemName} />
          <ReadOnlyField label="Requester" value={ticket.requesterName} />
          <ReadOnlyField
            label="Requested Priority"
            value={<PriorityBadge priority={ticket.requestedPriority} />}
          />
          <ReadOnlyField label="Created" value={formatDate(ticket.createdAt)} />

          {/* Editable operational fields. The Zen input styling marks them as
              editable; the read-only fields above keep the flat grey styling. */}
          <div className="zen-field">
            <label className="zen-field-label" htmlFor="ticket-owner">
              Ticket Owner
            </label>
            <div style={{ display: "flex", gap: "var(--zen-space-2)" }}>
              <select
                id="ticket-owner"
                className="zen-select"
                value={ticket.ownerId ?? ""}
                disabled={savingField === "owner"}
                onChange={(e) => handleOwnerChange(e.target.value)}
              >
                <option value="">Unassigned</option>
                {owners.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
              {ticket.ownerId !== user?.id && (
                <button
                  type="button"
                  className="zen-btn zen-btn-secondary"
                  onClick={handleClaim}
                  disabled={savingField === "owner"}
                >
                  Claim
                </button>
              )}
            </div>
            {ownerError && <div className="zen-field-error">{ownerError}</div>}
            {savedField === "owner" && !ownerError && (
              <div className="zen-field-hint">Owner saved</div>
            )}
          </div>

          <div className="zen-field">
            <label className="zen-field-label" htmlFor="ticket-it-priority">
              IT Priority
            </label>
            <select
              id="ticket-it-priority"
              className="zen-select"
              value={ticket.itPriority}
              disabled={savingField === "itPriority"}
              onChange={(e) => handlePriorityChange(e.target.value)}
            >
              <option value="HIGH">High</option>
              <option value="MEDIUM">Medium</option>
              <option value="LOW">Low</option>
            </select>
            {priorityError && <div className="zen-field-error">{priorityError}</div>}
            {savedField === "itPriority" && !priorityError && (
              <div className="zen-field-hint">IT priority saved</div>
            )}
          </div>

          <div className="zen-field">
            <label className="zen-field-label" htmlFor="ticket-status">
              Current Status
            </label>
            {/* BR-22: only the permitted transitions are offered at all. The
                backend still refuses anything else if it is sent anyway. */}
            <select
              id="ticket-status"
              className="zen-select"
              value=""
              disabled={savingField === "status" || nextStatuses.length === 0}
              onChange={(e) => handleStatusChange(e.target.value)}
            >
              <option value="">{statusLabel(ticket.currentStatus)}</option>
              {nextStatuses.map((s) => (
                <option key={s} value={s}>
                  Move to {statusLabel(s)}
                </option>
              ))}
            </select>
            {nextStatuses.length === 0 && (
              <div className="zen-field-hint">
                {statusLabel(ticket.currentStatus)} is final. This ticket cannot move again.
              </div>
            )}
            {statusError && <div className="zen-field-error">{statusError}</div>}
            {savedField === "status" && !statusError && (
              <div className="zen-field-hint">Status saved</div>
            )}
          </div>

          <ReadOnlyField
            label="Status Badge"
            value={<StatusBadge status={ticket.currentStatus} />}
          />

          <ReadOnlyField label="Summary" value={ticket.summary} className="zen-field--full" />
          <div className="zen-field zen-field--readonly zen-field--full">
            <span className="zen-field-label">Description</span>
            <div className="zen-readonly-value zen-description">{ticket.description}</div>
          </div>
        </div>
      </div>

      <section className="zen-card">
        <h2 style={{ fontSize: 16, marginTop: 0 }}>Attachments ({ticket.attachments.length})</h2>
        {ticket.attachments.length === 0 ? (
          <p style={{ color: "var(--zen-text-muted)" }}>No attachments on this ticket.</p>
        ) : (
          ticket.attachments.map((attachment) => (
            <div key={attachment.id} className="zen-attachment-row">
              <div className="zen-attachment-info">
                <div className="zen-attachment-name">{attachment.originalName}</div>
                <div className="zen-attachment-meta">
                  {formatFileSize(attachment.sizeBytes)} ·{" "}
                  <AttachmentStateBadge removed={Boolean(attachment.removedAt)} />
                  {attachment.removedReason && <> · {attachment.removedReason}</>}
                </div>
              </div>
              <div className="zen-attachment-actions">
                {/* BR-28 (Lab 2): a removed attachment keeps its metadata but
                    loses the download control entirely. */}
                {!attachment.removedAt && (
                  <button
                    type="button"
                    className="zen-btn zen-btn-tertiary"
                    onClick={() => handleDownload(attachment)}
                  >
                    Download
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </section>

      <div className="zen-form-grid">
        <CommentPanel
          variant="public"
          messages={ticket.publicComments}
          onPost={async (body) => {
            await postComment(ticket.id, body);
            load();
          }}
        />
        <CommentPanel
          variant="internal"
          messages={ticket.internalNotes}
          onPost={async (body) => {
            await postInternalNote(ticket.id, body);
            load();
          }}
        />
      </div>
    </div>
  );
}
