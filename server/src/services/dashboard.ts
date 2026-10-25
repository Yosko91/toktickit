import type { Prisma, RequestedPriority, TicketStatus } from "@prisma/client";
import { getPrisma } from "../prisma.js";
import { ACTIVE_STATUSES } from "./ticketWorkflow.js";

// Lab 4 - dashboards (specification.md BR-24 to BR-32, api-spec.md section 6).
// Every number is a database query run on each request: no cache, nothing
// counted in the browser. Lists are capped at 5 rows (BR-32).

const LIST_SIZE = 5;
const RECENT_WINDOW_MS = 30 * 24 * 60 * 60 * 1000; // BR-30: rolling 30 x 24 h

const ITEM_SELECT = {
  id: true,
  ticketNumber: true,
  summary: true,
  currentStatus: true,
  itPriority: true,
  updatedAt: true,
  resolvedAt: true,
  owner: { select: { name: true } },
} satisfies Prisma.TicketSelect;

type ItemRow = Prisma.TicketGetPayload<{ select: typeof ITEM_SELECT }>;

function shapeItem(row: ItemRow) {
  return {
    id: row.id,
    ticketNumber: row.ticketNumber,
    summary: row.summary,
    currentStatus: row.currentStatus,
    itPriority: row.itPriority,
    ownerName: row.owner?.name ?? null,
    updatedAt: row.updatedAt,
    resolvedAt: row.resolvedAt,
  };
}

const active = { currentStatus: { in: ACTIVE_STATUSES } } satisfies Prisma.TicketWhereInput;

/** BR-26/BR-27. Everything is scoped to the session Requester. */
export async function requesterDashboard(requesterId: number, now = new Date()) {
  const prisma = getPrisma();
  const own = { requesterId };
  const since = new Date(now.getTime() - RECENT_WINDOW_MS);

  const [activeCount, waiting, resolved, closed, needsAttention, recentlyUpdated, recentlyResolved] =
    await Promise.all([
      prisma.ticket.count({ where: { ...own, ...active } }),
      prisma.ticket.count({ where: { ...own, currentStatus: "WAITING_FOR_REQUESTER" } }),
      prisma.ticket.count({ where: { ...own, currentStatus: "RESOLVED" } }),
      prisma.ticket.count({ where: { ...own, currentStatus: "CLOSED" } }),
      prisma.ticket.findMany({
        where: { ...own, currentStatus: "WAITING_FOR_REQUESTER" },
        orderBy: [{ updatedAt: "asc" }, { id: "asc" }],
        take: LIST_SIZE,
        select: ITEM_SELECT,
      }),
      prisma.ticket.findMany({
        where: own,
        orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
        take: LIST_SIZE,
        select: ITEM_SELECT,
      }),
      prisma.ticket.findMany({
        where: { ...own, resolvedAt: { gte: since, lte: now } },
        orderBy: [{ resolvedAt: "desc" }, { id: "desc" }],
        take: LIST_SIZE,
        select: ITEM_SELECT,
      }),
    ]);

  return {
    generatedAt: now,
    metrics: [
      { key: "active", label: "My Active Tickets", value: activeCount, link: "/tickets?statusGroup=active" },
      { key: "waiting", label: "Waiting for Me", value: waiting, link: "/tickets?currentStatus=WAITING_FOR_REQUESTER" },
      { key: "resolved", label: "Resolved", value: resolved, link: "/tickets?currentStatus=RESOLVED" },
      { key: "closed", label: "Closed", value: closed, link: "/tickets?currentStatus=CLOSED" },
    ],
    needsAttention: needsAttention.map(shapeItem),
    recentlyUpdated: recentlyUpdated.map(shapeItem),
    recentlyResolved: recentlyResolved.map(shapeItem),
  };
}

const STATUS_CARDS: TicketStatus[] = [...ACTIVE_STATUSES, "RESOLVED"];
const PRIORITIES: RequestedPriority[] = ["HIGH", "MEDIUM", "LOW"];

