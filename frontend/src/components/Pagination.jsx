export default function Pagination({ meta, onPage }) {
  if (!meta || meta.totalPages <= 1) {
    return meta ? <div className="pagination"><span className="muted">{meta.total} record(s)</span></div> : null;
  }
  const { page, totalPages, total } = meta;
  return (
    <nav className="pagination" aria-label="Pagination">
      <span className="muted">{total} record(s)</span>
      <div className="pagination-controls">
        <button type="button" className="btn btn-secondary btn-sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>
          ‹ Prev
        </button>
        <span>Page {page} of {totalPages}</span>
        <button type="button" className="btn btn-secondary btn-sm" disabled={page >= totalPages} onClick={() => onPage(page + 1)}>
          Next ›
        </button>
      </div>
    </nav>
  );
}
