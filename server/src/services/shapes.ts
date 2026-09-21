import type { Attachment, Prisma } from "@prisma/client";

// Shared response shapes. See docs/lab-03/api-spec.md.

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

type MessageWithAuthor = {
  id: number;
  ticketId: number;
  authorId: number;
  author: { name: string; role: string };
  body: string;
  createdAt: Date;
};

// BR-28: the author name and role always come from the joined row, never from
// anything the poster sent.
export function shapeMessage(message: MessageWithAuthor) {
  return {
    id: message.id,
    ticketId: message.ticketId,
    authorId: message.authorId,
    authorName: message.author.name,
    authorRole: message.author.role,
    body: message.body,
    createdAt: message.createdAt,
  };
}

type RequesterTicketPayload = Prisma.TicketGetPayload<{
  include: {
    requester: { select: { name: true } };
    owner: { select: { name: true } };
    category: { select: { name: true } };
    relatedSystem: { select: { name: true } };
    attachments: true;
    publicComments: { include: { author: { select: { name: true; role: true } } } };
  };
}>;

/**
 * The Requester view of a Ticket. BR-26: this shape has no Internal Note field
 * at all, so there is no way for a note to reach a Requester through it even if
 * a future query accidentally loads one.
 */
export function shapeTicketDetail(ticket: RequesterTicketPayload) {
  return {
    id: ticket.id,
    ticketNumber: ticket.ticketNumber,
    requesterId: ticket.requesterId,
    requesterName: ticket.requester.name,
    ownerId: ticket.ownerId,
    ownerName: ticket.owner?.name ?? null,
    categoryId: ticket.categoryId,
    categoryName: ticket.category.name,
    relatedSystemId: ticket.relatedSystemId,
    relatedSystemName: ticket.relatedSystem.name,
    summary: ticket.summary,
    description: ticket.description,
    requestedPriority: ticket.requestedPriority,
    itPriority: ticket.itPriority,
    currentStatus: ticket.currentStatus,
    requesterResolvedAt: ticket.requesterResolvedAt,
    createdAt: ticket.createdAt,
    updatedAt: ticket.updatedAt,
    attachments: ticket.attachments.map(shapeAttachment),
    publicComments: ticket.publicComments.map(shapeMessage),
  };
}

type StaffTicketPayload = RequesterTicketPayload & {
  internalNotes: MessageWithAuthor[];
};

/** The IT Staff view: the Requester view plus the Internal Notes (BR-26). */
export function shapeStaffTicketDetail(ticket: StaffTicketPayload) {
  return {
    ...shapeTicketDetail(ticket),
    internalNotes: ticket.internalNotes.map(shapeMessage),
  };
}

// The include used for both views, so the two can never drift apart.
export const REQUESTER_TICKET_INCLUDE = {
  requester: { select: { name: true } },
  owner: { select: { name: true } },
  category: { select: { name: true } },
  relatedSystem: { select: { name: true } },
  attachments: { orderBy: { uploadedAt: "asc" } },
  publicComments: {
    orderBy: { createdAt: "asc" },
    include: { author: { select: { name: true, role: true } } },
  },
} satisfies Prisma.TicketInclude;
