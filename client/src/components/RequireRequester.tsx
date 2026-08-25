import { Navigate, Outlet } from "react-router-dom";
import { useRequester } from "../context/RequesterContext";
import { LoadingPanel } from "./StatePanel";

// AC-02: no Development Requester selected -> the Requester Selection
// screen is shown instead of My Tickets/Create Ticket/Ticket Detail.
export function RequireRequester() {
  const { status, requester } = useRequester();

  if (status === "loading") {
    return <LoadingPanel label="Loading…" />;
  }
  if (!requester) {
    return <Navigate to="/select-requester" replace />;
  }
  return <Outlet />;
}
