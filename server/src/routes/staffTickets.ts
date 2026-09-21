import { Router } from "express";
import type { RequestedPriority, TicketStatus } from "@prisma/client";
import { getPrisma } from "../prisma.js";
import { requireAuth, requirePasswordChanged, requireStaff } from "../middleware/auth.js";
import { QueryValidationError } from "../services/ticketQuery.js";
import { listStaffTickets } from "../services/staffTicketQuery.js";
import { validateMessageBody } from "../services/messageValidation.js";
import {
  ASSIGNABLE_STATUSES,
  isTransitionPermitted,
  requiresOwner,
} from "../services/ticketWorkflow.js";
import {
  REQUESTER_TICKET_INCLUDE,
  shapeMessage,
  shapeStaffTicketDetail,
} from "../services/shapes.js";

export const staffTicketsRouter = Router();

// BR-16: IT Staff and Administrators hold the same Ticket operation rights.
// A Requester reaching any of this gets 403 (BR-12, AC-17).
staffTicketsRouter.use(requireAuth, requirePasswordChanged, requireStaff);

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

  try {
    const prisma = getPrisma();
    const ticket = await prisma.ticket.findUnique({ where: { id } });
    if (!ticket) {
      res.status(404).json({ error: "Ticket not found" });
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

    const updated = await prisma.ticket.update({
      where: { id },
      data: { ownerId },
      include: { owner: { select: { name: true } } },
    });

    res.status(200).json({
      id: updated.id,
      ownerId: updated.ownerId,
      ownerName: updated.owner?.name ?? null,
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

  try {
    const prisma = getPrisma();
    const ticket = await prisma.ticket.findUnique({ where: { id } });
    if (!ticket) {
      res.status(404).json({ error: "Ticket not found" });
      return;
    }

    // BR-19: requestedPriority is never written here. It is what the Requester
    // asked for and stays that way permanently.
    const updated = await prisma.ticket.update({ where: { id }, data: { itPriority } });

    res.status(200).json({
      id: updated.id,
      itPriority: updated.itPriority,
      requestedPriority: updated.requestedPriority,
    });
  } catch (err) {
    console.error("[PATCH /api/staff/tickets/:id/it-priority]", err);
    res.status(500).json({ error: "Unable to change the IT priority" });
  }
});

// PATCH /api/staff/tickets/:id/status - FR-14, BR-22, BR-23, BR-25.
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

  try {
    const prisma = getPrisma();
    const ticket = await prisma.ticket.findUnique({ where: { id } });
    if (!ticket) {
      res.status(404).json({ error: "Ticket not found" });
      return;
    }

    if (!isTransitionPermitted(ticket.currentStatus, currentStatus)) {
      res.status(409).json({
        error: `A ticket cannot move from ${ticket.currentStatus} to ${currentStatus}`,
      });
      return;
    }

    if (requiresOwner(currentStatus) && ticket.ownerId === null) {
      res.status(409).json({ error: "A ticket must have an owner before it can be resolved" });
      return;
    }

    const updated = await prisma.ticket.update({ where: { id }, data: { currentStatus } });

    res.status(200).json({ id: updated.id, currentStatus: updated.currentStatus });
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
