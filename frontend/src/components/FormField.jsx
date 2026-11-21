export default function FormField({ label, name, error, children, hint }) {
  return (
    <div className={`field ${error ? 'field-invalid' : ''}`}>
      <label htmlFor={name}>{label}</label>
      {children}
      {hint && !error && <small className="hint">{hint}</small>}
      {error && <small className="field-error" id={`${name}-error`}>{error}</small>}
    </div>
  );
}
