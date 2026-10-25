import { Router, type Request } from "express";
import { Prisma } from "@prisma/client";
import { getPrisma } from "../prisma.js";
import {
  checkActionRules,
  isActionFinal,
  isActionMovePermitted,
  isTicketWorkable,
  parseActionInput,
  type ActionFields,
} from "../services/actionRules.js";
import { ACTION_INCLUDE, shapeAction } from "../services/shapes.js";

// Lab 4 - Actions Taken (api-spec.md section 3). Mounted inside the staff
// router, so requireAuth, requirePasswordChanged and requireStaff have already
// run: a Requester never gets this far (BR-03).
export const actionsTakenRouter = Router({ mergeParams: true });

// mergeParams gives us the parent :id at run time, but the Express types only
// know the params declared on this router.
function params(req: Request): Record<string, string | undefined> {
  return req.params as Record<string, string | undefined>;
}

function parseId(raw: string | undefined): number | null {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

/** BR-04: only an active IT Staff or Administrator can perform work. */
async function isActiveStaff(userId: number): Promise<boolean> {
  const user = await getPrisma().user.findUnique({ where: { id: userId } });
  return Boolean(user && user.isActive && user.role !== "REQUESTER");
}

const NOT_WORKABLE = {
  error: "This ticket is resolved, closed or cancelled. Reopen it to record more work.",
  code: "TICKET_NOT_WORKABLE",
};

const PERFORMER_REFUSED = {
  error: "Validation failed",
  details: { performedById: "The performer must be an active IT Staff or Administrator user" },
};

function staleBody(currentVersion: number) {
  return {
    error: "This action was changed by someone else. Reload it and try again.",
    code: "STALE_UPDATE",
    currentVersion,
  };
}

// POST /api/staff/tickets/:id/actions
actionsTakenRouter.post("/", async (req, res) => {
  const ticketId = parseId(params(req).id);
  if (ticketId === null) {
    res.status(404).json({ error: "Ticket not found" });
    return;
  }

  const { fields, errors } = parseActionInput(req.body, "create");
  const clientRequestId = req.body?.clientRequestId;
  if (
    clientRequestId !== undefined &&
    (typeof clientRequestId !== "string" || clientRequestId.length < 8 || clientRequestId.length > 100)
  ) {
    errors.clientRequestId = "Must be a string of 8 to 100 characters";
  }
  if (Object.keys(errors).length > 0) {
    res.status(400).json({ error: "Validation failed", details: errors });
    return;
  }

  try {
    const prisma = getPrisma();
    const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
    if (!ticket) {
      res.status(404).json({ error: "Ticket not found" });
      return;
    }

    // BR-14: a retry of a request that was already saved gets the saved row.
    if (clientRequestId) {
      const existing = await prisma.actionTaken.findUnique({
        where: { clientRequestId },
        include: ACTION_INCLUDE,
      });
      if (existing) {
        if (existing.ticketId !== ticketId) {
          res.status(409).json({ error: "This request id was already used on another ticket" });
          return;
        }
        res.status(200).json(shapeAction(existing));
        return;
      }
    }

    if (!isTicketWorkable(ticket.currentStatus)) {
      res.status(409).json(NOT_WORKABLE);
      return;
    }

    const action: ActionFields = {
      actionAt: fields.actionAt!,
      description: fields.description!,
      result: fields.result ?? null,
      status: fields.status ?? "COMPLETED",
      followUpRequired: fields.followUpRequired ?? false,
      followUpNote: fields.followUpNote ?? null,
      attachmentNotes: fields.attachmentNotes ?? null,
    };
    const ruleErrors = checkActionRules(action, { ticketCreatedAt: ticket.createdAt, now: new Date() });
    if (Object.keys(ruleErrors).length > 0) {
      res.status(400).json({ error: "Validation failed", details: ruleErrors });
      return;
    }

    // BR-04: no performer in the request means the person recording it.
    const performedById = fields.performedById ?? req.user!.id;
    if (fields.performedById !== undefined && !(await isActiveStaff(performedById))) {
      res.status(422).json(PERFORMER_REFUSED);
      return;
    }

    try {
      const [created] = await prisma.$transaction([
        prisma.actionTaken.create({
          data: {
            ticketId,
            actionAt: action.actionAt,
            description: action.description,
            result: action.result,
            status: action.status,
            performedById,
            createdById: req.user!.id,
            followUpRequired: action.followUpRequired,
            // BR-06: no follow-up, no note.
            followUpNote: action.followUpRequired ? action.followUpNote : null,
            attachmentNotes: action.attachmentNotes,
            clientRequestId: clientRequestId ?? null,
          },
          include: ACTION_INCLUDE,
        }),
        // BR-12: the ticket looks updated in the lists, its version does not move.
        prisma.ticket.update({ where: { id: ticketId }, data: { updatedAt: new Date() } }),
      ]);
      res.status(201).json(shapeAction(created));
    } catch (err) {
      // Two retries arrived at the same moment: the unique index stopped the
      // second insert, so answer with the row the first one saved.
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002" && clientRequestId) {
        const existing = await prisma.actionTaken.findUnique({
          where: { clientRequestId },
          include: ACTION_INCLUDE,
        });
        if (existing) {
          res.status(200).json(shapeAction(existing));
          return;
        }
      }
      throw err;
    }
  } catch (err) {
    console.error("[POST /api/staff/tickets/:id/actions]", err);
    res.status(500).json({ error: "Unable to save the action" });
  }
});

