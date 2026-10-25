import { useAuth } from "../context/AuthContext";
import { RequesterDashboard } from "./RequesterDashboard";
import { StaffDashboard } from "./StaffDashboard";

// ui-spec.md section 1: one route, the layout follows the role. The data
// itself is protected by the server (each endpoint checks the role).
export function Dashboard() {
  const { user } = useAuth();
  if (!user) return null;
  return user.role === "REQUESTER" ? <RequesterDashboard /> : <StaffDashboard />;
}
