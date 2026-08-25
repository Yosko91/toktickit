import { randomUUID } from "node:crypto";
import { getPrisma } from "../../src/prisma.js";

// Shared fixtures for Lab 2 API tests. Every suite creates its own
// RequesterUser(s) and Tickets so suites stay independent and repeatable -
// they never rely on, or mutate, the seeded reference data used by the app
// itself (Category/RelatedSystem rows, or the seeded Requesters).
//
// Test files run concurrently (each in its own module instance), so the
// suffix must be unique across files, not just within one - a random UUID
// segment guarantees that where a shared counter or Date.now() alone could
// collide.

export function uniqueSuffix(): string {
  return randomUUID();
}

export async function createTestRequester(overrides: { isActive?: boolean } = {}) {
  const suffix = uniqueSuffix();
  return getPrisma().requesterUser.create({
    data: {
      name: `Test Requester ${suffix}`,
      email: `test-requester-${suffix}@toktickit.test`,
      isActive: overrides.isActive ?? true,
    },
  });
}

export async function getSeededCategory(name = "Hardware") {
  const category = await getPrisma().category.findUniqueOrThrow({ where: { name } });
  return category;
}

export async function getSeededRelatedSystem(name = "Corporate Laptop") {
  const relatedSystem = await getPrisma().relatedSystem.findUniqueOrThrow({ where: { name } });
  return relatedSystem;
}

export function validTicketBody(overrides: Record<string, unknown> = {}) {
  return {
    summary: "Laptop battery drains quickly",
    description: "My laptop battery is draining much faster than usual even when the system is idle.",
    requestedPriority: "MEDIUM",
    ...overrides,
  };
}

// Deletes everything created under one or more test Requesters, in FK-safe
// order (Attachment -> Ticket -> RequesterUser).
export async function cleanupRequesters(requesterIds: Array<number | undefined>) {
  const ids = requesterIds.filter((id): id is number => typeof id === "number");
  if (ids.length === 0) return;

  const prisma = getPrisma();
  const tickets = await prisma.ticket.findMany({
    where: { requesterId: { in: ids } },
    select: { id: true },
  });
  const ticketIds = tickets.map((t) => t.id);

  if (ticketIds.length > 0) {
    await prisma.attachment.deleteMany({ where: { ticketId: { in: ticketIds } } });
    await prisma.ticket.deleteMany({ where: { id: { in: ticketIds } } });
  }
  await prisma.requesterUser.deleteMany({ where: { id: { in: ids } } });
}
