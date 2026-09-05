import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./components/AppShell";
import { RequireRequester } from "./components/RequireRequester";
import { RequesterSelection } from "./pages/RequesterSelection";
import { CreateTicket } from "./pages/CreateTicket";
import { MyTickets } from "./pages/MyTickets";

// Lab 2 replaces the Lab 1 "Check System" placeholder with the real
// Requester-facing application (see docs/lab-02/specification.md, section
// "Assumptions and Decisions"). The Ticket Detail screen is implemented in
// its own Issue/branch (feature/lab2-06) and lands here once completed.
export default function App() {
  return (
    <Routes>
      <Route path="/select-requester" element={<RequesterSelection />} />

      <Route element={<RequireRequester />}>
        <Route element={<AppShell />}>
          <Route path="/tickets" element={<MyTickets />} />
          <Route path="/tickets/new" element={<CreateTicket />} />
          <Route path="/tickets/:id" element={<p>Ticket Detail - coming soon</p>} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/tickets" replace />} />
    </Routes>
  );
}
