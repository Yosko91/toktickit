import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ApiError,
  getAssignableUsers,
  getCategories,
  listStaffTickets,
} from "../api";
import type {
  AssignableUser,
  Category,
  RequestedPriority,
  StaffQueueParams,
  StaffTicketListItem,
  TicketStatus,
} from "../api";
import { LoadingPanel, StatePanel } from "../components/StatePanel";
import { PriorityBadge, StatusBadge } from "../components/Badge";
import { Pagination } from "../components/Pagination";
import { ALL_STATUSES, statusLabel } from "../utils/ticketWorkflow";

// ui-spec.md section 5 - the IT Staff Ticket Queue. Unlike My Tickets this is
// every ticket from every Requester; the scoping is by filter, not by identity.

type SortField = NonNullable<StaffQueueParams["sortBy"]>;

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function StaffTicketQueue() {
  const navigate = useNavigate();

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [status, setStatus] = useState("");
  const [itPriority, setItPriority] = useState("");
  const [ownerId, setOwnerId] = useState("");
  const [sortBy, setSortBy] = useState<SortField>("createdAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);

  const [categories, setCategories] = useState<Category[]>([]);
  const [owners, setOwners] = useState<AssignableUser[]>([]);
  const [tickets, setTickets] = useState<StaffTicketListItem[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState<string | null>(null);

  const hasFilters =
    debouncedSearch !== "" || categoryId !== "" || status !== "" || itPriority !== "" || ownerId !== "";

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    getCategories().then(setCategories).catch(() => setCategories([]));
    getAssignableUsers().then(setOwners).catch(() => setOwners([]));
  }, []);

  // Any filter change resets to page 1: staying on page 4 of a result set that
  // now has one page shows an empty screen that looks like a failure.
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, categoryId, status, itPriority, ownerId]);

  const load = useCallback(() => {
    setState("loading");
    setError(null);

    listStaffTickets({
      search: debouncedSearch || undefined,
      categoryId: categoryId ? Number(categoryId) : undefined,
      currentStatus: (status || undefined) as TicketStatus | undefined,
      itPriority: (itPriority || undefined) as RequestedPriority | undefined,
      ownerId: ownerId === "unassigned" ? "unassigned" : ownerId ? Number(ownerId) : undefined,
      sortBy,
      sortDir,
      page,
      pageSize: 20,
    })
      .then((result) => {
        setTickets(result.data);
        setTotalItems(result.pagination.totalItems);
        setTotalPages(result.pagination.totalPages);
        setState("ready");
      })
      .catch((err: unknown) => {
        setError(err instanceof ApiError ? err.message : "Unable to load the ticket queue");
        setState("error");
      });
  }, [debouncedSearch, categoryId, status, itPriority, ownerId, sortBy, sortDir, page]);

  useEffect(() => {
    load();
  }, [load]);

  function toggleSort(field: SortField) {
    if (sortBy === field) {
      setSortDir((dir) => (dir === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(field);
      setSortDir("asc");
    }
  }

  function clearFilters() {
    setSearch("");
    setDebouncedSearch("");
    setCategoryId("");
    setStatus("");
    setItPriority("");
    setOwnerId("");
  }

  function sortButton(field: SortField, label: string) {
    return (
      <button type="button" className="zen-table-sort-btn" onClick={() => toggleSort(field)}>
        {label} {sortBy === field ? (sortDir === "asc" ? "▲" : "▼") : "⇅"}
      </button>
    );
  }

  return (
    <div>
      <div className="zen-list-header">
        <h1>Ticket Queue</h1>
        {state === "ready" && (
          <span style={{ color: "var(--zen-text-muted)" }}>
            {totalItems} {totalItems === 1 ? "ticket" : "tickets"}
          </span>
        )}
      </div>

      <div className="zen-filters">
        <div className="zen-field">
          <label className="zen-field-label" htmlFor="queue-search">
            Search
          </label>
          <input
            id="queue-search"
            className="zen-input"
            type="search"
            placeholder="Ticket number or summary…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="zen-field">
          <label className="zen-field-label" htmlFor="queue-category">
            Category
          </label>
          <select
            id="queue-category"
            className="zen-select"
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
          >
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <div className="zen-field">
          <label className="zen-field-label" htmlFor="queue-status">
            Status
          </label>
          <select
            id="queue-status"
            className="zen-select"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="">All statuses</option>
            {ALL_STATUSES.map((s) => (
              <option key={s} value={s}>
                {statusLabel(s)}
              </option>
            ))}
          </select>
        </div>

        <div className="zen-field">
          <label className="zen-field-label" htmlFor="queue-priority">
            IT Priority
          </label>
          <select
            id="queue-priority"
            className="zen-select"
            value={itPriority}
            onChange={(e) => setItPriority(e.target.value)}
          >
            <option value="">All priorities</option>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
          </select>
        </div>

        <div className="zen-field">
          <label className="zen-field-label" htmlFor="queue-owner">
            Owner
          </label>
          <select
            id="queue-owner"
            className="zen-select"
            value={ownerId}
            onChange={(e) => setOwnerId(e.target.value)}
          >
            <option value="">All owners</option>
            {/* Finding unclaimed work is the main reason to open this screen. */}
            <option value="unassigned">Unassigned</option>
            {owners.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {state === "loading" && <LoadingPanel label="Loading the queue…" />}

      {state === "error" && (
        <StatePanel
          icon="⚠️"
          title="Unable to load the ticket queue"
          description={error ?? undefined}
          alert
          action={
            <button type="button" className="zen-btn zen-btn-primary" onClick={load}>
              Retry
            </button>
          }
        />
      )}

      {state === "ready" && tickets.length === 0 && !hasFilters && (
        <StatePanel icon="📭" title="No tickets in the queue yet" />
      )}

      {state === "ready" && tickets.length === 0 && hasFilters && (
        <StatePanel
          icon="🔍"
          title="No tickets match these filters"
          description="Try a different search or clear the filters."
          action={
            <button type="button" className="zen-btn zen-btn-secondary" onClick={clearFilters}>
              Clear filters
            </button>
          }
        />
      )}

      {state === "ready" && tickets.length > 0 && (
        <>
          <div className="zen-table-wrap zen-table-wrap--cards">
            <table className="zen-table">
              <thead>
                <tr>
                  <th>{sortButton("ticketNumber", "Ticket No.")}</th>
                  <th>{sortButton("createdAt", "Created")}</th>
                  <th>Summary</th>
                  <th className="zen-col-category">Category</th>
                  <th className="zen-col-category">Req. Priority</th>
                  <th>{sortButton("itPriority", "IT Priority")}</th>
                  <th>{sortButton("currentStatus", "Status")}</th>
                  <th>Owner</th>
                </tr>
              </thead>
              <tbody>
                {tickets.map((ticket) => (
                  <tr
                    key={ticket.id}
                    onClick={() => navigate(`/queue/${ticket.id}`)}
                    style={{ cursor: "pointer" }}
                  >
                    <td>
                      <Link to={`/queue/${ticket.id}`} onClick={(e) => e.stopPropagation()}>
                        {ticket.ticketNumber}
                      </Link>
                    </td>
                    <td>{formatDate(ticket.createdAt)}</td>
                    <td title={ticket.summary} className="zen-ticket-card-summary">
                      {ticket.summary}
                    </td>
                    <td className="zen-col-category">{ticket.categoryName}</td>
                    <td className="zen-col-category">
                      <PriorityBadge priority={ticket.requestedPriority} />
                    </td>
                    <td>
                      <PriorityBadge priority={ticket.itPriority} />
                    </td>
                    <td>
                      <StatusBadge status={ticket.currentStatus} />
                    </td>
                    <td>
                      {/* Never an empty cell: "Unassigned" is information. */}
                      {ticket.ownerName ?? (
                        <span style={{ color: "var(--zen-text-muted)" }}>Unassigned</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Under 768px the table is replaced by cards (ui-spec.md section 5). */}
          <div className="zen-ticket-cards">
            {tickets.map((ticket) => (
              <Link key={ticket.id} to={`/queue/${ticket.id}`} className="zen-ticket-card">
                <div className="zen-ticket-card-top">
                  <strong>{ticket.ticketNumber}</strong>
                  <StatusBadge status={ticket.currentStatus} />
                </div>
                <div className="zen-ticket-card-summary">{ticket.summary}</div>
                <div className="zen-ticket-card-meta">
                  <span>{ticket.categoryName}</span>
                  <PriorityBadge priority={ticket.itPriority} />
                  <span>{ticket.ownerName ?? "Unassigned"}</span>
                </div>
              </Link>
            ))}
          </div>

          <Pagination
            page={page}
            pageSize={20}
            totalItems={totalItems}
            totalPages={totalPages}
            onPageChange={setPage}
          />
        </>
      )}
    </div>
  );
}