/** BR-28/BR-29. userCounts only exists for an Administrator. */
export async function staffDashboard(user: { id: number; role: string }, now = new Date()) {
  const prisma = getPrisma();
  const openActions = {
    performedById: user.id,
    status: { in: ["PLANNED", "IN_PROGRESS"] },
    ticket: active,
  } satisfies Prisma.ActionTakenWhereInput;

  const [unassigned, assignedToMe, myOpenActionsCount, byStatusRows, byPriorityRows, myOpenActions, urgentTickets, recentlyUpdated] =
    await Promise.all([
      prisma.ticket.count({ where: { ...active, ownerId: null } }),
      prisma.ticket.count({ where: { ...active, ownerId: user.id } }),
      prisma.actionTaken.count({ where: openActions }),
      prisma.ticket.groupBy({
        by: ["currentStatus"],
        where: { currentStatus: { in: STATUS_CARDS } },
        _count: { _all: true },
      }),
      prisma.ticket.groupBy({ by: ["itPriority"], where: active, _count: { _all: true } }),
      prisma.actionTaken.findMany({
        where: openActions,
        orderBy: [{ actionAt: "asc" }, { id: "asc" }],
        take: LIST_SIZE,
        include: { ticket: { select: { ticketNumber: true } } },
      }),
      prisma.ticket.findMany({
        where: { ...active, itPriority: "HIGH" },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        take: LIST_SIZE,
        select: ITEM_SELECT,
      }),
      prisma.ticket.findMany({
        orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
        take: LIST_SIZE,
        select: ITEM_SELECT,
      }),
    ]);

  // groupBy leaves out the values with no row; BR-31 wants them shown as 0.
  const statusCount = new Map(byStatusRows.map((r) => [r.currentStatus, r._count._all]));
  const priorityCount = new Map(byPriorityRows.map((r) => [r.itPriority, r._count._all]));

  const result: Record<string, unknown> = {
    generatedAt: now,
    metrics: [
      { key: "unassigned", label: "Unassigned", value: unassigned, link: "/queue?ownerId=unassigned&statusGroup=active" },
      { key: "assignedToMe", label: "Assigned to Me", value: assignedToMe, link: `/queue?ownerId=${user.id}&statusGroup=active` },
      // There is no screen that lists actions, so the card points at the list below it.
      { key: "myOpenActions", label: "My Open Actions", value: myOpenActionsCount, link: "#my-open-actions" },
    ],
    byStatus: STATUS_CARDS.map((status) => ({
      status,
      value: statusCount.get(status) ?? 0,
      link: `/queue?currentStatus=${status}`,
    })),
    byItPriority: PRIORITIES.map((priority) => ({
      priority,
      value: priorityCount.get(priority) ?? 0,
      link: `/queue?itPriority=${priority}&statusGroup=active`,
    })),
    myOpenActions: myOpenActions.map((a) => ({
      id: a.id,
      ticketId: a.ticketId,
      ticketNumber: a.ticket.ticketNumber,
      description: a.description,
      status: a.status,
      actionAt: a.actionAt,
    })),
    urgentTickets: urgentTickets.map(shapeItem),
    recentlyUpdated: recentlyUpdated.map(shapeItem),
  };

  if (user.role === "ADMINISTRATOR") {
    const [byRole, inactiveUsers] = await Promise.all([
      prisma.user.groupBy({ by: ["role"], where: { isActive: true }, _count: { _all: true } }),
      prisma.user.count({ where: { isActive: false } }),
    ]);
    const roleCount = new Map(byRole.map((r) => [r.role, r._count._all]));
    result.userCounts = {
      activeRequesters: roleCount.get("REQUESTER") ?? 0,
      activeItStaff: roleCount.get("IT_STAFF") ?? 0,
      activeAdministrators: roleCount.get("ADMINISTRATOR") ?? 0,
      inactiveUsers,
      link: "/admin/users",
    };
  }

  return result;
}
