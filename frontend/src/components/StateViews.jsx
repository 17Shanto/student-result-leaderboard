export function Loading({ label = 'Loading…' }) {
  return (
    <div className="state state-loading" role="status">
      <span className="spinner" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}

export function Empty({ title = 'Nothing here yet', children }) {
  return (
    <div className="state state-empty">
      <strong>{title}</strong>
      {children && <p>{children}</p>}
    </div>
  );
}

export function ErrorState({ error, onRetry }) {
  const isAuth = error?.status === 401 || error?.status === 403;
  return (
    <div className="state state-error" role="alert">
      <strong>{isAuth ? 'Not authorized' : error?.status >= 500 ? 'Server error' : 'Something went wrong'}</strong>
      <p>{error?.message || 'Unexpected error'}</p>
      {onRetry && !isAuth && (
        <button type="button" className="btn btn-secondary" onClick={onRetry}>Try again</button>
      )}
    </div>
  );
}

export function Alert({ type = 'error', children }) {
  if (!children) return null;
  return <div className={`alert alert-${type}`} role={type === 'error' ? 'alert' : 'status'}>{children}</div>;
}
