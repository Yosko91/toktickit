import { randomUUID } from "node:crypto";
import type { Role, User } from "@prisma/client";
import { getPrisma } from "../../src/prisma.js";
import { SESSION_COOKIE, SESSION_TTL_MS } from "../../src/services/session.js";
import { hashPassword } from "../../src/services/password.js";

// Shared fixtures for every API suite from Lab 2 onwards.
//
// Each helper creates its own User and its own Session, so suites stay
// independent and repeatable and never mutate the seeded reference data the
// application itself uses.
//
// The session token is derived from the user id rather than being random. That
// is what lets `cookieFor()` be a plain synchronous function, so a supertest
// chain can stay a single expression. The real requireAuth path is still fully
// exercised - the row is a genuine Session row and the middleware still looks
// it up, checks its expiry and checks that the account is active.

export const TEST_PASSWORD = "TestPass!23";

export function uniqueSuffix(): string {
  return randomUUID();
}

export function cookieFor(userId: number): string {
  return `${SESSION_COOKIE}=test-session-${userId}`;
}

interface CreateUserOptions {
  role?: Role;
  isActive?: boolean;
  mustChangePassword?: boolean;
  name?: string;
}

export async function createTestUser(options: CreateUserOptions = {}): Promise<User> {
  const suffix = uniqueSuffix();
  const role = options.role ?? "REQUESTER";
  const prisma = getPrisma();

  const user = await prisma.user.create({
    data: {
      name: options.name ?? `Test ${role} ${suffix}`,
      email: `test-${role.toLowerCase()}-${suffix}@toktickit.test`,
      passwordHash: await hashPassword(TEST_PASSWORD),
      role,
      isActive: options.isActive ?? true,
      mustChangePassword: options.mustChangePassword ?? false,
    },
  });

  await prisma.session.create({
    data: {
      id: `test-session-${user.id}`,
      userId: user.id,
      expiresAt: new Date(Date.now() + SESSION_TTL_MS),
    },
  });

  return user;
}

export const createTestRequester = (overrides: { isActive?: boolean } = {}) =>
  createTestUser({ role: "REQUESTER", ...overrides });

export const createTestStaff = (overrides: { isActive?: boolean } = {}) =>
  createTestUser({ role: "IT_STAFF", ...overrides });

export const createTestAdmin = (overrides: { isActive?: boolean } = {}) =>
  createTestUser({ role: "ADMINISTRATOR", ...overrides });

/**
 * Deletes everything created under one or more test users, in foreign-key-safe
 * order. Comments and notes are removed before the tickets they hang off, and
 * tickets owned by the user are released rather than deleted, because they may
 * belong to a different test requester.
 */
export async function cleanupUsers(userIds: Array<number | undefined>) {
  const ids = userIds.filter((id): id is number => typeof id === "number");
  if (ids.length === 0) return;

  const prisma = getPrisma();
  const tickets = await prisma.ticket.findMany({
    where: { requesterId: { in: ids } },
    select: { id: true },
  });
  const ticketIds = tickets.map((t) => t.id);

  await prisma.publicComment.deleteMany({
    where: { OR: [{ ticketId: { in: ticketIds } }, { authorId: { in: ids } }] },
  });
  await prisma.internalNote.deleteMany({
    where: { OR: [{ ticketId: { in: ticketIds } }, { authorId: { in: ids } }] },
  });

  if (ticketIds.length > 0) {
    await prisma.attachment.deleteMany({ where: { ticketId: { in: ticketIds } } });
    await prisma.ticket.deleteMany({ where: { id: { in: ticketIds } } });
  }

  // Tickets this user owned but did not raise stay, with the owner cleared.
  await prisma.ticket.updateMany({ where: { ownerId: { in: ids } }, data: { ownerId: null } });
  await prisma.attachment.updateMany({
    where: { removedById: { in: ids } },
    data: { removedById: null },
  });
  await prisma.session.deleteMany({ where: { userId: { in: ids } } });
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
}
