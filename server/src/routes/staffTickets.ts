import { Router } from "express";
import type { Prisma, RequestedPriority, TicketStatus } from "@prisma/client";
import { getPrisma } from "../prisma.js";
import { requireAuth, requirePasswordChanged, requireStaff } from "../middleware/auth.js";
import { QueryValidationError } from "../services/ticketQuery.js";
import { listStaffTickets } from "../services/staffTicketQuery.js";
import { validateMessageBody } from "../services/messageValidation.js";
import {
  ASSIGNABLE_STATUSES,
  isTransitionPermitted,
  resolutionBlocker,
} from "../services/ticketWorkflow.js";
import {
  REQUESTER_TICKET_INCLUDE,
  shapeMessage,
  shapeStaffTicketDetail,
} from "../services/shapes.js";
import { actionsTakenRouter } from "./actionsTaken.js";

export const staffTicketsRouter = Router();

// BR-16: IT Staff and Administrators hold the same Ticket operation rights.
// A Requester reaching any of this gets 403 (BR-12, AC-17).
staffTicketsRouter.use(requireAuth, requirePasswordChanged, requireStaff);

// Lab 4 - Actions Taken sit behind the same three checks (BR-03).
staffTicketsRouter.use("/tickets/:id/actions", actionsTakenRouter);

const PRIORITIES: RequestedPriority[] = ["LOW", "MEDIUM", "HIGH"];

// GET /api/staff/assignable-users - BR-17: only active staff may own a Ticket.
staffTicketsRouter.get("/assignable-users", async (_req, res) => {
  try {
    const users = await getPrisma().user.findMany({
      where: { isActive: true, role: { in: ["IT_STAFF", "ADMINISTRATOR"] } },
      orderBy: { name: "asc" },
      select: { id: true, name: true, role: true },
    });
    res.status(200).json(users);
  } catch (err) {
    console.error("[GET /api/staff/assignable-users]", err);
    res.status(500).json({ error: "Unable to load assignable users" });
  }
});

// GET /api/staff/tickets - FR-10, the shared queue.
staffTicketsRouter.get("/tickets", async (req, res) => {
  try {
    const result = await listStaffTickets(req.query as Record<string, string>);
    res.status(200).json(result);
  } catch (err) {
    if (err instanceof QueryValidationError) {
      res
        .status(400)
        .json({ error: "Invalid query parameter", details: { [err.field]: err.message } });
      return;
    }
    console.error("[GET /api/staff/tickets]", err);
    res.status(500).json({ error: "Unable to load the ticket queue" });
  }
});

