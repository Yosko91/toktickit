import type { ReactNode } from "react";

// ui-spec.md section 3 - one shared wrapper for label + control + error/hint
// so every field looks and behaves consistently (component rule, handout
// section 8.3: the asterisk never replaces the validation message).
export function FieldWrapper({
  label,
  htmlFor,
  required,
  error,
  hint,
  className,
  children,
}: {
  label: string;
  htmlFor: string;
  required?: boolean;
  error?: string;
  hint?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={`zen-field ${error ? "zen-field--error" : ""} ${className ?? ""}`}>
      <label className="zen-field-label" htmlFor={htmlFor}>
        {label}
        {required && (
          <span className="zen-required-asterisk" aria-hidden="true">
            *
          </span>
        )}
      </label>
      {children}
      {error ? (
        <p className="zen-field-error" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="zen-field-hint">{hint}</p>
      ) : null}
    </div>
  );
}

// A system-generated / not-yet-editable value, per ui-spec.md section 3
// ("read-only / system-generated" field state).
export function ReadOnlyField({
  label,
  value,
  hint,
  className,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  className?: string;
}) {
  return (
    <div className={`zen-field zen-field--readonly ${className ?? ""}`}>
      <span className="zen-field-label">{label}</span>
      <div className="zen-readonly-value">{value}</div>
      {hint && <p className="zen-field-hint">{hint}</p>}
    </div>
  );
}
