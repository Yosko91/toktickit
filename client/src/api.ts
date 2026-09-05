// TokTickIT REST client. See docs/lab-02/api-spec.md for the full contract.

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

export type RequestedPriority = "LOW" | "MEDIUM" | "HIGH";
export type TicketStatus =
  | "NEW"
  | "OPEN"
  | "IN_PROGRESS"
  | "PENDING"
  | "RESOLVED"
  | "CLOSED"
  | "CANCELLED";

export interface Category {
  id: number;
  name: string;
}

export interface RelatedSystem {
  id: number;
  name: string;
}

export interface Requester {
  id: number;
  name: string;
  email: string;
}

export interface AttachmentMeta {
  id: number;
  ticketId: number;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  uploadedAt: string;
  removedAt: string | null;
  removedReason: string | null;
}

export interface TicketListItem {
  id: number;
  ticketNumber: string;
  summary: string;
  categoryName: string;
  requestedPriority: RequestedPriority;
  currentStatus: TicketStatus;
  createdAt: string;
  updatedAt: string;
}

export interface TicketListResponse {
  data: TicketListItem[];
  pagination: { page: number; pageSize: number; totalItems: number; totalPages: number };
}

export interface TicketDetail {
  id: number;
  ticketNumber: string;
  requesterId: number;
  requesterName: string;
  categoryId: number;
  categoryName: string;
  relatedSystemId: number;
  relatedSystemName: string;
  summary: string;
  description: string;
  requestedPriority: RequestedPriority;
  currentStatus: TicketStatus;
  createdAt: string;
  updatedAt: string;
  attachments: AttachmentMeta[];
}

export interface CreateTicketInput {
  categoryId: number;
  relatedSystemId: number;
  summary: string;
  description: string;
  requestedPriority: RequestedPriority;
}

export interface TicketListParams {
  search?: string;
  categoryId?: number;
  requestedPriority?: RequestedPriority;
  currentStatus?: TicketStatus;
  sortBy?: "createdAt" | "ticketNumber" | "summary" | "requestedPriority";
  sortDir?: "asc" | "desc";
  page?: number;
  pageSize?: 10 | 20 | 50;
}

// Thrown for every non-2xx response and for network failures (status 0),
// so UI code can branch on `.status` and render field errors from
// `.details` (BR-18/BR-20).
export class ApiError extends Error {
  status: number;
  details?: Record<string, string>;

  constructor(status: number, message: string, details?: Record<string, string>) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
  }
}

async function request<T>(path: string, init: RequestInit = {}, requesterId?: number): Promise<T> {
  const headers = new Headers(init.headers);
  if (!(init.body instanceof FormData) && init.body !== undefined) {
    headers.set("Content-Type", "application/json");
  }
  if (requesterId !== undefined) {
    headers.set("X-Dev-Requester-Id", String(requesterId));
  }

  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, { ...init, headers });
  } catch {
    throw new ApiError(0, "Unable to reach the TokTickIT server");
  }

  const contentType = response.headers.get("content-type") ?? "";
  const body = contentType.includes("application/json")
    ? await response.json().catch(() => undefined)
    : undefined;

  if (!response.ok) {
    throw new ApiError(response.status, body?.error ?? "Request failed", body?.details);
  }

  return body as T;
}

export function getCategories(): Promise<Category[]> {
  return request<Category[]>("/api/categories");
}

export function getRelatedSystems(): Promise<RelatedSystem[]> {
  return request<RelatedSystem[]>("/api/related-systems");
}

export function getActiveRequesters(): Promise<Requester[]> {
  return request<Requester[]>("/api/requesters");
}

export function createTicket(requesterId: number, input: CreateTicketInput): Promise<TicketDetail> {
  return request<TicketDetail>(
    "/api/tickets",
    { method: "POST", body: JSON.stringify(input) },
    requesterId
  );
}

export function listTickets(
  requesterId: number,
  params: TicketListParams = {}
): Promise<TicketListResponse> {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") {
      query.set(key, String(value));
    }
  }
  const qs = query.toString();
  return request<TicketListResponse>(`/api/tickets${qs ? `?${qs}` : ""}`, {}, requesterId);
}

export function getTicket(requesterId: number, id: number): Promise<TicketDetail> {
  return request<TicketDetail>(`/api/tickets/${id}`, {}, requesterId);
}

export function uploadAttachment(
  requesterId: number,
  ticketId: number,
  file: File
): Promise<AttachmentMeta> {
  const formData = new FormData();
  formData.append("file", file);
  return request<AttachmentMeta>(
    `/api/tickets/${ticketId}/attachments`,
    { method: "POST", body: formData },
    requesterId
  );
}

export function removeAttachment(
  requesterId: number,
  attachmentId: number,
  reason: string
): Promise<{ id: number; removedAt: string; removedReason: string }> {
  return request(
    `/api/attachments/${attachmentId}`,
    { method: "DELETE", body: JSON.stringify({ reason }) },
    requesterId
  );
}

function extractFilename(disposition: string | null, fallback: string): string {
  if (!disposition) return fallback;
  const match = /filename\*?=(?:UTF-8''|")?([^;"]+)/i.exec(disposition);
  if (!match?.[1]) return fallback;
  try {
    return decodeURIComponent(match[1].replace(/"/g, ""));
  } catch {
    return fallback;
  }
}

// FR-07: downloads an active Attachment. Uses fetch (not a plain <a href>)
// because the identity header must travel with the request.
export async function downloadAttachment(
  requesterId: number,
  attachmentId: number,
  filenameHint: string
): Promise<void> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}/api/attachments/${attachmentId}/download`, {
      headers: { "X-Dev-Requester-Id": String(requesterId) },
    });
  } catch {
    throw new ApiError(0, "Unable to reach the TokTickIT server");
  }

  if (!response.ok) {
    const body = await response.json().catch(() => undefined);
    throw new ApiError(response.status, body?.error ?? "Download failed");
  }

  const blob = await response.blob();
  const filename = extractFilename(response.headers.get("content-disposition"), filenameHint);
  const url = URL.createObjectURL(blob);
  try {
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
  } finally {
    URL.revokeObjectURL(url);
  }
}