function parseTicketId(raw: string): number | null {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

// GET /api/staff/tickets/:id - FR-11. This is the only ticket shape that
// carries Internal Notes, and it is only reachable behind requireStaff.
staffTicketsRouter.get("/tickets/:id", async (req, res) => {
  const id = parseTicketId(req.params.id);
  if (id === null) {
    res.status(404).json({ error: "Ticket not found" });
    return;
  }

  try {
    const ticket = await getPrisma().ticket.findUnique({
      where: { id },
      include: {
        ...REQUESTER_TICKET_INCLUDE,
        internalNotes: {
          orderBy: { createdAt: "asc" },
          include: { author: { select: { name: true, role: true } } },
        },
      },
    });

    if (!ticket) {
      res.status(404).json({ error: "Ticket not found" });
      return;
    }

    res.status(200).json(shapeStaffTicketDetail(ticket));
  } catch (err) {
    console.error("[GET /api/staff/tickets/:id]", err);
    res.status(500).json({ error: "Unable to load ticket" });
  }
});

// Lab 4 - BR-22. A missing version means a Lab 3 caller and is accepted; a
// version that is sent must be the current one.
function readVersion(body: unknown): { ok: true; value?: number } | { ok: false } {
  const value = (body as { version?: unknown } | undefined)?.version;
  if (value === undefined) return { ok: true };
  return Number.isInteger(value) ? { ok: true, value: value as number } : { ok: false };
}

const BAD_VERSION = {
  error: "Validation failed",
  details: { version: "Must be the version of the ticket you loaded" },
};

function staleTicket(currentVersion: number) {
  return {
    error: "This ticket was changed by someone else. Reload it and try again.",
    code: "STALE_UPDATE",
    currentVersion,
  };
}

/**
 * Writes a workflow change only if nobody saved since we read the ticket
 * (compare and set on version, BR-22). Returns false when somebody did.
 */
async function updateIfCurrent(
  tx: Prisma.TransactionClient,
  id: number,
  readVersion: number,
  data: Prisma.TicketUncheckedUpdateManyInput
): Promise<boolean> {
  const { count } = await tx.ticket.updateMany({
    where: { id, version: readVersion },
    data: { ...data, version: { increment: 1 }, updatedAt: new Date() },
  });
  return count === 1;
}

// PATCH /api/staff/tickets/:id/owner - FR-12, BR-17, BR-18.
// Claim, reassign and release are the same operation with a different target.
staffTicketsRouter.patch("/tickets/:id/owner", async (req, res) => {
  const id = parseTicketId(req.params.id);
  if (id === null) {
    res.status(404).json({ error: "Ticket not found" });
    return;
  }

  const { ownerId } = req.body ?? {};
  if (ownerId !== null && !Number.isInteger(ownerId)) {
    res.status(400).json({
      error: "Validation failed",
      details: { ownerId: "Must be a user id, or null to leave the ticket unassigned" },
    });
    return;
  }
  const version = readVersion(req.body);
  if (!version.ok) {
    res.status(400).json(BAD_VERSION);
    return;
  }

  try {
    const prisma = getPrisma();
    const ticket = await prisma.ticket.findUnique({ where: { id } });
    if (!ticket) {
      res.status(404).json({ error: "Ticket not found" });
      return;
    }
    if (version.value !== undefined && version.value !== ticket.version) {
      res.status(409).json(staleTicket(ticket.version));
      return;
    }

    if (ownerId !== null) {
      const candidate = await prisma.user.findUnique({ where: { id: ownerId } });
      // BR-17: a Requester or a deactivated account cannot hold a ticket. This
      // is 422 rather than 400 because the body is well formed - it names a
      // real field with a real integer, the user it points at is just not
      // somebody who can own work.
      if (!candidate || !candidate.isActive || candidate.role === "REQUESTER") {
        res.status(422).json({
          error: "Validation failed",
          details: { ownerId: "The ticket owner must be an active IT Staff or Administrator user" },
        });
        return;
      }
    }

    if (!(await updateIfCurrent(prisma, id, ticket.version, { ownerId }))) {
      res.status(409).json(staleTicket(ticket.version + 1));
      return;
    }
    const updated = await prisma.ticket.findUniqueOrThrow({
      where: { id },
      include: { owner: { select: { name: true } } },
    });

    res.status(200).json({
      id: updated.id,
      ownerId: updated.ownerId,
      ownerName: updated.owner?.name ?? null,
      version: updated.version,
    });
  } catch (err) {
    console.error("[PATCH /api/staff/tickets/:id/owner]", err);
    res.status(500).json({ error: "Unable to change the ticket owner" });
  }
});

// PATCH /api/staff/tickets/:id/it-priority - FR-13, BR-19, BR-20.
staffTicketsRouter.patch("/tickets/:id/it-priority", async (req, res) => {
  const id = parseTicketId(req.params.id);
  if (id === null) {
    res.status(404).json({ error: "Ticket not found" });
    return;
  }

  const itPriority = req.body?.itPriority as RequestedPriority;
  if (!PRIORITIES.includes(itPriority)) {
    res.status(400).json({
      error: "Validation failed",
      details: { itPriority: `Must be one of ${PRIORITIES.join(", ")}` },
    });
    return;
  }
  const version = readVersion(req.body);
  if (!version.ok) {
    res.status(400).json(BAD_VERSION);
    return;
  }

  try {
    const prisma = getPrisma();
    const ticket = await prisma.ticket.findUnique({ where: { id } });
    if (!ticket) {
      res.status(404).json({ error: "Ticket not found" });
      return;
    }
    if (version.value !== undefined && version.value !== ticket.version) {
      res.status(409).json(staleTicket(ticket.version));
      return;
    }

    // BR-19: requestedPriority is never written here. It is what the Requester
    // asked for and stays that way permanently.
    if (!(await updateIfCurrent(prisma, id, ticket.version, { itPriority }))) {
      res.status(409).json(staleTicket(ticket.version + 1));
      return;
    }
    const updated = await prisma.ticket.findUniqueOrThrow({ where: { id } });

    res.status(200).json({
      id: updated.id,
      itPriority: updated.itPriority,
      requestedPriority: updated.requestedPriority,
      version: updated.version,
    });
  } catch (err) {
    console.error("[PATCH /api/staff/tickets/:id/it-priority]", err);
    res.status(500).json({ error: "Unable to change the IT priority" });
  }
});

// PATCH /api/staff/tickets/:id/status - FR-14, BR-22, BR-25 (Lab 3) and the
// Lab 4 gate (BR-18), history (BR-20), resolvedAt (BR-21) and version (BR-22).
staffTicketsRouter.patch("/tickets/:id/status", async (req, res) => {
  const id = parseTicketId(req.params.id);
  if (id === null) {
    res.status(404).json({ error: "Ticket not found" });
    return;
  }

  const currentStatus = req.body?.currentStatus as TicketStatus;
  if (!ASSIGNABLE_STATUSES.includes(currentStatus)) {
    res.status(400).json({
      error: "Validation failed",
      details: { currentStatus: `Must be one of ${ASSIGNABLE_STATUSES.join(", ")}` },
    });
    return;
  }
  const version = readVersion(req.body);
  if (!version.ok) {
    res.status(400).json(BAD_VERSION);
    return;
  }

  try {
    const prisma = getPrisma();
    const ticket = await prisma.ticket.findUnique({ where: { id } });
    if (!ticket) {
      res.status(404).json({ error: "Ticket not found" });
      return;
    }
    if (version.value !== undefined && version.value !== ticket.version) {
      res.status(409).json(staleTicket(ticket.version));
      return;
    }

    if (!isTransitionPermitted(ticket.currentStatus, currentStatus)) {
      res.status(409).json({
        error: `A ticket cannot move from ${ticket.currentStatus} to ${currentStatus}`,
        code: "INVALID_TRANSITION",
      });
      return;
    }

    const updated = await prisma.$transaction(async (tx) => {
      // BR-18: read the actions inside the same transaction as the write.
      if (currentStatus === "RESOLVED") {
        const actions = await tx.actionTaken.findMany({ where: { ticketId: id }, select: { status: true } });
        const block = resolutionBlocker(ticket, actions);
        if (block) return block;
      }

      const resolvedAt =
        currentStatus === "RESOLVED" ? new Date() : currentStatus === "REOPENED" ? null : undefined;
      if (!(await updateIfCurrent(tx, id, ticket.version, { currentStatus, resolvedAt }))) {
        return null;
      }
      // BR-20: append-only. Nothing in the API updates or deletes these rows.
      await tx.ticketStatusChange.create({
        data: {
          ticketId: id,
          fromStatus: ticket.currentStatus,
          toStatus: currentStatus,
          changedById: req.user!.id,
        },
      });
      return tx.ticket.findUniqueOrThrow({ where: { id } });
    });

    if (updated === null) {
      res.status(409).json(staleTicket(ticket.version + 1));
      return;
    }
    if ("code" in updated) {
      res.status(409).json({ error: updated.message, code: updated.code });
      return;
    }

    res.status(200).json({
      id: updated.id,
      currentStatus: updated.currentStatus,
      version: updated.version,
      resolvedAt: updated.resolvedAt,
    });
  } catch (err) {
    console.error("[PATCH /api/staff/tickets/:id/status]", err);
    res.status(500).json({ error: "Unable to change the ticket status" });
  }
});

// GET /api/staff/tickets/:id/notes - FR-15, BR-14, BR-26.
staffTicketsRouter.get("/tickets/:id/notes", async (req, res) => {
  const id = parseTicketId(req.params.id);
  if (id === null) {
    res.status(404).json({ error: "Ticket not found" });
    return;
  }

  try {
    const notes = await getPrisma().internalNote.findMany({
      where: { ticketId: id },
      orderBy: { createdAt: "asc" },
      include: { author: { select: { name: true, role: true } } },
    });
    res.status(200).json(notes.map(shapeMessage));
  } catch (err) {
    console.error("[GET /api/staff/tickets/:id/notes]", err);
    res.status(500).json({ error: "Unable to load internal notes" });
  }
});

// POST /api/staff/tickets/:id/notes - FR-15, BR-27 to BR-30.
staffTicketsRouter.post("/tickets/:id/notes", async (req, res) => {
  const id = parseTicketId(req.params.id);
  if (id === null) {
    res.status(404).json({ error: "Ticket not found" });
    return;
  }

  const bodyResult = validateMessageBody(req.body?.body);
  if (!bodyResult.valid) {
    res.status(400).json({ error: "Validation failed", details: { body: bodyResult.error! } });
    return;
  }

  try {
    const prisma = getPrisma();
    const ticket = await prisma.ticket.findUnique({ where: { id } });
    if (!ticket) {
      res.status(404).json({ error: "Ticket not found" });
      return;
    }

    // BR-28: the author comes from the session, whatever the body says.
    const [note] = await prisma.$transaction([
      prisma.internalNote.create({
        data: { ticketId: id, authorId: req.user!.id, body: bodyResult.value! },
        include: { author: { select: { name: true, role: true } } },
      }),
      prisma.ticket.update({ where: { id }, data: { updatedAt: new Date() } }),
    ]);

    res.status(201).json(shapeMessage(note));
  } catch (err) {
    console.error("[POST /api/staff/tickets/:id/notes]", err);
    res.status(500).json({ error: "Unable to save the internal note" });
  }
});
