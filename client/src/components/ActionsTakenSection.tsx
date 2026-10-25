import { useState } from "react";
import { ApiError, createAction, updateAction } from "../api";
import type { ActionInput, ActionStatus, ActionTaken, AssignableUser, TicketStatus } from "../api";
import { ActionStatusBadge } from "./Badge";
import { FieldWrapper } from "./Field";
import {
  ACTION_STATUS_LABEL,
  isActionFinal,
  isTicketWorkable,
  statusChoicesFor,
} from "../utils/actionRules";

// docs/lab-04/ui-spec.md sections 6 and 7. One component for both Ticket
// Detail screens: "staff" has the list, the create mode and the edit mode,
// "readonly" (the Requester) has the list and no control at all (FR-05).

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** The value a datetime-local input expects, in the browser's time zone. */
function toLocalInput(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}`
  );
}

function newRequestId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

interface FormValues {
  actionAt: string;
  status: ActionStatus;
  performedById: string;
  description: string;
  result: string;
  followUpRequired: boolean;
  followUpNote: string;
  attachmentNotes: string;
}

function initialValues(action: ActionTaken | null, currentUserId: number): FormValues {
  return {
    actionAt: toLocalInput(action ? new Date(action.actionAt) : new Date()),
    status: action?.status ?? "COMPLETED",
    performedById: String(action?.performedById ?? currentUserId),
    description: action?.description ?? "",
    result: action?.result ?? "",
    followUpRequired: action?.followUpRequired ?? false,
    followUpNote: action?.followUpNote ?? "",
    attachmentNotes: action?.attachmentNotes ?? "",
  };
}

function toInput(values: FormValues): ActionInput {
  return {
    // An empty date is sent as is: the server answers with the field error.
    actionAt: values.actionAt ? new Date(values.actionAt).toISOString() : "",
    status: values.status,
    performedById: Number(values.performedById),
    description: values.description,
    result: values.result.trim() === "" ? null : values.result,
    followUpRequired: values.followUpRequired,
    followUpNote: values.followUpRequired ? values.followUpNote : null,
    attachmentNotes: values.attachmentNotes.trim() === "" ? null : values.attachmentNotes,
  };
}

function ActionForm({
  ticketId,
  action,
  currentUserId,
  staffUsers,
  onCancel,
  onSaved,
  onReload,
}: {
  ticketId: number;
  action: ActionTaken | null;
  currentUserId: number;
  staffUsers: AssignableUser[];
  onCancel: () => void;
  onSaved: () => void;
  onReload: () => void;
}) {
  const [values, setValues] = useState<FormValues>(() => initialValues(action, currentUserId));
  // BR-14: one id per form. A retry after a network failure sends the same
  // id again, so the server cannot save the action twice.
  const [clientRequestId] = useState(newRequestId);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [banner, setBanner] = useState<string | null>(null);
  const [stale, setStale] = useState(false);
  const [busy, setBusy] = useState(false);

  const isEdit = action !== null;
  const statusChoices: ActionStatus[] = isEdit
    ? statusChoicesFor(action.status)
    : ["COMPLETED", "PLANNED", "IN_PROGRESS"];

  // A performer who has been deactivated since stays visible in the list.
  const performers =
    isEdit && !staffUsers.some((u) => u.id === action.performedById)
      ? [...staffUsers, { id: action.performedById, name: action.performedByName, role: "IT_STAFF" as const }]
      : staffUsers;

  const set = <K extends keyof FormValues>(key: K, value: FormValues[K]) =>
    setValues((v) => ({ ...v, [key]: value }));
  const idFor = (field: string) => `action-${isEdit ? action.id : "new"}-${field}`;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setErrors({});
    setBanner(null);
    try {
      if (isEdit) {
        await updateAction(ticketId, action.id, { ...toInput(values), version: action.version });
      } else {
        await createAction(ticketId, { ...toInput(values), clientRequestId });
      }
      onSaved();
    } catch (err) {
      // AC-24: whatever happens, the typed values stay in the form.
      if (err instanceof ApiError && err.code === "STALE_UPDATE") {
        setStale(true);
      } else if (err instanceof ApiError && err.details) {
        setErrors(err.details);
      } else {
        setBanner(err instanceof ApiError ? err.message : "Unable to save the action");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="zen-action-form" onSubmit={handleSubmit} aria-label={isEdit ? "Edit action" : "New action"}>
      <h3 className="zen-action-form-title">{isEdit ? "Edit action" : "New action"}</h3>

      {stale && (
        <div className="zen-banner zen-banner-warning" role="alert">
          <span aria-hidden="true">⚠️</span>
          <span>
            This action was changed by someone else. Reload to see the latest version.{" "}
            <button type="button" className="zen-btn zen-btn-secondary" onClick={onReload}>
              Reload
            </button>
          </span>
        </div>
      )}
      {banner && (
        <div className="zen-banner zen-banner-error" role="alert">
          {banner}
        </div>
      )}

      <div className="zen-action-form-grid">
        <FieldWrapper label="Action Date/Time" htmlFor={idFor("at")} required error={errors.actionAt}>
          <input
            id={idFor("at")}
            type="datetime-local"
            className="zen-input"
            value={values.actionAt}
            onChange={(e) => set("actionAt", e.target.value)}
          />
        </FieldWrapper>

        <FieldWrapper label="Status" htmlFor={idFor("status")} error={errors.status}>
          <select
            id={idFor("status")}
            className="zen-select"
            value={values.status}
            onChange={(e) => set("status", e.target.value as ActionStatus)}
          >
            {statusChoices.map((s) => (
              <option key={s} value={s}>
                {ACTION_STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </FieldWrapper>

        <FieldWrapper label="Performed by" htmlFor={idFor("performer")} error={errors.performedById}>
          <select
            id={idFor("performer")}
            className="zen-select"
            value={values.performedById}
            onChange={(e) => set("performedById", e.target.value)}
          >
            {performers.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
                {u.id === currentUserId ? " (me)" : ""}
              </option>
            ))}
          </select>
        </FieldWrapper>
      </div>

      <FieldWrapper label="Action Description" htmlFor={idFor("description")} required error={errors.description}>
        <textarea
          id={idFor("description")}
          className="zen-textarea zen-textarea--short"
          rows={3}
          maxLength={2000}
          aria-required="true"
          value={values.description}
          onChange={(e) => set("description", e.target.value)}
        />
      </FieldWrapper>

      <FieldWrapper
        label="Result"
        htmlFor={idFor("result")}
        required={values.status === "COMPLETED"}
        error={errors.result}
        hint="Required when the action is completed."
      >
        <textarea
          id={idFor("result")}
          className="zen-textarea zen-textarea--short"
          rows={2}
          maxLength={2000}
          value={values.result}
          onChange={(e) => set("result", e.target.value)}
        />
      </FieldWrapper>

      <div className="zen-field">
        <label className="zen-checkbox-row" htmlFor={idFor("followup")}>
          <input
            id={idFor("followup")}
            type="checkbox"
            checked={values.followUpRequired}
            onChange={(e) => set("followUpRequired", e.target.checked)}
          />
          Follow-Up Required
        </label>
      </div>

      {values.followUpRequired && (
        <FieldWrapper label="Follow-up Note" htmlFor={idFor("note")} required error={errors.followUpNote}>
          <textarea
            id={idFor("note")}
            className="zen-textarea zen-textarea--short"
            rows={2}
            maxLength={1000}
            value={values.followUpNote}
            onChange={(e) => set("followUpNote", e.target.value)}
          />
        </FieldWrapper>
      )}

      <FieldWrapper
        label="Attachment Notes"
        htmlFor={idFor("attachment")}
        error={errors.attachmentNotes}
        hint="Which file to look at, for example screenshot-error.png"
      >
        <input
          id={idFor("attachment")}
          className="zen-input"
          maxLength={500}
          value={values.attachmentNotes}
          onChange={(e) => set("attachmentNotes", e.target.value)}
        />
      </FieldWrapper>

      <div className="zen-form-actions">
        <button type="button" className="zen-btn zen-btn-tertiary" onClick={onCancel} disabled={busy}>
          Cancel
        </button>
        <button type="submit" className="zen-btn zen-btn-primary" disabled={busy}>
          {busy ? "Saving..." : "Save Action"}
        </button>
      </div>
    </form>
  );
}

export function ActionsTakenSection({
  ticketId,
  ticketStatus,
  actions,
  mode,
  currentUserId,
  staffUsers = [],
  onChanged,
}: {
  ticketId: number;
  ticketStatus: TicketStatus;
  actions: ActionTaken[];
  mode: "staff" | "readonly";
  currentUserId?: number;
  staffUsers?: AssignableUser[];
  onChanged?: () => void;
}) {
  const [editing, setEditing] = useState<ActionTaken | "new" | null>(null);
  const [saved, setSaved] = useState(false);

  const canWork = mode === "staff" && currentUserId !== undefined && isTicketWorkable(ticketStatus);
  const title = mode === "staff" ? "Actions Taken" : "Work done by IT";

  function handleSaved() {
    setEditing(null);
    setSaved(true);
    setTimeout(() => setSaved(false), 4000);
    onChanged?.();
  }

  function handleReload() {
    setEditing(null);
    onChanged?.();
  }

  return (
    <section className="zen-card" aria-labelledby="actions-taken-title">
      <div className="zen-card-header">
        <h2 id="actions-taken-title" className="zen-card-title">
          {title} ({actions.length})
        </h2>
        {saved && (
          <span className="zen-field-hint" role="status">
            Action saved
          </span>
        )}
        {canWork && editing === null && (
          <button type="button" className="zen-btn zen-btn-primary" onClick={() => setEditing("new")}>
            + Add Action
          </button>
        )}
      </div>

      {mode === "staff" && !isTicketWorkable(ticketStatus) && (
        <p className="zen-field-hint">Reopen the ticket to record more work.</p>
      )}

      {canWork && editing !== null && (
        <ActionForm
          // A new key per action resets the form when another row is opened.
          key={editing === "new" ? "new" : editing.id}
          ticketId={ticketId}
          action={editing === "new" ? null : editing}
          currentUserId={currentUserId!}
          staffUsers={staffUsers}
          onCancel={() => setEditing(null)}
          onSaved={handleSaved}
          onReload={handleReload}
        />
      )}

      {actions.length === 0 ? (
        <p className="zen-muted">No actions recorded yet.</p>
      ) : (
        <ol className="zen-actions-list">
          {actions.map((action) => (
            <li key={action.id} className="zen-action-row">
              <div className="zen-action-body">
                <div className="zen-action-head">
                  <ActionStatusBadge status={action.status} />
                  <time dateTime={action.actionAt}>{formatWhen(action.actionAt)}</time>
                </div>
                {/* Text only, React escapes it (BR-05). */}
                <p className="zen-action-description">{action.description}</p>
                {action.result && <p className="zen-action-result">Result: {action.result}</p>}
                <p className="zen-action-meta">
                  Performed by {action.performedByName}
                  {action.createdById !== action.performedById && <> · recorded by {action.createdByName}</>}
                </p>
                {action.followUpRequired && (
                  <p className="zen-action-followup">
                    <span aria-hidden="true">⚑ </span>Follow-up needed: {action.followUpNote}
                  </p>
                )}
                {action.attachmentNotes && (
                  <p className="zen-action-attachment">
                    <span aria-hidden="true">📎 </span>Attachment notes: {action.attachmentNotes}
                  </p>
                )}
              </div>
              {canWork && !isActionFinal(action.status) && editing === null && (
                <button
                  type="button"
                  className="zen-btn zen-btn-secondary"
                  aria-label={`Edit action: ${action.description}`}
                  onClick={() => setEditing(action)}
                >
                  Edit
                </button>
              )}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
