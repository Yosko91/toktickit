import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./components/AppShell";
import { RequireAuth, RequireRole, homeFor } from "./components/RequireAuth";
import { StatePanel } from "./components/StatePanel";
import { useAuth } from "./context/AuthContext";
import { Login } from "./pages/Login";
import { ChangePassword } from "./pages/ChangePassword";
import { CreateTicket } from "./pages/CreateTicket";
import { MyTickets } from "./pages/MyTickets";
import { TicketDetail } from "./pages/TicketDetail";

// Lab 3 replaces the Development Requester selector with a real Login screen
// and role-specific routing (docs/lab-03/specification.md section 6).

function HomeRedirect() {
  const { user } = useAuth();
  return <Navigate to={user ? homeFor(user.role) : "/login"} replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      <Route element={<RequireAuth />}>
        {/* Outside the shell: while a password change is pending there is no
            navigation at all, so the only ways out are finishing or signing out. */}
        <Route path="/change-password" element={<ChangePassword />} />

        <Route element={<AppShell />}>
          <Route path="/" element={<HomeRedirect />} />

          <Route element={<RequireRole roles={["REQUESTER"]} />}>
            <Route path="/tickets" element={<MyTickets />} />
            <Route path="/tickets/new" element={<CreateTicket />} />
            <Route path="/tickets/:id" element={<TicketDetail />} />
          </Route>

          {/* A plain "not found" rather than a redirect home: redirecting to a
              role's home page from an unknown path can loop if that page is the
              unknown path. */}
          <Route
            path="*"
            element={<StatePanel icon="🔍" title="That page does not exist" />}
          />
        </Route>
      </Route>
    </Routes>
  );
}
