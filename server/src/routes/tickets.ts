import { Router } from "express";
import multer from "multer";
import { getPrisma } from "../prisma.js";
import { requireDevRequester } from "../middleware/requesterIdentity.js";
import { validateTicketInput } from "../services/ticketValidation.js";
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
import { shapeAttachment, shapeTicketDetail } from "../services/shapes.js";

export const ticketsRouter = Router();

// BR-08: every route below requires the caller to identify itself.
ticketsRouter.use(requireDevRequester);

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

// POST /api/tickets - FR-01/FR-02, BR-14 to BR-17.
ticketsRouter.post("/", async (req, res) => {
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
        requesterId: req.requester!.id,
        categoryId,
        relatedSystemId,
        summary,
        description,
        requestedPriority,
      },
    });

    res.status(201).json(ticket);
  } catch (err) {
    console.error("[POST /api/tickets]", err);
    res.status(500).json({ error: "Unable to create ticket" });
  }
});

// GET /api/tickets - FR-03: search, filter, sort, pagination, always scoped
// to the current Requester.
ticketsRouter.get("/", async (req, res) => {
  try {
    const result = await listTicketsForRequester(
      req.requester!.id,
      req.query as Record<string, string>
    );
    res.status(200).json(result);
  } catch (err) {
    if (err instanceof QueryValidationError) {
      res.status(400).json({ error: "Invalid query parameter", details: { [err.field]: err.message } });
      return;
    }
    console.error("[GET /api/tickets]", err);
    res.status(500).json({ error: "Unable to load tickets" });
  }
});

// GET /api/tickets/:id - FR-04/FR-05, BR-13: ownership failure looks
// identical to "does not exist".
ticketsRouter.get("/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(404).json({ error: "Ticket not found" });
    return;
  }

  try {
    const ticket = await getPrisma().ticket.findFirst({
      where: { id, requesterId: req.requester!.id },
      include: {
        requester: { select: { name: true } },
        category: { select: { name: true } },
        relatedSystem: { select: { name: true } },
        attachments: { orderBy: { uploadedAt: "asc" } },
      },
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

// POST /api/tickets/:id/attachments - FR-06, BR-22 to BR-26.
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
    const ticket = await prisma.ticket.findFirst({
      where: { id: ticketId, requesterId: req.requester!.id },
    });
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
