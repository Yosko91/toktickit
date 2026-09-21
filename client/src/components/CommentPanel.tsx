import { useState } from "react";
import type { Role, TicketMessage } from "../api";

// ui-spec.md sections 4 and 6. The same component renders both streams, but the
// two are never in the same form and never share a submit button, so a private
// note cannot be posted into the public conversation by a mis-click (BR-26).

const ROLE_LABEL: Record<Role, string> = {
  REQUESTER: "Requester",
  IT_STAFF: "IT Staff",
  ADMINISTRATOR: "Administrator",
};

function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export interface CommentPanelProps {
  variant: "public" | "internal";
  messages: TicketMessage[];
  /** Omitted when the viewer may read the stream but not add to it. */
  onPost?: (body: string) => Promise<void>;
  disabledReason?: string;
}

export function CommentPanel({ variant, messages, onPost, disabledReason }: CommentPanelProps) {
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isInternal = variant === "internal";
  const title = isInternal
    ? "Internal Notes - never visible to the Requester"
    : "Public Comments - visible to the Requester";

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!onPost || body.trim().length === 0) return;

    setBusy(true);
    setError(null);
    try {
      await onPost(body.trim());
      setBody("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to post");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      className="zen-card"
      data-panel={variant}
      style={
        isInternal
          ? { background: "var(--zen-surface-muted, #faf8f2)", borderLeft: "4px solid #d9a441" }
          : { borderLeft: "4px solid var(--zen-green-600, #1f7a4d)" }
      }
    >
      <h2 style={{ fontSize: 16, marginTop: 0 }}>
        {isInternal && <span aria-hidden="true">🔒 </span>}
        {title}
      </h2>

      {onPost && (
        <form onSubmit={handleSubmit}>
          <div className="zen-field">
            <label className="zen-field-label" htmlFor={`${variant}-body`}>
              {isInternal ? "Add Internal Note" : "Add Public Comment"}
            </label>
            <textarea
              id={`${variant}-body`}
              className="zen-textarea"
              rows={3}
              maxLength={2000}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder={
                isInternal
                  ? "This note is only visible to IT Staff and Administrators…"
                  : "Type your comment here…"
              }
            />
            {error && <div className="zen-field-error">{error}</div>}
          </div>
          <div className="zen-form-actions">
            <button
              type="submit"
              className="zen-btn zen-btn-primary"
              disabled={busy || body.trim().length === 0}
            >
              {busy ? "Posting…" : isInternal ? "Save Note" : "Post Comment"}
            </button>
          </div>
        </form>
      )}

      {!onPost && disabledReason && <p className="zen-field-hint">{disabledReason}</p>}

      {messages.length === 0 ? (
        <p style={{ color: "var(--zen-text-muted)" }}>
          {isInternal ? "No internal notes yet." : "No comments yet."}
        </p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {messages.map((message) => (
            <li
              key={message.id}
              style={{
                display: "flex",
                gap: "var(--zen-space-2)",
                padding: "var(--zen-space-3) 0",
                borderTop: "1px solid var(--zen-border, #e5e7eb)",
              }}
            >
              <span
                aria-hidden="true"
                style={{
                  flex: "0 0 32px",
                  height: 32,
                  borderRadius: "50%",
                  background: "var(--zen-green-100, #e6f2ec)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 12,
                  fontWeight: 600,
                }}
              >
                {initials(message.authorName)}
              </span>
              <div style={{ minWidth: 0 }}>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                  <strong>{message.authorName}</strong>
                  <span className="zen-badge zen-badge-status">
                    {ROLE_LABEL[message.authorRole]}
                  </span>
                  <span style={{ color: "var(--zen-text-muted)", fontSize: 13 }}>
                    {formatWhen(message.createdAt)}
                  </span>
                </div>
                {/* BR-29: rendered as text. React escapes it, so a comment
                    containing markup is shown, never executed. */}
                <p style={{ margin: "4px 0 0", whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
                  {message.body}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
