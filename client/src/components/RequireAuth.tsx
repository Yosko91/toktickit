import { Navigate, Outlet, useLocation } from "react-router-dom";
import type { Role } from "../api";
import { useAuth } from "../context/AuthContext";
import { LoadingPanel, StatePanel } from "./StatePanel";

/** Where each role lands after signing in (ui-spec.md section 1). */
export function homeFor(role: Role): string {
  return role === "REQUESTER" ? "/tickets" : "/queue";
}

// FR-04/BR-02: an account holding an initial password is allowed exactly one
// destination until it has set a new one.
export function RequireAuth() {
  const { status, user } = useAuth();
  const location = useLocation();

  if (status === "loading") {
    return <LoadingPanel label="Loading…" />;
  }
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  if (user.mustChangePassword && location.pathname !== "/change-password") {
    return <Navigate to="/change-password" replace />;
  }
  return <Outlet />;
}

/**
 * FR-05/BR-12. The navigation already hides destinations a role cannot use, so
 * reaching this is either a typed URL or a stale link. It is still only
 * feedback: the backend refuses the same request independently, which is the
 * check that actually matters.
 */
export function RequireRole({ roles }: { roles: Role[] }) {
  const { user } = useAuth();

  if (user && !roles.includes(user.role)) {
    return (
      <StatePanel
        icon="🚫"
        title="You do not have access to this page"
        description="Your account does not have permission to view this part of TokTickIT."
        alert
      />
    );
  }
  return <Outlet />;
}
