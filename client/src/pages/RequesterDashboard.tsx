import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ApiError, getRequesterDashboard } from "../api";
import type { RequesterDashboardData } from "../api";
import { useAuth } from "../context/AuthContext";
import { LoadingPanel, StatePanel } from "../components/StatePanel";
import { MetricCard, TicketMiniList, firstName } from "../components/DashboardParts";

// docs/lab-04/ui-spec.md section 3. A short summary of the Requester's own
// tickets (BR-26, checked by the server) with links to the full lists.
export function RequesterDashboard() {
  const { user } = useAuth();
  const [data, setData] = useState<RequesterDashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    setData(null);
    getRequesterDashboard()
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
        title="Unable to load your dashboard"
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
  if (!data) return <LoadingPanel label="Loading your dashboard…" />;

  const detail = (id: number) => `/tickets/${id}`;

  return (
    <div>
      <div className="zen-list-header">
        <div>
          <h1>Welcome, {firstName(user?.name)}</h1>
          <p className="zen-muted">Here is the latest on your requests.</p>
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
      </div>

      <div className="zen-dashboard-columns">
        <div>
          <TicketMiniList
            title="Needs My Attention"
            items={data.needsAttention}
            emptyText="Nothing is waiting for you."
            detailPath={detail}
            viewAll="/tickets?currentStatus=WAITING_FOR_REQUESTER"
          />
          <TicketMiniList
            title="Recently Updated"
            items={data.recentlyUpdated}
            emptyText="You have no tickets yet."
            detailPath={detail}
            viewAll="/tickets"
          />
        </div>
        <div>
          <TicketMiniList
            title="Recently Resolved"
            items={data.recentlyResolved}
            emptyText="Nothing was resolved in the last 30 days."
            detailPath={detail}
          />
          <section className="zen-card zen-dashboard-card" aria-label="Quick Actions">
            <h2 className="zen-card-title" style={{ marginBottom: "var(--zen-space-3)" }}>
              Quick Actions
            </h2>
            <div className="zen-quick-actions">
              <Link to="/tickets/new" className="zen-btn zen-btn-primary">
                + Create Ticket
              </Link>
              <Link to="/tickets" className="zen-btn zen-btn-secondary">
                View My Tickets
              </Link>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
