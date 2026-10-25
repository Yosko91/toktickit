import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import type { DashboardTicket } from "../api";
import { StatusBadge } from "./Badge";

// docs/lab-04/ui-spec.md sections 2 to 4. Small building blocks shared by the
// Requester and the staff dashboard.

export function formatShort(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Only the "View" link is clickable, so keyboard users get one focus stop. */
export function MetricCard({
  label,
  value,
  link,
  children,
}: {
  label: string;
  value: number;
  link: string;
  children?: ReactNode;
}) {
  const accessibleName = `View ${label}: ${value}`;
  return (
    <div className="zen-metric-card">
      <div className="zen-metric-label">{label}</div>
      <div className="zen-metric-value">{value}</div>
      {children}
      {link.startsWith("#") ? (
        <a className="zen-metric-link" href={link} aria-label={accessibleName}>
          View
        </a>
      ) : (
        <Link className="zen-metric-link" to={link} aria-label={accessibleName}>
          View
        </Link>
      )}
    </div>
  );
}

export function TicketMiniList({
  title,
  id,
  items,
  emptyText,
  detailPath,
  viewAll,
}: {
  title: string;
  id?: string;
  items: DashboardTicket[];
  emptyText: string;
  detailPath: (ticketId: number) => string;
  viewAll?: string;
}) {
  return (
    <section className="zen-card zen-dashboard-card" id={id} aria-label={title}>
      <div className="zen-card-header">
        <h2 className="zen-card-title">{title}</h2>
        {viewAll && (
          <Link to={viewAll} className="zen-btn zen-btn-tertiary">
            View all
          </Link>
        )}
      </div>
      {items.length === 0 ? (
        <p className="zen-muted">{emptyText}</p>
      ) : (
        <ul className="zen-mini-list">
          {items.map((t) => (
            <li key={t.id} className="zen-mini-row">
              <Link to={detailPath(t.id)} className="zen-mini-link">
                <span className="zen-mini-number">{t.ticketNumber}</span>
                <span className="zen-mini-summary">{t.summary}</span>
              </Link>
              <span className="zen-mini-meta">
                <StatusBadge status={t.currentStatus} />
                <time dateTime={t.updatedAt}>{formatShort(t.updatedAt)}</time>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function firstName(name: string | undefined): string {
  return name?.split(" ")[0] ?? "";
}
