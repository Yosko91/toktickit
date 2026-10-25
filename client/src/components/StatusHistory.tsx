import type { StatusChange } from "../api";
import { statusLabel } from "../utils/ticketWorkflow";

// docs/lab-04/ui-spec.md section 8. Read only on both Ticket Detail screens:
// the history is append-only (BR-20), so there is nothing to edit here.

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function StatusHistory({ changes }: { changes: StatusChange[] }) {
  return (
    <section className="zen-card" aria-labelledby="status-history-title">
      <h2 id="status-history-title" className="zen-card-title" style={{ marginBottom: "var(--zen-space-3)" }}>
        Status History
      </h2>
      {changes.length === 0 ? (
        <p className="zen-muted">No status changes recorded since Lab 4.</p>
      ) : (
        <ol className="zen-history-list">
          {changes.map((change) => (
            <li key={change.id} className="zen-history-row">
              <span className="zen-history-move">
                {statusLabel(change.fromStatus)} <span aria-hidden="true">→</span>
                <span className="zen-visually-hidden"> to </span> {statusLabel(change.toStatus)}
              </span>
              <span className="zen-history-meta">
                {change.changedByName} · <time dateTime={change.changedAt}>{formatWhen(change.changedAt)}</time>
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
