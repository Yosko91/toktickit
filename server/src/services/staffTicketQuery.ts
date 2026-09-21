import type { Prisma, RequestedPriority, TicketStatus } from "@prisma/client";
import { getPrisma } from "../prisma.js";
import { QueryValidationError } from "./ticketQuery.js";
import { ASSIGNABLE_STATUSES } from "./ticketWorkflow.js";

// FR-10: the shared IT Staff queue over every Ticket, from every Requester.
// This is deliberately a separate query from the Requester's My Tickets list:
// that one is hard-scoped to one requester id and must stay that way, so
// widening it with an optional parameter would be exactly the kind of change
// that turns into an authorization bug later.

const SORTABLE_FIELDS = [
  "createdAt",
  "updatedAt",
  "ticketNumber",
  "itPriority",
  "currentStatus",
] as const;
type SortableField = (typeof SORTABLE_FIELDS)[number];

const PAGE_SIZES = [10, 20, 50] as const;
const PRIORITIES: RequestedPriority[] = ["LOW", "MEDIUM", "HIGH"];

export interface StaffQueueQuery {
  search?: string;
  categoryId?: string;
  currentStatus?: string;
  itPriority?: string;
  ownerId?: string;
  sortBy?: string;
  sortDir?: string;
  page?: string;
  pageSize?: string;
}

export async function listStaffTickets(query: StaffQueueQuery) {
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

  const pageSize = query.pageSize !== undefined ? Number(query.pageSize) : 20;
  if (!PAGE_SIZES.includes(pageSize as (typeof PAGE_SIZES)[number])) {
    throw new QueryValidationError("pageSize", `must be one of ${PAGE_SIZES.join(", ")}`);
  }

  const where: Prisma.TicketWhereInput = {};

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

  if (query.currentStatus !== undefined) {
    const value = query.currentStatus.toUpperCase() as TicketStatus;
    if (!ASSIGNABLE_STATUSES.includes(value)) {
      throw new QueryValidationError(
        "currentStatus",
        `must be one of ${ASSIGNABLE_STATUSES.join(", ")}`
      );
    }
    where.currentStatus = value;
  }

  if (query.itPriority !== undefined) {
    const value = query.itPriority.toUpperCase() as RequestedPriority;
    if (!PRIORITIES.includes(value)) {
      throw new QueryValidationError("itPriority", `must be one of ${PRIORITIES.join(", ")}`);
    }
    where.itPriority = value;
  }

  if (query.ownerId !== undefined) {
    // Finding unclaimed work is the main reason this screen exists, so
    // "unassigned" is a first-class filter value rather than an empty string.
    if (query.ownerId === "unassigned") {
      where.ownerId = null;
    } else {
      const ownerId = Number(query.ownerId);
      if (!Number.isInteger(ownerId) || ownerId <= 0) {
        throw new QueryValidationError("ownerId", "must be a positive integer or 'unassigned'");
      }
      where.ownerId = ownerId;
    }
  }

  const prisma = getPrisma();
  // Secondary sort by id keeps ordering stable when the primary key ties, which
  // matters for pagination: without it, two pages can repeat or skip a row.
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
      include: {
        category: { select: { name: true } },
        requester: { select: { name: true } },
        owner: { select: { name: true } },
      },
    }),
    prisma.ticket.count({ where }),
  ]);

  return {
    data: rows.map((t) => ({
      id: t.id,
      ticketNumber: t.ticketNumber,
      summary: t.summary,
      categoryName: t.category.name,
      requesterName: t.requester.name,
      requestedPriority: t.requestedPriority,
      itPriority: t.itPriority,
      currentStatus: t.currentStatus,
      ownerId: t.ownerId,
      ownerName: t.owner?.name ?? null,
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
