import type { Prisma } from "@prisma/client";
import { getPrisma } from "../../src/prisma.js";
import { generateTicketNumber } from "../../src/services/ticketNumber.js";

// Shared fixtures for the Lab 4 suites. Rows are written straight to the
// database so each test starts from a known state, and the behaviour under
// test always goes through the real API.

export async function referenceIds() {
  const prisma = getPrisma();
  const category = await prisma.category.findFirstOrThrow({ where: { isActive: true } });
  const relatedSystem = await prisma.relatedSystem.findFirstOrThrow({ where: { isActive: true } });
  return { categoryId: category.id, relatedSystemId: relatedSystem.id };
}

export async function newTicket(
  requesterId: number,
  overrides: Partial<Prisma.TicketUncheckedCreateInput> = {}
) {
  const { categoryId, relatedSystemId } = await referenceIds();
  return getPrisma().ticket.create({
    data: {
      ticketNumber: await generateTicketNumber(),
      requesterId,
      categoryId,
      relatedSystemId,
      summary: "Lab 4 fixture ticket",
      description: "Created by a Lab 4 test suite.",
      requestedPriority: "MEDIUM",
      itPriority: "MEDIUM",
      ...overrides,
    },
  });
}

export async function addAction(
  ticketId: number,
  performedById: number,
  overrides: Partial<Prisma.ActionTakenUncheckedCreateInput> = {}
) {
  return getPrisma().actionTaken.create({
    data: {
      ticketId,
      actionAt: new Date(),
      description: "Fixture action",
      result: "Fixture result",
      status: "COMPLETED",
      performedById,
      createdById: performedById,
      ...overrides,
    },
  });
}

/** A valid create body, as the Lab 4 client sends it. */
export function actionBody(overrides: Record<string, unknown> = {}) {
  return {
    actionAt: new Date().toISOString(),
    description: "Restarted the print spooler service on the print server.",
    result: "The printer is back online for everyone on the floor.",
    status: "COMPLETED",
    followUpRequired: false,
    ...overrides,
  };
}
