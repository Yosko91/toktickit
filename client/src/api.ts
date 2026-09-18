// TokTickIT REST client. See docs/lab-03/api-spec.md for the full contract.

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

export type RequestedPriority = "LOW" | "MEDIUM" | "HIGH";
export type Role = "REQUESTER" | "IT_STAFF" | "ADMINISTRATOR";

// BR-21. PENDING is the unused Lab 2 placeholder, kept so old rows still parse.
export type TicketStatus =
  | "NEW"
  | "OPEN"
  | "IN_PROGRESS"
  | "PENDING"
  | "WAITING_FOR_REQUESTER"
  | "RESOLVED"
  | "CLOSED"
  | "REOPENED"
  | "CANCELLED";

export interface AuthUser {
  id: number;
  name: string;
  email: string;
  role: Role;
  mustChangePassword: boolean;
}

export interface Category {
  id: number;
  name: string;
}

export interface RelatedSystem {
  id: number;
  name: string;
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

export interface TicketMessage {
  id: number;
  ticketId: number;
  authorId: number;
  authorName: string;
  authorRole: Role;
  body: string;
  createdAt: string;
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

export interface Pagination {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

export interface TicketListResponse {
  data: TicketListItem[];
  pagination: Pagination;
}

export interface TicketDetail {
  id: number;
  ticketNumber: string;
  requesterId: number;
  requesterName: string;
  ownerId: number | null;
  ownerName: string | null;
  categoryId: number;
  categoryName: string;
  relatedSystemId: number;
  relatedSystemName: string;
  summary: string;
  description: string;
  requestedPriority: RequestedPriority;
  itPriority: RequestedPriority;
  currentStatus: TicketStatus;
  requesterResolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
  attachments: AttachmentMeta[];
  publicComments: TicketMessage[];
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

/**
 * Thrown for every non-2xx response and for network failures (status 0), so UI
 * code can branch on `.status` and render field errors from `.details`.
 * `.code` carries PASSWORD_CHANGE_REQUIRED (BR-02), which is a redirect
 * instruction rather than an error to display.
 */
export class ApiError extends Error {
  status: number;
  details?: Record<string, string>;
  code?: string;