// PATCH /api/staff/tickets/:id/actions/:actionId - the order of the checks is
// the one written in api-spec.md section 3.
actionsTakenRouter.patch("/:actionId", async (req, res) => {
  const ticketId = parseId(params(req).id);
  const actionId = parseId(params(req).actionId);
  if (ticketId === null || actionId === null) {
    res.status(404).json({ error: "Action not found" });
    return;
  }

  try {
    const prisma = getPrisma();
    // BR-01: the action must belong to the ticket in the URL.
    const stored = await prisma.actionTaken.findFirst({
      where: { id: actionId, ticketId },
      include: { ticket: true },
    });
    if (!stored) {
      res.status(404).json({ error: "Action not found" });
      return;
    }

    const version = req.body?.version;
    if (!Number.isInteger(version)) {
      res.status(400).json({
        error: "Validation failed",
        details: { version: "The version of the action you are editing is required" },
      });
      return;
    }
    if (version !== stored.version) {
      res.status(409).json(staleBody(stored.version));
      return;
    }
    if (isActionFinal(stored.status)) {
      res.status(409).json({
        error: "A completed or cancelled action cannot be changed",
        code: "ACTION_READ_ONLY",
      });
      return;
    }
    if (!isTicketWorkable(stored.ticket.currentStatus)) {
      res.status(409).json(NOT_WORKABLE);
      return;
    }

    const { fields, errors } = parseActionInput(req.body, "update");
    if (Object.keys(errors).length > 0) {
      res.status(400).json({ error: "Validation failed", details: errors });
      return;
    }

    const merged: ActionFields = {
      actionAt: fields.actionAt ?? stored.actionAt,
      description: fields.description ?? stored.description,
      result: fields.result !== undefined ? fields.result : stored.result,
      status: fields.status ?? stored.status,
      followUpRequired: fields.followUpRequired ?? stored.followUpRequired,
      followUpNote: fields.followUpNote !== undefined ? fields.followUpNote : stored.followUpNote,
      attachmentNotes:
        fields.attachmentNotes !== undefined ? fields.attachmentNotes : stored.attachmentNotes,
    };
    const ruleErrors = checkActionRules(merged, {
      ticketCreatedAt: stored.ticket.createdAt,
      now: new Date(),
    });
    if (Object.keys(ruleErrors).length > 0) {
      res.status(400).json({ error: "Validation failed", details: ruleErrors });
      return;
    }

    if (!isActionMovePermitted(stored.status, merged.status)) {
      res.status(409).json({
        error: `An action cannot move from ${stored.status} to ${merged.status}`,
        code: "INVALID_TRANSITION",
      });
      return;
    }

    const performedById = fields.performedById ?? stored.performedById;
    if (performedById !== stored.performedById && !(await isActiveStaff(performedById))) {
      res.status(422).json(PERFORMER_REFUSED);
      return;
    }

    // BR-13: compare and set in one statement. If someone saved between our
    // read and this write, no row matches and nothing is overwritten.
    const updated = await prisma.$transaction(async (tx) => {
      const { count } = await tx.actionTaken.updateMany({
        where: { id: actionId, version },
        data: {
          actionAt: merged.actionAt,
          description: merged.description,
          result: merged.result,
          status: merged.status,
          performedById,
          followUpRequired: merged.followUpRequired,
          followUpNote: merged.followUpRequired ? merged.followUpNote : null,
          attachmentNotes: merged.attachmentNotes,
          version: { increment: 1 },
        },
      });
      if (count === 0) return null;
      await tx.ticket.update({ where: { id: ticketId }, data: { updatedAt: new Date() } });
      return tx.actionTaken.findUnique({ where: { id: actionId }, include: ACTION_INCLUDE });
    });

    if (!updated) {
      const current = await prisma.actionTaken.findUnique({ where: { id: actionId } });
      res.status(409).json(staleBody(current?.version ?? version));
      return;
    }

    res.status(200).json(shapeAction(updated));
  } catch (err) {
    console.error("[PATCH /api/staff/tickets/:id/actions/:actionId]", err);
    res.status(500).json({ error: "Unable to save the action" });
  }
});

// BR-10: the record of work stays complete. A wrong action is cancelled.
actionsTakenRouter.delete("/:actionId", (_req, res) => {
  res.status(405).json({ error: "Actions Taken are never deleted. Cancel the action instead." });
});
