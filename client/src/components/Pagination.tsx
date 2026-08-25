// ui-spec.md section 10 - "Showing X to Y of Z tickets" + Previous / page
// numbers / Next.
export function Pagination({
  page,
  pageSize,
  totalItems,
  totalPages,
  onPageChange,
}: {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}) {
  if (totalItems === 0) return null;

  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, totalItems);

  const pages: number[] = [];
  for (let p = 1; p <= totalPages; p += 1) {
    if (p === 1 || p === totalPages || Math.abs(p - page) <= 1) {
      pages.push(p);
    }
  }

  return (
    <nav className="zen-pagination" aria-label="Ticket list pagination">
      <span>
        Showing {from} to {to} of {totalItems} tickets
      </span>
      <div className="zen-pagination-controls">
        <button
          type="button"
          className="zen-page-btn"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          ‹ Previous
        </button>
        {pages.map((p, idx) => (
          <span key={p} style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
            {idx > 0 && p - pages[idx - 1]! > 1 && <span aria-hidden="true">…</span>}
            <button
              type="button"
              className={`zen-page-btn ${p === page ? "is-current" : ""}`}
              aria-current={p === page ? "page" : undefined}
              onClick={() => onPageChange(p)}
            >
              {p}
            </button>
          </span>
        ))}
        <button
          type="button"
          className="zen-page-btn"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          Next ›
        </button>
      </div>
    </nav>
  );
}
