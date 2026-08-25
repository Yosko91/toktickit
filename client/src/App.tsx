import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./components/AppShell";
import { RequireRequester } from "./components/RequireRequester";
import { RequesterSelection } from "./pages/RequesterSelection";

// Lab 2 replaces the Lab 1 "Check System" placeholder with the real
// Requester-facing application (see docs/lab-02/specification.md, section
// "Assumptions and Decisions"). The ticket screens below are implemented in
// their own Issues/branches (feature/lab2-04, -05, -06) and land here as
// each is completed.
export default function App() {
  return (
    <Routes>
      <Route path="/select-requester" element={<RequesterSelection />} />

      <Route element={<RequireRequester />}>
        <Route element={<AppShell />}>
          <Route path="/tickets" element={<p>My Tickets - coming soon</p>} />
          <Route path="/tickets/new" element={<p>Create Ticket - coming soon</p>} />
          <Route path="/tickets/:id" element={<p>Ticket Detail - coming soon</p>} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/tickets" replace />} />
    </Routes>
  );
}
