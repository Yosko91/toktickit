import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useRequester } from "../context/RequesterContext";
import { LoadingPanel, StatePanel } from "../components/StatePanel";

// ui-spec.md section 8 - Development Requester Selection screen (handout
// section 8.1). BR-05/BR-06: explicitly not a login screen; only active
// Requesters are selectable.
export function RequesterSelection() {
  const { status, error, requesters, requester, selectRequester, retry } = useRequester();
  const [pendingId, setPendingId] = useState<string>(requester ? String(requester.id) : "");
  const navigate = useNavigate();

  function handleContinue() {
    const id = Number(pendingId);
    if (!Number.isInteger(id)) return;
    selectRequester(id);
    navigate("/tickets");
  }

  return (
    <div className="zen-page">
      <div className="zen-container" style={{ maxWidth: 480 }}>
        <div className="zen-card">
          <div style={{ textAlign: "center", marginBottom: "var(--zen-space-4)" }}>
            <div style={{ fontSize: 40 }} aria-hidden="true">
              🕐
            </div>
            <h1>Select Development Requester</h1>
            <p style={{ color: "var(--zen-text-muted)" }}>
              Select a Development Requester to test requester-specific ticket behavior. This is
              not a login screen. Authentication and role-based access will be introduced in Lab
              3.
            </p>
          </div>

          {status === "loading" && <LoadingPanel label="Loading development requesters…" />}

          {status === "error" && (
            <StatePanel
              icon="⚠️"
              title="Unable to load development requesters"
              description={error ?? "Something went wrong. Please try again."}
              alert
              action={
                <button type="button" className="zen-btn zen-btn-primary" onClick={retry}>
                  Retry
                </button>
              }
            />
          )}

          {status === "ready" && requesters.length === 0 && (
            <StatePanel
              icon="🚫"
              title="No active development requesters are available"
              description="Contact an administrator to seed at least one active development requester."
              action={
                <button type="button" className="zen-btn zen-btn-secondary" onClick={retry}>
                  Retry
                </button>
              }
            />
          )}

          {status === "ready" && requesters.length > 0 && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleContinue();
              }}
            >
              <div className="zen-field">
                <label className="zen-field-label" htmlFor="dev-requester-select">
                  Development Requester
                  <span className="zen-required-asterisk" aria-hidden="true">
                    *
                  </span>
                </label>
                <select
                  id="dev-requester-select"
                  className="zen-select"
                  value={pendingId}
                  onChange={(e) => setPendingId(e.target.value)}
                >
                  <option value="" disabled>
                    Choose a development requester…
                  </option>
                  {requesters.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="zen-banner zen-banner-info">
                <span aria-hidden="true">ℹ️</span>
                <span>Only active development requesters are shown.</span>
              </div>

              <div className="zen-banner zen-banner-info">
                <span aria-hidden="true">🛡️</span>
                <span>
                  <strong>Authentication coming in Lab 3.</strong> In Lab 3, this selection will
                  be replaced with secure authentication so you can access the system with your
                  own account.
                </span>
              </div>

              <div className="zen-form-actions">
                <button
                  type="button"
                  className="zen-btn zen-btn-secondary"
                  onClick={() => setPendingId("")}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="zen-btn zen-btn-primary"
                  disabled={!pendingId}
                >
                  → Continue
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