  constructor(status: number, message: string, details?: Record<string, string>, code?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
    this.code = code;
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (!(init.body instanceof FormData) && init.body !== undefined) {
    headers.set("Content-Type", "application/json");
  }

  let response: Response;
  try {
    // BR-03: the session cookie is the only identity. It is httpOnly, so this
    // code cannot read it - it just has to ask the browser to send it.
    response = await fetch(`${API_URL}${path}`, { ...init, headers, credentials: "include" });
  } catch {
    throw new ApiError(0, "Unable to reach the TokTickIT server");
  }

  const contentType = response.headers.get("content-type") ?? "";
  const body = contentType.includes("application/json")
    ? await response.json().catch(() => undefined)
    : undefined;

  if (!response.ok) {
    throw new ApiError(response.status, body?.error ?? "Request failed", body?.details, body?.code);
  }

  return body as T;
}

// --- Authentication (FR-01 to FR-04) ---

export function login(email: string, password: string): Promise<AuthUser> {
  return request<AuthUser>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export function logout(): Promise<void> {
  return request<void>("/api/auth/logout", { method: "POST" });
}

export function getCurrentUser(): Promise<AuthUser> {
  return request<AuthUser>("/api/auth/me");
}

export function changePassword(currentPassword: string, newPassword: string): Promise<AuthUser> {
  return request<AuthUser>("/api/auth/change-password", {
    method: "POST",
    body: JSON.stringify({ currentPassword, newPassword }),
  });
}

// --- Reference data ---

export function getCategories(): Promise<Category[]> {
  return request<Category[]>("/api/categories");
}

export function getRelatedSystems(): Promise<RelatedSystem[]> {
  return request<RelatedSystem[]>("/api/related-systems");
}

// --- Requester tickets (FR-07 to FR-09) ---

export function createTicket(input: CreateTicketInput): Promise<TicketDetail> {
  return request<TicketDetail>("/api/tickets", { method: "POST", body: JSON.stringify(input) });
}

export function listTickets(params: TicketListParams = {}): Promise<TicketListResponse> {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") {
      query.set(key, String(value));
    }
  }
  const qs = query.toString();
  return request<TicketListResponse>(`/api/tickets${qs ? `?${qs}` : ""}`);
}

export function getTicket(id: number): Promise<TicketDetail> {
  return request<TicketDetail>(`/api/tickets/${id}`);
}

export function postComment(ticketId: number, body: string): Promise<TicketMessage> {
  return request<TicketMessage>(`/api/tickets/${ticketId}/comments`, {
    method: "POST",
    body: JSON.stringify({ body }),
  });
}

export function markRequesterResolved(
  ticketId: number
): Promise<{ id: number; requesterResolvedAt: string; currentStatus: TicketStatus }> {
  return request(`/api/tickets/${ticketId}/requester-resolved`, { method: "POST" });
}

// --- Attachments ---

export function uploadAttachment(ticketId: number, file: File): Promise<AttachmentMeta> {
  const formData = new FormData();
  formData.append("file", file);
  return request<AttachmentMeta>(`/api/tickets/${ticketId}/attachments`, {
    method: "POST",
    body: formData,
  });
}

export function removeAttachment(
  attachmentId: number,
  reason: string
): Promise<{ id: number; removedAt: string; removedReason: string }> {
  return request(`/api/attachments/${attachmentId}`, {
    method: "DELETE",
    body: JSON.stringify({ reason }),
  });
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

// Uses fetch rather than a plain <a href> so the session cookie travels with
// the request and a failure can be reported in the interface.
export async function downloadAttachment(
  attachmentId: number,
  filenameHint: string
): Promise<void> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}/api/attachments/${attachmentId}/download`, {
      credentials: "include",
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

// --- IT Staff queue and ticket operations (FR-10 to FR-15) ---

export interface StaffTicketListItem {
  id: number;
  ticketNumber: string;
  summary: string;
  categoryName: string;
  requesterName: string;
  requestedPriority: RequestedPriority;
  itPriority: RequestedPriority;
  currentStatus: TicketStatus;
  ownerId: number | null;
  ownerName: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface StaffTicketListResponse {
  data: StaffTicketListItem[];
  pagination: Pagination;
}

/** The Requester ticket shape plus the Internal Notes, which only staff receive. */
export interface StaffTicketDetail extends TicketDetail {
  internalNotes: TicketMessage[];
}

export interface AssignableUser {
  id: number;
  name: string;
  role: Role;
}

export interface StaffQueueParams {
  search?: string;
  categoryId?: number;
  currentStatus?: TicketStatus;
  itPriority?: RequestedPriority;
  /** A user id, or the literal "unassigned" to find unclaimed work. */
  ownerId?: number | "unassigned";
  sortBy?: "createdAt" | "updatedAt" | "ticketNumber" | "itPriority" | "currentStatus";
  sortDir?: "asc" | "desc";
  page?: number;
  pageSize?: 10 | 20 | 50;
}

export function listStaffTickets(params: StaffQueueParams = {}): Promise<StaffTicketListResponse> {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") {
      query.set(key, String(value));
    }
  }
  const qs = query.toString();
  return request<StaffTicketListResponse>(`/api/staff/tickets${qs ? `?${qs}` : ""}`);
}

export function getStaffTicket(id: number): Promise<StaffTicketDetail> {
  return request<StaffTicketDetail>(`/api/staff/tickets/${id}`);
}

export function getAssignableUsers(): Promise<AssignableUser[]> {
  return request<AssignableUser[]>("/api/staff/assignable-users");
}

export function setTicketOwner(
  id: number,
  ownerId: number | null
): Promise<{ id: number; ownerId: number | null; ownerName: string | null }> {
  return request(`/api/staff/tickets/${id}/owner`, {
    method: "PATCH",
    body: JSON.stringify({ ownerId }),
  });
}

export function setItPriority(
  id: number,
  itPriority: RequestedPriority
): Promise<{ id: number; itPriority: RequestedPriority; requestedPriority: RequestedPriority }> {
  return request(`/api/staff/tickets/${id}/it-priority`, {
    method: "PATCH",
    body: JSON.stringify({ itPriority }),
  });
}

export function setTicketStatus(
  id: number,
  currentStatus: TicketStatus
): Promise<{ id: number; currentStatus: TicketStatus }> {
  return request(`/api/staff/tickets/${id}/status`, {
    method: "PATCH",
    body: JSON.stringify({ currentStatus }),
  });
}

export function postInternalNote(ticketId: number, body: string): Promise<TicketMessage> {
  return request<TicketMessage>(`/api/staff/tickets/${ticketId}/notes`, {
    method: "POST",
    body: JSON.stringify({ body }),
  });
}
