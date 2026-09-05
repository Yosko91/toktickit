import type { ReactNode } from "react";

// ui-spec.md section 6 - the same five states (loading/empty/no-results/
// error/populated) are used consistently across all three main screens.

export function LoadingPanel({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="zen-state" role="status">
      <div className="zen-spinner" aria-hidden="true" />
      <div>{label}</div>
    </div>
  );
}

export function StatePanel({
  icon,
  title,
  description,
  action,
  alert,
}: {
  icon?: string;
  title: string;
  description?: string;
  action?: ReactNode;
  alert?: boolean;
}) {
  return (
    <div className="zen-state" role={alert ? "alert" : undefined}>
      {icon && (
        <div className="zen-state-icon" aria-hidden="true">
          {icon}
        </div>
      )}
      <div className="zen-state-title">{title}</div>
      {description && description !== title && <p>{description}</p>}
      {action}
    </div>
  );
}
