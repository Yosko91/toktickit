import { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useRequester } from "../context/RequesterContext";

// ui-spec.md section 7 - application shell: brand, nav with clear
// active-page indication, current Requester + Change Requester, responsive
// hamburger nav under 992px.
export function AppShell() {
  const { requester, changeRequester } = useRequester();
  const [navOpen, setNavOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();

  function handleChangeRequester() {
    setMenuOpen(false);
    changeRequester();
    navigate("/select-requester");
  }

  return (
    <div className="zen-shell">
      <header className="zen-header">
        <div className="zen-header-bar">
          <NavLink to="/tickets" className="zen-brand">
            <span className="zen-brand-icon" aria-hidden="true">
              🕐
            </span>
            TokTickIT
          </NavLink>

          <button
            type="button"
            className="zen-nav-toggle"
            aria-expanded={navOpen}
            aria-label="Open navigation"
            onClick={() => setNavOpen((v) => !v)}
          >
            ☰
          </button>

          <nav className={`zen-nav ${navOpen ? "is-open" : ""}`} aria-label="Main navigation">
            <NavLink
              to="/tickets"
              end
              className={({ isActive }) => `zen-nav-link ${isActive ? "is-active" : ""}`}
              onClick={() => setNavOpen(false)}
            >
              📄 My Tickets
            </NavLink>
            <NavLink
              to="/tickets/new"
              className={({ isActive }) => `zen-nav-link ${isActive ? "is-active" : ""}`}
              onClick={() => setNavOpen(false)}
            >
              ➕ Create Ticket
            </NavLink>
          </nav>

          <div className="zen-header-right">
            <button
              type="button"
              className="zen-requester-menu-button"
              aria-haspopup="true"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((v) => !v)}
            >
              👤 {requester?.name ?? "Requester"} ▾
            </button>
            {menuOpen && (
              <div className="zen-requester-menu" role="menu">
                <div className="zen-requester-menu-name">
                  {requester?.name}
                  <div style={{ fontWeight: 400, fontSize: 13, color: "var(--zen-text-muted)" }}>
                    {requester?.email}
                  </div>
                </div>
                <button
                  type="button"
                  className="zen-btn zen-btn-tertiary"
                  style={{ width: "100%", justifyContent: "flex-start" }}
                  onClick={handleChangeRequester}
                >
                  Change Requester
                </button>
              </div>
            )}
          </div>
        </div>
      </header>
      <main className="zen-page">
        <div className="zen-container">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
