import { Router } from "express";
import multer from "multer";
import { getPrisma } from "../prisma.js";
import type { AuthUser } from "../middleware/auth.js";
import {
  requireAuth,
  requirePasswordChanged,
  requireRequester,
} from "../middleware/auth.js";
import { validateTicketInput } from "../services/ticketValidation.js";
import { validateMessageBody } from "../services/messageValidation.js";
import { generateTicketNumber } from "../services/ticketNumber.js";
import { listTicketsForRequester, QueryValidationError } from "../services/ticketQuery.js";
import {
  MAX_ACTIVE_ATTACHMENTS_PER_TICKET,
  MAX_ATTACHMENT_SIZE_BYTES,
  UnsupportedAttachmentTypeError,
  deleteAttachmentFileQuietly,
  generateStoredFilename,
  isAllowedAttachment,
  sanitizeOriginalName,
  saveAttachmentFile,
} from "../services/attachmentStorage.js";
import {
  REQUESTER_TICKET_INCLUDE,
  shapeAttachment,
  shapeMessage,
  shapeTicketDetail,
} from "../services/shapes.js";

export const ticketsRouter = Router();

// BR-03: identity comes from the session on every route below. The Lab 2
// X-Dev-Requester-Id header is not read anywhere any more; sending it does
// nothing at all.
ticketsRouter.use(requireAuth, requirePasswordChanged);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_ATTACHMENT_SIZE_BYTES },
  fileFilter: (_req, file, cb) => {
    if (!isAllowedAttachment(file.mimetype, file.originalname)) {
      cb(new UnsupportedAttachmentTypeError());
      return;
    }
    cb(null, true);
  },
});

/**
 * BR-13: a Requester can only reach their own Tickets, and a miss is reported as
 * "not found" rather than "forbidden" so the response never confirms that
 * somebody else's ticket id exists. IT Staff and Administrators reach any
 * Ticket (BR-16).
 */
function ticketScopeFor(user: AuthUser, ticketId: number) {
  return user.role === "REQUESTER"
    ? { id: ticketId, requesterId: user.id }
    : { id: ticketId };
}

// POST /api/tickets - FR-07. Only a Requester creates Tickets.
ticketsRouter.post("/", requireRequester, async (req, res) => {
  const result = validateTicketInput(req.body);
  if (!result.valid) {
    res.status(400).json({ error: "Validation failed", details: result.errors });
    return;
  }
  const { categoryId, relatedSystemId, summary, description, requestedPriority } = result.value!;

  try {
    const prisma = getPrisma();
    const [category, relatedSystem] = await Promise.all([
      prisma.category.findUnique({ where: { id: categoryId } }),
      prisma.relatedSystem.findUnique({ where: { id: relatedSystemId } }),
    ]);

    const referenceErrors: Record<string, string> = {};
    if (!category || !category.isActive) {
      referenceErrors.categoryId = "Unknown or inactive category";
    }
    if (!relatedSystem || !relatedSystem.isActive) {
      referenceErrors.relatedSystemId = "Unknown or inactive related system";
    }
    if (Object.keys(referenceErrors).length > 0) {
      res.status(422).json({ error: "Validation failed", details: referenceErrors });
      return;
    }

    const ticketNumber = await generateTicketNumber();

    const ticket = await prisma.ticket.create({
      data: {
        ticketNumber,
        requesterId: req.user!.id,
        categoryId,
        relatedSystemId,
        summary,
        description,
        requestedPriority,
        // BR-20: IT Priority starts as a copy of what the Requester asked for,
        // and only IT Staff can move it afterwards.
        itPriority: requestedPriority,
      },
    });

    res.status(201).json(ticket);
  } catch (err) {
    console.error("[POST /api/tickets]", err);
    res.status(500).json({ error: "Unable to create ticket" });
  }
});

// GET /api/tickets - the Requester's own list. Staff use the queue instead.
ticketsRouter.get("/", requireRequester, async (req, res) => {
  try {
    const result = await listTicketsForRequester(
      req.user!.id,
      req.query as Record<string, string>
    );
    res.status(200).json(result);
  } catch (err) {
    if (err instanceof QueryValidationError) {
      res
        .status(400)
        .json({ error: "Invalid query parameter", details: { [err.field]: err.message } });
      return;
    }
    console.error("[GET /api/tickets]", err);
    res.status(500).json({ error: "Unable to load tickets" });
  }
});

// GET /api/tickets/:id - FR-07. Never carries Internal Notes, for any role (BR-26).
ticketsRouter.get("/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(404).json({ error: "Ticket not found" });
    return;
  }

  try {
    const ticket = await getPrisma().ticket.findFirst({
      where: ticketScopeFor(req.user!, id),
      include: REQUESTER_TICKET_INCLUDE,
    });

    if (!ticket) {
      res.status(404).json({ error: "Ticket not found" });
      return;
    }

    res.status(200).json(shapeTicketDetail(ticket));
  } catch (err) {
    console.error("[GET /api/tickets/:id]", err);
    res.status(500).json({ error: "Unable to load ticket" });
  }
});

