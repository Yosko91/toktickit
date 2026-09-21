import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ApiError } from "../api";
import { useAuth } from "../context/AuthContext";

// ui-spec.md section 2. BR-05: every credential failure shows one identical
// message, so this screen cannot be used to find out which email addresses
// have an account.
export function Login() {
  const { signIn } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setEmailError("Enter a valid email address");
      return;
    }
    setEmailError(null);
    setFormError(null);
    setBusy(true);

    try {
      const user = await signIn(email.trim(), password);
      // BR-02: an account holding an initial password goes straight to the
      // change screen and nowhere else.
      navigate(user.mustChangePassword ? "/change-password" : "/", { replace: true });
    } catch (err) {
      // A server that cannot be reached is reported differently from a refused
      // credential, because the user can act on it.
      setFormError(
        err instanceof ApiError && err.status === 0
          ? "Unable to reach the TokTickIT server"
          : "Invalid email or password"
      );
      setPassword("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="zen-page">
      <div className="zen-container" style={{ maxWidth: 420 }}>
        <div className="zen-card">
          <div style={{ textAlign: "center", marginBottom: "var(--zen-space-4)" }}>
            <div style={{ fontSize: 40 }} aria-hidden="true">
              🕐
            </div>
            <h1>Sign in to your account</h1>
          </div>

          {formError && (
            <div className="zen-banner zen-banner-error" role="alert">
              <span aria-hidden="true">⚠️</span>
              <span>{formError}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate>
            <div className={`zen-field ${emailError ? "zen-field--error" : ""}`}>
              <label className="zen-field-label" htmlFor="login-email">
                Email address
              </label>
              <input
                id="login-email"
                className="zen-input"
                type="email"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              {emailError && <div className="zen-field-error">{emailError}</div>}
            </div>

            <div className="zen-field">
              <label className="zen-field-label" htmlFor="login-password">
                Password
              </label>
              <input
                id="login-password"
                className="zen-input"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            <button
              type="submit"
              className="zen-btn zen-btn-primary"
              style={{ width: "100%", justifyContent: "center" }}
              disabled={busy}
            >
              {busy ? "Signing in…" : "Sign In"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
