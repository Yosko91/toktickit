import { Router } from "express";
import { getPrisma } from "../prisma.js";
import { requireDevRequester } from "../middleware/requesterIdentity.js";
import { validateRemovalReason } from "../services/ticketValidation.js";
import { attachmentFilePath } from "../services/attachmentStorage.js";
import { shapeAttachment } from "../services/shapes.js";
import type { Attachment } from "@prisma/client";

export const attachmentsRouter = Router();

attachmentsRouter.use(requireDevRequester);

// BR-13/BR-29: an Attachment is owned through its parent Ticket's Requester.
async function findOwnedAttachment(id: number, requesterId: number): Promise<Attachment | null> {
  return getPrisma().attachment.findFirst({
    where: { id, ticket: { requesterId } },
  });
}

// GET /api/attachments/:id
attachmentsRouter.get("/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(404).json({ error: "Attachment not found" });
    return;
  }

  try {
    const attachment = await findOwnedAttachment(id, req.requester!.id);
    if (!attachment) {
      res.status(404).json({ error: "Attachment not found" });
      return;
    }
    res.status(200).json(shapeAttachment(attachment));
  } catch (err) {
    console.error("[GET /api/attachments/:id]", err);
    res.status(500).json({ error: "Unable to load attachment" });
  }
});

// GET /api/attachments/:id/download - FR-07, BR-28: 410 for removed files.
attachmentsRouter.get("/:id/download", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(404).json({ error: "Attachment not found" });
    return;
  }

  try {
    const attachment = await findOwnedAttachment(id, req.requester!.id);
    if (!attachment) {
      res.status(404).json({ error: "Attachment not found" });
      return;
    }
    if (attachment.removedAt) {
      res.status(410).json({ error: "Attachment has been removed" });
      return;
    }

    const filePath = attachmentFilePath(attachment.ticketId, attachment.storedFilename);
    res.setHeader("Content-Type", attachment.mimeType);
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${encodeURIComponent(attachment.originalName)}"`
    );
    res.sendFile(filePath, (err) => {
      if (err && !res.headersSent) {
        console.error("[download attachment]", err);
        res.status(500).json({ error: "Unable to download attachment" });
      }
    });
  } catch (err) {
    console.error("[GET /api/attachments/:id/download]", err);
    res.status(500).json({ error: "Unable to download attachment" });
  }
});

// DELETE /api/attachments/:id - FR-08, BR-27: soft removal with a reason.
attachmentsRouter.delete("/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(404).json({ error: "Attachment not found" });
    return;
  }

  try {
    const attachment = await findOwnedAttachment(id, req.requester!.id);
    if (!attachment) {
      res.status(404).json({ error: "Attachment not found" });
      return;
    }

    const reasonResult = validateRemovalReason(req.body?.reason);
    if (!reasonResult.valid) {
      res.status(400).json({ error: reasonResult.error });
      return;
    }

    if (attachment.removedAt) {
      res.status(409).json({ error: "Attachment already removed" });
      return;
    }

    const prisma = getPrisma();
    const [updated] = await prisma.$transaction([
      prisma.attachment.update({
        where: { id },
        data: {
          removedAt: new Date(),
          removedReason: reasonResult.value,
          removedById: req.requester!.id,
        },
      }),
      prisma.ticket.update({ where: { id: attachment.ticketId }, data: { updatedAt: new Date() } }),
    ]);

    res.status(200).json({
      id: updated.id,
      removedAt: updated.removedAt,
      removedReason: updated.removedReason,
    });
  } catch (err) {
    console.error("[DELETE /api/attachments/:id]", err);
    res.status(500).json({ error: "Unable to remove attachment" });
  }
});
