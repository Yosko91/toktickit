import { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import type { Role } from "../api";
import { useAuth } from "../context/AuthContext";

// ui-spec.md section 1. The Lab 2 Development Requester display and the Change
// Requester action are gone (BR-42); the header now shows the authenticated
// user, their role and a Logout action.

const ROLE_LABEL: Record<Role, string> = {
  REQUESTER: "Requester",
  IT_STAFF: "IT Staff",
  ADMINISTRATOR: "Administrator",
};

interface NavItem {
  to: string;
  label: string;
  icon: string;
  end?: boolean;
}

/**
 * FR-05/AC-25: a destination the role cannot use is not rendered at all, rather
 * than rendered and disabled. The backend refuses it anyway (BR-12) - this is
 * feedback, not the access control.
 */
function navItemsFor(role: Role): NavItem[] {
  switch (role) {
    case "REQUESTER":
      return [
        { to: "/tickets", label: "My Tickets", icon: "📄", end: true },
        { to: "/tickets/new", label: "Create Ticket", icon: "➕" },
      ];
    case "IT_STAFF":
      return [{ to: "/queue", label: "Ticket Queue", icon: "🗂️" }];
    case "ADMINISTRATOR":
      return [
        { to: "/queue", label: "Ticket Queue", icon: "🗂️" },
        { to: "/admin/users", label: "Users", icon: "👥" },
      ];
  }
}

export function AppShell() {
  const { user, signOut } = useAuth();
  const [navOpen, setNavOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();

  const items = user ? navItemsFor(user.role) : [];

  async function handleSignOut() {
    setMenuOpen(false);
    await signOut();
    navigate("/login", { replace: true });
  }

  return (
    <div className="zen-shell">
      <header className="zen-header">
        <div className="zen-header-bar">
          <NavLink to={items[0]?.to ?? "/"} className="zen-brand">
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
            {items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) => `zen-nav-link ${isActive ? "is-active" : ""}`}
                onClick={() => setNavOpen(false)}
              >
                {item.icon} {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="zen-header-right">
            <button
              type="button"
              className="zen-requester-menu-button"
              aria-haspopup="true"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((v) => !v)}
            >
              👤 {user?.name ?? "Account"} ▾
            </button>
            {menuOpen && (
              <div className="zen-requester-menu" role="menu">
                <div className="zen-requester-menu-name">
                  {user?.name}
                  <div style={{ fontWeight: 400, fontSize: 13, color: "var(--zen-text-muted)" }}>
                    {user?.email}
                  </div>
                  {user && (
                    <div style={{ marginTop: 4 }}>
                      <span className="zen-badge zen-badge-status">{ROLE_LABEL[user.role]}</span>
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  className="zen-btn zen-btn-tertiary"
                  style={{ width: "100%", justifyContent: "flex-start" }}
                  onClick={() => {
                    setMenuOpen(false);
                    navigate("/change-password");
                  }}
                >
                  Change Password
                </button>
                <button
                  type="button"
                  className="zen-btn zen-btn-tertiary"
                  style={{ width: "100%", justifyContent: "flex-start" }}
                  onClick={handleSignOut}
                >
                  Logout
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
