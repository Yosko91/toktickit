import { useCallback, useEffect, useState } from "react";
import {
  ApiError,
  createUser,
  listUsers,
  setInitialPassword,
  updateUser,
} from "../api";
import type { ManagedUser, Role } from "../api";
import { useAuth } from "../context/AuthContext";
import { LoadingPanel, StatePanel } from "../components/StatePanel";
import { Badge } from "../components/Badge";
import { PASSWORD_RULES, passwordMeetsAllRules } from "../utils/passwordRules";

// ui-spec.md section 7 - Administrator User Management. Deliberately minimal:
// list on the left, one panel on the right that is either creating or editing.
// No pagination, no multi-column sorting, no bulk operations (labsheet 4.2).

const ROLE_LABEL: Record<Role, string> = {
  REQUESTER: "Requester",
  IT_STAFF: "IT Staff",
  ADMINISTRATOR: "Administrator",
};
const ROLES: Role[] = ["REQUESTER", "IT_STAFF", "ADMINISTRATOR"];

type Panel = { mode: "none" } | { mode: "create" } | { mode: "edit"; user: ManagedUser };

function PasswordChecklist({ value }: { value: string }) {
  return (
    <div className="zen-field-hint">
      <strong>Password must:</strong>
      <ul style={{ listStyle: "none", padding: 0, margin: "4px 0 0" }}>
        {PASSWORD_RULES.map((rule) => {
          const satisfied = rule.test(value);
          return (
            <li
              key={rule.id}
              data-satisfied={satisfied}
              style={{ color: satisfied ? "var(--zen-green-700)" : "var(--zen-text-muted)" }}
            >
              <span aria-hidden="true">{satisfied ? "✓" : "○"}</span> {rule.label}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function UserManagement() {
  const { user: currentUser } = useAuth();

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [panel, setPanel] = useState<Panel>({ mode: "none" });

  // Form state, shared by the create and edit panels.
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("REQUESTER");
  const [isActive, setIsActive] = useState(true);
  const [initialPassword, setInitialPasswordValue] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [panelError, setPanelError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const load = useCallback(() => {
    setState("loading");
    setLoadError(null);
    listUsers({
      search: debouncedSearch || undefined,
      role: (roleFilter || undefined) as Role | undefined,
    })
      .then((result) => {
        setUsers(result);
        setState("ready");
      })
      .catch((err: unknown) => {
        setLoadError(err instanceof ApiError ? err.message : "Unable to load users");
        setState("error");
      });
  }, [debouncedSearch, roleFilter]);

  useEffect(() => {
    load();
  }, [load]);

  function resetForm() {
    setFieldErrors({});
    setPanelError(null);
    setInitialPasswordValue("");
    setNewPassword("");
  }

  function openCreate() {
    resetForm();
    setName("");
    setEmail("");
    setRole("REQUESTER");
    setIsActive(true);
    setPanel({ mode: "create" });
  }

  function openEdit(user: ManagedUser) {
    resetForm();
    setName(user.name);
    setEmail(user.email);
    setRole(user.role);
    setIsActive(user.isActive);
    setPanel({ mode: "edit", user });
  }

  /**
   * Field-level messages go under their field; rule refusals such as the
   * last-administrator rule are about the operation rather than one field, so
   * they become a panel-level alert (ui-spec.md section 7).
   */
  function handleFailure(err: unknown) {
    if (err instanceof ApiError && err.details) {
      setFieldErrors(err.details);
      setPanelError(null);
    } else if (err instanceof ApiError) {
      setPanelError(err.message);
      setFieldErrors({});
    } else {
      setPanelError("Something went wrong. Please try again.");
    }
  }

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setFieldErrors({});
    setPanelError(null);
    try {
      const created = await createUser({ name, email, role, isActive, initialPassword });
      setSuccess(`${created.name} was created and must change the password at first login.`);
      setPanel({ mode: "none" });
      load();
    } catch (err) {
      handleFailure(err);
    } finally {
      setBusy(false);
    }
  }

  async function handleSave(event: React.FormEvent) {
    event.preventDefault();
    if (panel.mode !== "edit") return;
    setBusy(true);
    setFieldErrors({});
    setPanelError(null);
    try {
      const saved = await updateUser(panel.user.id, { name, email, role, isActive });
      setSuccess(`${saved.name} was updated.`);
      setPanel({ mode: "none" });
      load();
    } catch (err) {
      handleFailure(err);
    } finally {
      setBusy(false);
    }
  }

  async function handleSetInitialPassword() {
    if (panel.mode !== "edit") return;
    setBusy(true);
    setFieldErrors({});
    setPanelError(null);
    try {
      await setInitialPassword(panel.user.id, newPassword);
      setSuccess(`${panel.user.name} must set a new password at the next login.`);
      setNewPassword("");
      load();
    } catch (err) {
      handleFailure(err);
    } finally {
      setBusy(false);
    }
  }

  async function handleToggleActive() {
    if (panel.mode !== "edit") return;
    setBusy(true);
    setPanelError(null);
    try {
      const saved = await updateUser(panel.user.id, { isActive: !panel.user.isActive });
      setSuccess(`${saved.name} is now ${saved.isActive ? "active" : "inactive"}.`);
      setPanel({ mode: "none" });
      load();
    } catch (err) {
      handleFailure(err);
    } finally {
      setBusy(false);
    }
  }

  const isOwnAccount = panel.mode === "edit" && panel.user.id === currentUser?.id;

  return (
    <div>
      <div className="zen-list-header">
        <h1>Users</h1>
        <div className="zen-list-header-actions">
          <button type="button" className="zen-btn zen-btn-primary" onClick={openCreate}>
            + Create User
          </button>
        </div>
      </div>

      {success && (
        <div className="zen-banner zen-banner-success" role="status">
          <span aria-hidden="true">✅</span>
          <span>{success}</span>
        </div>
      )}

      <div className="zen-form-grid">
        <div>
          <div className="zen-filters">
            <div className="zen-field">
              <label className="zen-field-label" htmlFor="user-search">
                Search users
              </label>
              <input
                id="user-search"
                className="zen-input"
                type="search"
                placeholder="Name or email…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="zen-field">
              <label className="zen-field-label" htmlFor="user-role-filter">
                Role
              </label>
              <select
                id="user-role-filter"
                className="zen-select"
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
              >
                <option value="">All roles</option>
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABEL[r]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {state === "loading" && <LoadingPanel label="Loading users…" />}

          {state === "error" && (
            <StatePanel
              icon="⚠️"
              title="Unable to load users"
              description={loadError ?? undefined}
              alert
              action={
                <button type="button" className="zen-btn zen-btn-primary" onClick={load}>
                  Retry
                </button>
              }
            />
          )}

          {state === "ready" && users.length === 0 && (
            <StatePanel icon="🔍" title="No users match this search" />
          )}

          {state === "ready" && users.length > 0 && (
            <div className="zen-table-wrap">
              <table className="zen-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Status</th>
                    <th>
                      <span className="zen-visually-hidden">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id}>
                      <td>{u.name}</td>
                      <td>{u.email}</td>
                      <td>
                        <Badge variant="status">{ROLE_LABEL[u.role]}</Badge>
                      </td>
                      <td>
                        {/* A deactivated account is visible without reading the
                            text, using the Lab 2 removed styling. */}
                        <Badge variant={u.isActive ? "active" : "removed"}>
                          {u.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </td>
                      <td>
                        <button
                          type="button"
                          className="zen-btn zen-btn-tertiary"
                          onClick={() => openEdit(u)}
                        >
                          Edit
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {panel.mode !== "none" && (
          <aside className="zen-card">
            <div className="zen-list-header">
              <h2 style={{ fontSize: 16, margin: 0 }}>
                {panel.mode === "create" ? "Create New User" : `Edit ${panel.user.name}`}
              </h2>
              <button
                type="button"
                className="zen-btn zen-btn-tertiary"
                onClick={() => setPanel({ mode: "none" })}
              >
                ✕
              </button>
            </div>

            {panelError && (
              <div className="zen-banner zen-banner-error" role="alert">
                <span aria-hidden="true">⚠️</span>
                <span>{panelError}</span>
              </div>
            )}

            <form onSubmit={panel.mode === "create" ? handleCreate : handleSave}>
              <div className={`zen-field ${fieldErrors.name ? "zen-field--error" : ""}`}>
                <label className="zen-field-label" htmlFor="user-name">
                  Full Name
                </label>
                <input
                  id="user-name"
                  className="zen-input"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
                {fieldErrors.name && <div className="zen-field-error">{fieldErrors.name}</div>}
              </div>

              <div className={`zen-field ${fieldErrors.email ? "zen-field--error" : ""}`}>
                <label className="zen-field-label" htmlFor="user-email">
                  Email Address
                </label>
                <input
                  id="user-email"
                  className="zen-input"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
                {fieldErrors.email && <div className="zen-field-error">{fieldErrors.email}</div>}
              </div>

              <div className={`zen-field ${fieldErrors.role ? "zen-field--error" : ""}`}>
                <label className="zen-field-label" htmlFor="user-role">
                  Role
                </label>
                {/* BR-11: one role, so a single select rather than checkboxes. */}
                <select
                  id="user-role"
                  className="zen-select"
                  value={role}
                  disabled={isOwnAccount}
                  onChange={(e) => setRole(e.target.value as Role)}
                >
                  {ROLES.map((r) => (
                    <option key={r} value={r}>
                      {ROLE_LABEL[r]}
                    </option>
                  ))}
                </select>
                {isOwnAccount && (
                  <div className="zen-field-hint">You cannot change your own role.</div>
                )}
                {fieldErrors.role && <div className="zen-field-error">{fieldErrors.role}</div>}
              </div>

              <div className="zen-field">
                <label className="zen-field-label" htmlFor="user-active">
                  Active
                </label>
                <select
                  id="user-active"
                  className="zen-select"
                  value={isActive ? "yes" : "no"}
                  disabled={isOwnAccount}
                  onChange={(e) => setIsActive(e.target.value === "yes")}
                >
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </select>
              </div>

              {panel.mode === "create" && (
                <div
                  className={`zen-field ${fieldErrors.initialPassword ? "zen-field--error" : ""}`}
                >
                  <label className="zen-field-label" htmlFor="user-initial-password">
                    Initial Password
                  </label>
                  <input
                    id="user-initial-password"
                    className="zen-input"
                    type="password"
                    value={initialPassword}
                    onChange={(e) => setInitialPasswordValue(e.target.value)}
                  />
                  <PasswordChecklist value={initialPassword} />
                  <div className="zen-field-hint">
                    The user will be asked to change this at their first login.
                  </div>
                  {fieldErrors.initialPassword && (
                    <div className="zen-field-error">{fieldErrors.initialPassword}</div>
                  )}
                </div>
              )}

              <div className="zen-form-actions">
                <button
                  type="submit"
                  className="zen-btn zen-btn-primary"
                  disabled={
                    busy ||
                    (panel.mode === "create" && !passwordMeetsAllRules(initialPassword))
                  }
                >
                  {busy ? "Saving…" : "Save User"}
                </button>
              </div>
            </form>

            {panel.mode === "edit" && (
              <>
                {/* Its own field and its own button, kept away from Save so the
                    two operations cannot be confused (ui-spec.md section 7). */}
                <hr />
                <div
                  className={`zen-field ${fieldErrors.initialPassword ? "zen-field--error" : ""}`}
                >
                  <label className="zen-field-label" htmlFor="user-new-initial-password">
                    Set a new initial password
                  </label>
                  <input
                    id="user-new-initial-password"
                    className="zen-input"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                  />
                  <PasswordChecklist value={newPassword} />
                  {fieldErrors.initialPassword && (
                    <div className="zen-field-error">{fieldErrors.initialPassword}</div>
                  )}
                  <button
                    type="button"
                    className="zen-btn zen-btn-secondary"
                    disabled={busy || !passwordMeetsAllRules(newPassword)}
                    onClick={handleSetInitialPassword}
                  >
                    Set initial password
                  </button>
                </div>

                <hr />
                <button
                  type="button"
                  className={`zen-btn ${panel.user.isActive ? "zen-btn-destructive" : "zen-btn-secondary"}`}
                  disabled={busy || isOwnAccount}
                  title={isOwnAccount ? "You cannot deactivate your own account" : undefined}
                  onClick={handleToggleActive}
                >
                  {panel.user.isActive ? "Deactivate User" : "Activate User"}
                </button>
                {isOwnAccount && (
                  <div className="zen-field-hint">You cannot deactivate your own account.</div>
                )}
              </>
            )}
          </aside>
        )}
      </div>
    </div>
  );
}