// POST /api/tickets/:id/attachments - unchanged from Lab 2 apart from identity.
ticketsRouter.post("/:id/attachments", upload.single("file"), async (req, res) => {
  const ticketId = Number(req.params.id);
  if (!Number.isInteger(ticketId) || ticketId <= 0) {
    res.status(404).json({ error: "Ticket not found" });
    return;
  }
  if (!req.file) {
    res.status(400).json({ error: "A file is required" });
    return;
  }

  try {
    const prisma = getPrisma();
    const ticket = await prisma.ticket.findFirst({ where: ticketScopeFor(req.user!, ticketId) });
    if (!ticket) {
      res.status(404).json({ error: "Ticket not found" });
      return;
    }

    const activeCount = await prisma.attachment.count({
      where: { ticketId, removedAt: null },
    });
    if (activeCount >= MAX_ACTIVE_ATTACHMENTS_PER_TICKET) {
      res.status(409).json({
        error: `This ticket already has the maximum of ${MAX_ACTIVE_ATTACHMENTS_PER_TICKET} active attachments`,
      });
      return;
    }

    const storedFilename = generateStoredFilename(req.file.originalname);
    await saveAttachmentFile(ticketId, storedFilename, req.file.buffer);

    try {
      const [attachment] = await prisma.$transaction([
        prisma.attachment.create({
          data: {
            ticketId,
            originalName: sanitizeOriginalName(req.file.originalname),
            storedFilename,
            mimeType: req.file.mimetype,
            sizeBytes: req.file.size,
          },
        }),
        prisma.ticket.update({ where: { id: ticketId }, data: { updatedAt: new Date() } }),
      ]);

      res.status(201).json(shapeAttachment(attachment));
    } catch (dbErr) {
      await deleteAttachmentFileQuietly(ticketId, storedFilename);
      throw dbErr;
    }
  } catch (err) {
    console.error("[POST /api/tickets/:id/attachments]", err);
    res.status(500).json({ error: "Unable to upload attachment" });
  }
});

// POST /api/tickets/:id/comments - FR-08, BR-26 to BR-30.
ticketsRouter.post("/:id/comments", async (req, res) => {
  const ticketId = Number(req.params.id);
  if (!Number.isInteger(ticketId) || ticketId <= 0) {
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
    const ticket = await prisma.ticket.findFirst({ where: ticketScopeFor(req.user!, ticketId) });
    if (!ticket) {
      res.status(404).json({ error: "Ticket not found" });
      return;
    }

    // BR-28/BR-30: the author is the session user whatever the request body
    // claims, and the ticket's updatedAt moves so the queue stays useful.
    const [comment] = await prisma.$transaction([
      prisma.publicComment.create({
        data: { ticketId, authorId: req.user!.id, body: bodyResult.value! },
        include: { author: { select: { name: true, role: true } } },
      }),
      prisma.ticket.update({ where: { id: ticketId }, data: { updatedAt: new Date() } }),
    ]);

    res.status(201).json(shapeMessage(comment));
  } catch (err) {
    console.error("[POST /api/tickets/:id/comments]", err);
    res.status(500).json({ error: "Unable to post the comment" });
  }
});

// POST /api/tickets/:id/requester-resolved - FR-09, BR-31.
// Deliberately Requester-only: it records the Requester's own opinion, and it
// is explicitly not a status change (BR-24).
ticketsRouter.post("/:id/requester-resolved", requireRequester, async (req, res) => {
  const ticketId = Number(req.params.id);
  if (!Number.isInteger(ticketId) || ticketId <= 0) {
    res.status(404).json({ error: "Ticket not found" });
    return;
  }

  try {
    const prisma = getPrisma();
    const ticket = await prisma.ticket.findFirst({
      where: { id: ticketId, requesterId: req.user!.id },
    });
    if (!ticket) {
      res.status(404).json({ error: "Ticket not found" });
      return;
    }

    if (["RESOLVED", "CLOSED", "CANCELLED"].includes(ticket.currentStatus)) {
      res.status(409).json({ error: "This ticket is already closed for resolution" });
      return;
    }

    const updated = await prisma.ticket.update({
      where: { id: ticketId },
      data: { requesterResolvedAt: new Date() },
    });

    res.status(200).json({
      id: updated.id,
      requesterResolvedAt: updated.requesterResolvedAt,
      currentStatus: updated.currentStatus,
    });
  } catch (err) {
    console.error("[POST /api/tickets/:id/requester-resolved]", err);
    res.status(500).json({ error: "Unable to record the update" });
  }
});
