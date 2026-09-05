import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useRequester } from "../context/RequesterContext";
import {
  ApiError,
  createTicket,
  getCategories,
  getRelatedSystems,
  uploadAttachment,
} from "../api";
import type { Category, RelatedSystem, RequestedPriority, TicketDetail } from "../api";
import { FieldWrapper, ReadOnlyField } from "../components/Field";
import { LoadingPanel, StatePanel } from "../components/StatePanel";
import { StagedAttachmentPicker } from "../components/StagedAttachmentPicker";
import type { StagedFile } from "../components/StagedAttachmentPicker";
import { MAX_ACTIVE_ATTACHMENTS, validateAttachmentFile } from "../utils/attachmentRules";

interface UploadResult {
  name: string;
  ok: boolean;
  message?: string;
}

// ui-spec.md section 9 - Create Ticket screen (create mode).
export function CreateTicket() {
  const { requester } = useRequester();
  const navigate = useNavigate();

  const [refState, setRefState] = useState<"loading" | "ready" | "error">("loading");
  const [refError, setRefError] = useState<string | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [relatedSystems, setRelatedSystems] = useState<RelatedSystem[]>([]);

  const [categoryId, setCategoryId] = useState("");
  const [relatedSystemId, setRelatedSystemId] = useState("");
  const [summary, setSummary] = useState("");
  const [description, setDescription] = useState("");
  const [requestedPriority, setRequestedPriority] = useState<RequestedPriority>("MEDIUM");
  const [files, setFiles] = useState<StagedFile[]>([]);

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [created, setCreated] = useState<TicketDetail | null>(null);
  const [uploadResults, setUploadResults] = useState<UploadResult[]>([]);

  useEffect(() => {
    let cancelled = false;
    setRefState("loading");
    Promise.all([getCategories(), getRelatedSystems()])
      .then(([cats, systems]) => {
        if (cancelled) return;
        setCategories(cats);
        setRelatedSystems(systems);
        setRefState("ready");
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setRefError(err instanceof ApiError ? err.message : "Unable to load form reference data");
        setRefState("error");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function handleAddFiles(fileList: FileList) {
    setFiles((prev) => {
      let validCount = prev.filter((f) => !f.error).length;
      const next = [...prev];
      for (const file of Array.from(fileList)) {
        if (validCount >= MAX_ACTIVE_ATTACHMENTS) {
          next.push({ file, error: `Maximum of ${MAX_ACTIVE_ATTACHMENTS} attachments reached` });
          continue;
        }
        const error = validateAttachmentFile(file);
        next.push({ file, error });
        if (!error) validCount += 1;
      }
      return next;
    });
  }

  function handleRemoveFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }

  function isDirty(): boolean {
    return Boolean(
      categoryId || relatedSystemId || summary.trim() || description.trim() || files.length > 0
    );
  }

  function handleCancel() {
    if (isDirty() && !window.confirm("Discard this ticket? Your entered values will be lost.")) {
      return;
    }
    navigate("/tickets");
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (submitting) return; // BR-19/AC-07: ignore a second submit while one is in flight

    const errors: Record<string, string> = {};
    if (!categoryId) errors.categoryId = "Category is required";
    if (!relatedSystemId) errors.relatedSystemId = "Related System is required";

    const trimmedSummary = summary.trim();
    if (trimmedSummary.length < 5 || trimmedSummary.length > 120) {
      errors.summary = "Summary must be 5-120 characters";
    }
    const trimmedDescription = description.trim();
    if (trimmedDescription.length < 20 || trimmedDescription.length > 2000) {
      errors.description = "Description must be 20-2000 characters";
    }

    setFieldErrors(errors);
    setGeneralError(null);

    // AC-04/AC-05: invalid input never reaches the API.
    if (Object.keys(errors).length > 0) return;

    setSubmitting(true);
    try {
      const ticket = await createTicket(requester!.id, {
        categoryId: Number(categoryId),
        relatedSystemId: Number(relatedSystemId),
        summary: trimmedSummary,
        description: trimmedDescription,
        requestedPriority,
      });

      // BR-25: the Ticket is never rolled back for an attachment failure.
      const validFiles = files.filter((f) => !f.error).map((f) => f.file);
      const results: UploadResult[] = [];
      for (const file of validFiles) {
        try {
          await uploadAttachment(requester!.id, ticket.id, file);
          results.push({ name: file.name, ok: true });
        } catch (err) {
          results.push({
            name: file.name,
            ok: false,
            message: err instanceof ApiError ? err.message : "Upload failed",
          });
        }
      }

      setUploadResults(results);
      setCreated(ticket);
    } catch (err) {
      if (err instanceof ApiError && (err.status === 400 || err.status === 422) && err.details) {
        setFieldErrors(err.details); // BR-20: form values are untouched above
      } else if (err instanceof ApiError) {
        setGeneralError(err.message);
      } else {
        setGeneralError("Unexpected error. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (created) {
    const failed = uploadResults.filter((r) => !r.ok);
    return (
      <div className="zen-card zen-confirmation">
        <div style={{ fontSize: 40 }} aria-hidden="true">
          ✅
        </div>
        <h1>Ticket submitted</h1>
        <p>Your ticket has been saved. Reference this number in any follow-up.</p>
        <div className="zen-confirmation-number">{created.ticketNumber}</div>

        {failed.length > 0 && (
          <div className="zen-banner zen-banner-warning" style={{ textAlign: "left" }}>
            <span aria-hidden="true">⚠️</span>
            <div>
              <strong>Some attachments failed to upload:</strong>
              <ul>
                {failed.map((f) => (
                  <li key={f.name}>
                    {f.name} — {f.message}
                  </li>
                ))}
              </ul>
              You can retry adding them from the Ticket Detail screen.
            </div>
          </div>
        )}

        <div className="zen-confirmation-actions">
          <button
            type="button"
            className="zen-btn zen-btn-primary"
            onClick={() => navigate(`/tickets/${created.id}`)}
          >
            View Ticket
          </button>
          <button type="button" className="zen-btn zen-btn-secondary" onClick={() => navigate("/tickets")}>
            Back to My Tickets
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="zen-breadcrumb">
        <Link to="/tickets">My Tickets</Link> <span aria-hidden="true">›</span> <span>Create Ticket</span>
      </div>
      <h1>Create Ticket</h1>

      <div className="zen-card">
        {generalError && (
          <div className="zen-banner zen-banner-error" role="alert">
            <span aria-hidden="true">⚠️</span>
            <span>{generalError}</span>
          </div>
        )}

        <ReadOnlyField
          label="Requester"
          value={requester?.name}
          hint="Populated from the Development Requester selected before entering the application."
          className="zen-field--full"
        />

        {refState === "loading" && <LoadingPanel label="Loading form reference data…" />}

        {refState === "error" && (
          <StatePanel
            icon="⚠️"
            title="Unable to load form reference data"
            description={refError ?? undefined}
            alert
            action={
              <button type="button" className="zen-btn zen-btn-primary" onClick={() => window.location.reload()}>
                Retry
              </button>
            }
          />
        )}

        {refState === "ready" && (
          <form onSubmit={handleSubmit} noValidate>
            <div className="zen-form-grid zen-form-grid--3">
              <FieldWrapper label="Category" htmlFor="categoryId" required error={fieldErrors.categoryId}>
                <select
                  id="categoryId"
                  className="zen-select"
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  disabled={submitting}
                >
                  <option value="">Select a category…</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </FieldWrapper>

              <FieldWrapper
                label="Related System"
                htmlFor="relatedSystemId"
                required
                error={fieldErrors.relatedSystemId}
              >
                <select
                  id="relatedSystemId"
                  className="zen-select"
                  value={relatedSystemId}
                  onChange={(e) => setRelatedSystemId(e.target.value)}
                  disabled={submitting}
                >
                  <option value="">Select a related system…</option>
                  {relatedSystems.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </FieldWrapper>

              <FieldWrapper
                label="Requested Priority"
                htmlFor="requestedPriority"
                required
                error={fieldErrors.requestedPriority}
              >
                <select
                  id="requestedPriority"
                  className="zen-select"
                  value={requestedPriority}
                  onChange={(e) => setRequestedPriority(e.target.value as RequestedPriority)}
                  disabled={submitting}
                >
                  <option value="LOW">Low</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HIGH">High</option>
                </select>
              </FieldWrapper>

              <FieldWrapper
                label="Ticket Summary"
                htmlFor="summary"
                required
                error={fieldErrors.summary}
                hint={`${summary.trim().length}/120 characters`}
                className="zen-field--full"
              >
                <input
                  id="summary"
                  className="zen-input"
                  value={summary}
                  maxLength={160}
                  onChange={(e) => setSummary(e.target.value)}
                  disabled={submitting}
                  placeholder="Short summary of the issue"
                />
              </FieldWrapper>

              <FieldWrapper
                label="Description"
                htmlFor="description"
                required
                error={fieldErrors.description}
                hint={`${description.trim().length}/2000 characters`}
                className="zen-field--full"
              >
                <textarea
                  id="description"
                  className="zen-textarea"
                  value={description}
                  maxLength={2200}
                  onChange={(e) => setDescription(e.target.value)}
                  disabled={submitting}
                  placeholder="Describe the problem in enough detail for IT to investigate"
                />
              </FieldWrapper>

              <div className="zen-field--full">
                <span className="zen-field-label">Attachments</span>
                <StagedAttachmentPicker
                  items={files}
                  onAdd={handleAddFiles}
                  onRemove={handleRemoveFile}
                  disabled={submitting}
                />
              </div>
            </div>

            <div className="zen-form-actions">
              <button type="button" className="zen-btn zen-btn-secondary" onClick={handleCancel} disabled={submitting}>
                Cancel
              </button>
              <button
                type="submit"
                className={`zen-btn zen-btn-primary ${submitting ? "is-busy" : ""}`}
                disabled={submitting}
              >
                Submit Ticket
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
