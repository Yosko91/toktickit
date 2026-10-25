import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ApiError, getStaffDashboard } from "../api";
import type { StaffDashboardData } from "../api";
import { useAuth } from "../context/AuthContext";
import { LoadingPanel, StatePanel } from "../components/StatePanel";
import { ActionStatusBadge, PriorityBadge, StatusBadge } from "../components/Badge";
import { MetricCard, TicketMiniList, firstName, formatShort } from "../components/DashboardParts";

// docs/lab-04/ui-spec.md section 4. The operational starting point for IT
// Staff. An Administrator gets the same page plus the user counts, which the
// server only sends to an Administrator (BR-29).
export function StaffDashboard() {
  const { user } = useAuth();
  const [data, setData] = useState<StaffDashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    setData(null);
    getStaffDashboard()
      .then((d) => !cancelled && setData(d))
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : "Unable to load the dashboard");
      });
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const reload = () => setReloadKey((k) => k + 1);

  if (error) {
    return (
      <StatePanel
        icon="⚠️"
        title="Unable to load the dashboard"
        description={error}
        alert
        action={
          <button type="button" className="zen-btn zen-btn-primary" onClick={reload}>
            Retry
          </button>
        }
      />
    );
  }
  if (!data) return <LoadingPanel label="Loading the dashboard…" />;

  const detail = (id: number) => `/queue/${id}`;
  const users = data.userCounts;

  return (
    <div>
      <div className="zen-list-header">
        <div>
          <h1>Welcome back, {firstName(user?.name)}</h1>
          <p className="zen-muted">Here is what is happening in the queue today.</p>
        </div>
        <div className="zen-list-header-actions">
          <button type="button" className="zen-btn zen-btn-secondary" onClick={reload}>
            ↻ Refresh
          </button>
        </div>
      </div>

      <div className="zen-metric-grid">
        {data.metrics.map((m) => (
          <MetricCard key={m.key} label={m.label} value={m.value} link={m.link} />
        ))}
        {users && (
          <MetricCard
            label="Active Users"
            value={users.activeRequesters + users.activeItStaff + users.activeAdministrators}
            link={users.link}
          >
            <div className="zen-metric-detail">
              {users.activeRequesters} requesters · {users.activeItStaff} IT staff ·{" "}
              {users.activeAdministrators} admins · {users.inactiveUsers} inactive
            </div>
          </MetricCard>
        )}
      </div>

      <div className="zen-dashboard-columns">
        <section className="zen-card zen-dashboard-card" aria-label="Tickets by Status">
          <h2 className="zen-card-title" style={{ marginBottom: "var(--zen-space-3)" }}>
            Tickets by Status
          </h2>
          <ul className="zen-count-list">
            {data.byStatus.map((row) => (
              <li key={row.status}>
                <Link to={row.link} className="zen-count-link">
                  <StatusBadge status={row.status} />
                  <span className="zen-visually-hidden">: </span>
                  <span className="zen-count-value">{row.value}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
        <section className="zen-card zen-dashboard-card" aria-label="Active by IT Priority">
          <h2 className="zen-card-title" style={{ marginBottom: "var(--zen-space-3)" }}>
            Active by IT Priority
          </h2>
          <ul className="zen-count-list">
            {data.byItPriority.map((row) => (
              <li key={row.priority}>
                <Link to={row.link} className="zen-count-link">
                  <PriorityBadge priority={row.priority} />
                  <span className="zen-visually-hidden">: </span>
                  <span className="zen-count-value">{row.value}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <div className="zen-dashboard-columns">
        <section className="zen-card zen-dashboard-card" id="my-open-actions" aria-label="My Open Actions">
          <h2 className="zen-card-title" style={{ marginBottom: "var(--zen-space-3)" }}>
            My Open Actions
          </h2>
          {data.myOpenActions.length === 0 ? (
            <p className="zen-muted">You have no planned or running actions.</p>
          ) : (
            <ul className="zen-mini-list">
              {data.myOpenActions.map((a) => (
                <li key={a.id} className="zen-mini-row">
                  <Link to={detail(a.ticketId)} className="zen-mini-link">
                    <span className="zen-mini-number">{a.ticketNumber}</span>
                    <span className="zen-mini-summary">{a.description}</span>
                  </Link>
                  <span className="zen-mini-meta">
                    <ActionStatusBadge status={a.status} />
                    <time dateTime={a.actionAt}>{formatShort(a.actionAt)}</time>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
        <TicketMiniList
          title="Urgent Tickets"
          items={data.urgentTickets}
          emptyText="No active High priority ticket."
          detailPath={detail}
          viewAll="/queue?itPriority=HIGH&statusGroup=active"
        />
      </div>

      <TicketMiniList
        title="Recently Updated"
        items={data.recentlyUpdated}
        emptyText="No ticket yet."
        detailPath={detail}
        viewAll="/queue"
      />
    </div>
  );
}
