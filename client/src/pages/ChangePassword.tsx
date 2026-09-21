import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ApiError, changePassword } from "../api";
import { useAuth } from "../context/AuthContext";
import { PASSWORD_RULES, passwordMeetsAllRules } from "../utils/passwordRules";

// ui-spec.md section 3. Shown automatically when the account holds an initial
// password (FR-04), and reachable from the header menu at any other time.
export function ChangePassword() {
  const { user, setUser, signOut } = useAuth();
  const navigate = useNavigate();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [currentError, setCurrentError] = useState<string | null>(null);
  const [newError, setNewError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const mandatory = user?.mustChangePassword ?? false;
  const rulesPass = passwordMeetsAllRules(newPassword);
  const matches = newPassword.length > 0 && newPassword === confirmPassword;
  const canSubmit = currentPassword.length > 0 && rulesPass && matches && !busy;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!canSubmit) return;

    setCurrentError(null);
    setNewError(null);
    setBusy(true);

    try {
      const updated = await changePassword(currentPassword, newPassword);
      setUser(updated);
      navigate("/", { replace: true });
    } catch (err) {
      if (err instanceof ApiError && err.details) {
        // Each message is placed under the field it is about, rather than as a
        // page-level banner, because the field is what has to be corrected.
        setCurrentError(err.details.currentPassword ?? null);
        setNewError(err.details.newPassword ?? null);
      } else {
        setNewError(
          err instanceof ApiError ? err.message : "Unable to change the password right now"
        );
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="zen-page">
      <div className="zen-container" style={{ maxWidth: 460 }}>
        <div className="zen-card">
          <h1>Change Your Password</h1>
          {mandatory && (
            <p style={{ color: "var(--zen-text-muted)" }}>
              You must change your password to continue.
            </p>
          )}

          <form onSubmit={handleSubmit} noValidate>
            <div className={`zen-field ${currentError ? "zen-field--error" : ""}`}>
              <label className="zen-field-label" htmlFor="current-password">
                {mandatory ? "Current (temporary) password" : "Current password"}
              </label>
              <input
                id="current-password"
                className="zen-input"
                type="password"
                autoComplete="current-password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
              />
              {currentError && <div className="zen-field-error">{currentError}</div>}
            </div>

            <div className={`zen-field ${newError ? "zen-field--error" : ""}`}>
              <label className="zen-field-label" htmlFor="new-password">
                New password
              </label>
              <input
                id="new-password"
                className="zen-input"
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
              {newError && <div className="zen-field-error">{newError}</div>}

              <div className="zen-field-hint" style={{ marginTop: "var(--zen-space-2)" }}>
                <strong>Password must:</strong>
                <ul style={{ listStyle: "none", padding: 0, margin: "4px 0 0" }}>
                  {PASSWORD_RULES.map((rule) => {
                    const satisfied = rule.test(newPassword);
                    return (
                      <li
                        key={rule.id}
                        data-satisfied={satisfied}
                        style={{
                          color: satisfied ? "var(--zen-green-700)" : "var(--zen-text-muted)",
                        }}
                      >
                        <span aria-hidden="true">{satisfied ? "✓" : "○"}</span> {rule.label}
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>

            <div
              className={`zen-field ${confirmPassword.length > 0 && !matches ? "zen-field--error" : ""}`}
            >
              <label className="zen-field-label" htmlFor="confirm-password">
                Confirm new password
              </label>
              <input
                id="confirm-password"
                className="zen-input"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
              {confirmPassword.length > 0 && !matches && (
                <div className="zen-field-error">The two passwords do not match</div>
              )}
            </div>

            <button
              type="submit"
              className="zen-btn zen-btn-primary"
              style={{ width: "100%", justifyContent: "center" }}
              disabled={!canSubmit}
            >
              {busy ? "Saving…" : "Continue"}
            </button>
          </form>

          {mandatory && (
            // With the change pending there is no navigation at all, so signing
            // out has to be reachable from here or the user would be stuck.
            <button
              type="button"
              className="zen-btn zen-btn-tertiary"
              style={{ width: "100%", justifyContent: "center", marginTop: "var(--zen-space-2)" }}
              onClick={async () => {
                await signOut();
                navigate("/login", { replace: true });
              }}
            >
              Sign out instead
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
