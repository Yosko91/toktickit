import type { Prisma, RequestedPriority, TicketStatus } from "@prisma/client";
import { getPrisma } from "../prisma.js";

const SORTABLE_FIELDS = ["createdAt", "ticketNumber", "summary", "requestedPriority"] as const;
type SortableField = (typeof SORTABLE_FIELDS)[number];

const PAGE_SIZES = [10, 20, 50] as const;
const PRIORITIES: RequestedPriority[] = ["LOW", "MEDIUM", "HIGH"];
const STATUSES: TicketStatus[] = [
  "NEW",
  "OPEN",
  "IN_PROGRESS",
  "PENDING",
  "RESOLVED",
  "CLOSED",
  "CANCELLED",
];

export class QueryValidationError extends Error {
  field: string;

  constructor(field: string, message: string) {
    super(message);
    this.name = "QueryValidationError";
    this.field = field;
  }
}

export interface TicketListQuery {
  search?: string;
  categoryId?: string;
  requestedPriority?: string;
  currentStatus?: string;
  sortBy?: string;
  sortDir?: string;
  page?: string;
  pageSize?: string;
}

export interface TicketListItem {
  id: number;
  ticketNumber: string;
  summary: string;
  categoryName: string;
  requestedPriority: RequestedPriority;
  currentStatus: TicketStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface TicketListResult {
  data: TicketListItem[];
  pagination: { page: number; pageSize: number; totalItems: number; totalPages: number };
}

// FR-03/BR-13: always scoped to one Requester - the caller must never be
// able to widen this via a query parameter.
export async function listTicketsForRequester(
  requesterId: number,
  query: TicketListQuery
): Promise<TicketListResult> {
  const sortBy = query.sortBy ?? "createdAt";
  if (!SORTABLE_FIELDS.includes(sortBy as SortableField)) {
    throw new QueryValidationError("sortBy", `must be one of ${SORTABLE_FIELDS.join(", ")}`);
  }

  const sortDir = query.sortDir ?? "desc";
  if (sortDir !== "asc" && sortDir !== "desc") {
    throw new QueryValidationError("sortDir", "must be asc or desc");
  }

  const page = query.page !== undefined ? Number(query.page) : 1;
  if (!Number.isInteger(page) || page < 1) {
    throw new QueryValidationError("page", "must be an integer >= 1");
  }

  const pageSize = query.pageSize !== undefined ? Number(query.pageSize) : 10;
  if (!PAGE_SIZES.includes(pageSize as (typeof PAGE_SIZES)[number])) {
    throw new QueryValidationError("pageSize", `must be one of ${PAGE_SIZES.join(", ")}`);
  }

  const where: Prisma.TicketWhereInput = { requesterId };

  const search = query.search?.trim();
  if (search) {
    where.OR = [
      { ticketNumber: { contains: search, mode: "insensitive" } },
      { summary: { contains: search, mode: "insensitive" } },
    ];
  }

  if (query.categoryId !== undefined) {
    const categoryId = Number(query.categoryId);
    if (!Number.isInteger(categoryId) || categoryId <= 0) {
      throw new QueryValidationError("categoryId", "must be a positive integer");
    }
    where.categoryId = categoryId;
  }

  if (query.requestedPriority !== undefined) {
    const value = query.requestedPriority.toUpperCase() as RequestedPriority;
    if (!PRIORITIES.includes(value)) {
      throw new QueryValidationError("requestedPriority", `must be one of ${PRIORITIES.join(", ")}`);
    }
    where.requestedPriority = value;
  }

  if (query.currentStatus !== undefined) {
    const value = query.currentStatus.toUpperCase() as TicketStatus;
    if (!STATUSES.includes(value)) {
      throw new QueryValidationError("currentStatus", `must be one of ${STATUSES.join(", ")}`);
    }
    where.currentStatus = value;
  }

  const prisma = getPrisma();
  // Secondary sort by id keeps ordering stable when the primary key ties.
  const orderBy: Prisma.TicketOrderByWithRelationInput[] = [
    { [sortBy]: sortDir } as Prisma.TicketOrderByWithRelationInput,
    { id: "asc" },
  ];

  const [rows, totalItems] = await Promise.all([
    prisma.ticket.findMany({
      where,
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { category: { select: { name: true } } },
    }),
    prisma.ticket.count({ where }),
  ]);

  return {
    data: rows.map((t) => ({
      id: t.id,
      ticketNumber: t.ticketNumber,
      summary: t.summary,
      categoryName: t.category.name,
      requestedPriority: t.requestedPriority,
      currentStatus: t.currentStatus,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
    })),
    pagination: {
      page,
      pageSize,
      totalItems,
      totalPages: Math.ceil(totalItems / pageSize),
    },
  };
}
