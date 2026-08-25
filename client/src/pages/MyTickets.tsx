import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useRequester } from "../context/RequesterContext";
import { ApiError, getCategories, listTickets } from "../api";
import type { Category, RequestedPriority, TicketListItem, TicketListResponse, TicketStatus } from "../api";
import { LoadingPanel, StatePanel } from "../components/StatePanel";
import { PriorityBadge, StatusBadge } from "../components/Badge";
import { Pagination } from "../components/Pagination";

type SortField = "createdAt" | "ticketNumber" | "summary" | "requestedPriority";
const PAGE_SIZE = 10;

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ui-spec.md section 10 - My Tickets screen: search, filters, sort,
// pagination, and the empty-vs-no-results distinction (BR-31).
export function MyTickets() {
  const { requester } = useRequester();
  const navigate = useNavigate();

  const [categories, setCategories] = useState<Category[]>([]);
  useEffect(() => {
    getCategories()
      .then(setCategories)
      .catch(() => setCategories([]));
  }, []);

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  const [categoryId, setCategoryId] = useState("");
  const [priority, setPriority] = useState<RequestedPriority | "">("");
  const [status, setStatus] = useState<TicketStatus | "">("");
  const [sortBy, setSortBy] = useState<SortField>("createdAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);

  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<TicketListResponse | null>(null);

  // Simplification (documented): filters always start empty on mount, so
  // the very first response for a Requester is the unfiltered baseline used
  // to tell "no tickets exist yet" (empty state) apart from "tickets exist
  // but none match" (no-results state) without a second request.
  const [hasAnyTickets, setHasAnyTickets] = useState<boolean | null>(null);

  useEffect(() => {
    setHasAnyTickets(null);
    setPage(1);
  }, [requester?.id]);

  const filtersActive = Boolean(debouncedSearch || categoryId || priority || status);

  useEffect(() => {
    if (!requester) return;
    let cancelled = false;
    setState("loading");
    setError(null);

    listTickets(requester.id, {
      search: debouncedSearch || undefined,
      categoryId: categoryId ? Number(categoryId) : undefined,
      requestedPriority: priority || undefined,
      currentStatus: status || undefined,
      sortBy,
      sortDir,
      page,
      pageSize: PAGE_SIZE,
    })
      .then((res) => {
        if (cancelled) return;
        setResult(res);
        setState("ready");
        if (hasAnyTickets === null && !filtersActive) {
          setHasAnyTickets(res.pagination.totalItems > 0);
        }
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof ApiError ? err.message : "Unable to load tickets");
        setState("error");
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requester?.id, debouncedSearch, categoryId, priority, status, sortBy, sortDir, page]);

  function handleSort(field: SortField) {
    if (field === sortBy) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(field);
      setSortDir("asc");
    }
  }

  function clearFilters() {
    setSearch("");
    setCategoryId("");
    setPriority("");
    setStatus("");
    setPage(1);
  }

  function sortIndicator(field: SortField): string {
    if (field !== sortBy) return "";
    return sortDir === "asc" ? " ▲" : " ▼";
  }

  function openTicket(id: number) {
    navigate(`/tickets/${id}`);
  }

  return (
    <div>
      <div className="zen-list-header">
        <div>
          <h1>My Tickets</h1>
          <p style={{ color: "var(--zen-text-muted)", margin: 0 }}>
            View and track all of your support requests.
          </p>
        </div>
        <div className="zen-list-header-actions">
          <button type="button" className="zen-btn zen-btn-tertiary" onClick={clearFilters}>
            ↺ Clear Filters
          </button>
          <Link to="/tickets/new" className="zen-btn zen-btn-primary">
            + Create Ticket
          </Link>
        </div>
      </div>

      <div className="zen-filters">
        <input
          className="zen-input"
          type="search"
          placeholder="Search by ticket number or summary…"
          aria-label="Search by ticket number or summary"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
        <select
          className="zen-select"
          aria-label="Filter by category"
          value={categoryId}
          onChange={(e) => {
            setCategoryId(e.target.value);
            setPage(1);
          }}
        >
          <option value="">All Categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select
          className="zen-select"
          aria-label="Filter by requested priority"
          value={priority}
          onChange={(e) => {
            setPriority(e.target.value as RequestedPriority | "");
            setPage(1);
          }}
        >
          <option value="">All Priorities</option>
          <option value="LOW">Low</option>
          <option value="MEDIUM">Medium</option>
          <option value="HIGH">High</option>
        </select>
        <select
          className="zen-select"
          aria-label="Filter by current status"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value as TicketStatus | "");
            setPage(1);
          }}
        >
          <option value="">All Statuses</option>
          <option value="NEW">New</option>
        </select>
      </div>

      {state === "loading" && <LoadingPanel label="Loading your tickets…" />}

      {state === "error" && (
        <StatePanel
          icon="⚠️"
          title="Unable to load your tickets"
          description={error ?? undefined}
          alert
          action={
            <button type="button" className="zen-btn zen-btn-primary" onClick={() => setPage((p) => p)}>
              Retry
            </button>
          }
        />
      )}

      {state === "ready" && result && result.data.length === 0 && !filtersActive && (
        <StatePanel
          icon="🗒️"
          title="You haven't created any tickets yet"
          description="Create your first ticket to get help from IT."
          action={
            <Link to="/tickets/new" className="zen-btn zen-btn-primary">
              + Create Ticket
            </Link>
          }
        />
      )}

      {state === "ready" && result && result.data.length === 0 && filtersActive && (
        <StatePanel
          icon="🔍"
          title="No tickets match your filters"
          description="Try a different search term or clear your filters."
          action={
            <button type="button" className="zen-btn zen-btn-secondary" onClick={clearFilters}>
              Clear Filters
            </button>
          }
        />
      )}

      {state === "ready" && result && result.data.length > 0 && (
        <>
          <div className="zen-table-wrap">
            <table className="zen-table">
              <thead>
                <tr>
                  <th>
                    <button type="button" className="zen-table-sort-btn" onClick={() => handleSort("ticketNumber")}>
                      Ticket No.{sortIndicator("ticketNumber")}
                    </button>
                  </th>
                  <th>
                    <button type="button" className="zen-table-sort-btn" onClick={() => handleSort("createdAt")}>
                      Created Date{sortIndicator("createdAt")}
                    </button>
                  </th>
                  <th>
                    <button type="button" className="zen-table-sort-btn" onClick={() => handleSort("summary")}>
                      Summary{sortIndicator("summary")}
                    </button>
                  </th>
                  <th className="zen-col-category">Category</th>
                  <th>
                    <button
                      type="button"
                      className="zen-table-sort-btn"
                      onClick={() => handleSort("requestedPriority")}
                    >
                      Requested Priority{sortIndicator("requestedPriority")}
                    </button>
                  </th>
                  <th>Current Status</th>
                  <th>Last Updated</th>
                </tr>
              </thead>
              <tbody>
                {result.data.map((ticket: TicketListItem) => (
                  <tr
                    key={ticket.id}
                    tabIndex={0}
                    onClick={() => openTicket(ticket.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") openTicket(ticket.id);
                    }}
                  >
                    <td>{ticket.ticketNumber}</td>
                    <td>{formatDate(ticket.createdAt)}</td>
                    <td>{ticket.summary}</td>
                    <td className="zen-col-category">{ticket.categoryName}</td>
                    <td>
                      <PriorityBadge priority={ticket.requestedPriority} />
                    </td>
                    <td>
                      <StatusBadge status={ticket.currentStatus} />
                    </td>
                    <td>{formatDate(ticket.updatedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="zen-ticket-cards">
            {result.data.map((ticket: TicketListItem) => (
              <div
                key={ticket.id}
                className="zen-ticket-card"
                tabIndex={0}
                onClick={() => openTicket(ticket.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") openTicket(ticket.id);
                }}
              >
                <div className="zen-ticket-card-top">
                  <span>{ticket.ticketNumber}</span>
                  <PriorityBadge priority={ticket.requestedPriority} />
                </div>
                <div className="zen-ticket-card-summary">{ticket.summary}</div>
                <div className="zen-ticket-card-meta">
                  <span>{ticket.categoryName}</span>
                  <StatusBadge status={ticket.currentStatus} />
                  <span>Updated {formatDate(ticket.updatedAt)}</span>
                </div>
              </div>
            ))}
          </div>

          <Pagination
            page={result.pagination.page}
            pageSize={result.pagination.pageSize}
            totalItems={result.pagination.totalItems}
            totalPages={result.pagination.totalPages}
            onPageChange={setPage}
          />
        </>
      )}
    </div>
  );
}
