import type { Attachment, Prisma } from "@prisma/client";

// Shared response shapes for GET /api/tickets/:id and the Attachment
// endpoints, per docs/lab-02/api-spec.md.

export function shapeAttachment(attachment: Attachment) {
  return {
    id: attachment.id,
    ticketId: attachment.ticketId,
    originalName: attachment.originalName,
    mimeType: attachment.mimeType,
    sizeBytes: attachment.sizeBytes,
    uploadedAt: attachment.uploadedAt,
    removedAt: attachment.removedAt,
    removedReason: attachment.removedReason,
    removedById: attachment.removedById,
  };
}

type TicketWithRelations = Prisma.TicketGetPayload<{
  include: {
    requester: { select: { name: true } };
    category: { select: { name: true } };
    relatedSystem: { select: { name: true } };
    attachments: true;
  };
}>;

export function shapeTicketDetail(ticket: TicketWithRelations) {
  return {
    id: ticket.id,
    ticketNumber: ticket.ticketNumber,
    requesterId: ticket.requesterId,
    requesterName: ticket.requester.name,
    categoryId: ticket.categoryId,
    categoryName: ticket.category.name,
    relatedSystemId: ticket.relatedSystemId,
    relatedSystemName: ticket.relatedSystem.name,
    summary: ticket.summary,
    description: ticket.description,
    requestedPriority: ticket.requestedPriority,
    currentStatus: ticket.currentStatus,
    createdAt: ticket.createdAt,
    updatedAt: ticket.updatedAt,
    attachments: ticket.attachments.map(shapeAttachment),
  };
}
