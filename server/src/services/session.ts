import { randomBytes } from "node:crypto";
import { getPrisma } from "../prisma.js";

export const SESSION_COOKIE = "toktickit.sid";

// BR-09: eight hours, long enough for a working day, short enough that a
// forgotten session on a shared machine expires by itself.
export const SESSION_TTL_MS = 8 * 60 * 60 * 1000;

function newToken(): string {
  return randomBytes(32).toString("hex");
}

export async function createSession(userId: number) {
  return getPrisma().session.create({
    data: {
      id: newToken(),
      userId,
      expiresAt: new Date(Date.now() + SESSION_TTL_MS),
    },
  });
}

/**
 * BR-09: an unknown or expired session is indistinguishable from no session at
 * all. Expired rows are deleted on the way past rather than by a scheduled job.
 */
export async function findValidSession(token: string) {
  const prisma = getPrisma();
  const session = await prisma.session.findUnique({
    where: { id: token },
    include: { user: true },
  });

  if (!session) return null;

  if (session.expiresAt.getTime() <= Date.now()) {
    await prisma.session.delete({ where: { id: token } }).catch(() => undefined);
    return null;
  }

  return session;
}

export async function destroySession(token: string): Promise<void> {
  await getPrisma().session.delete({ where: { id: token } }).catch(() => undefined);
}

// BR-07: used after a password change, keeping the session that performed it.
export async function destroyOtherSessions(userId: number, keepToken: string): Promise<void> {
  await getPrisma().session.deleteMany({ where: { userId, NOT: { id: keepToken } } });
}

// BR-37: an administrator setting a new initial password logs that user out everywhere.
export async function destroyUserSessions(userId: number): Promise<void> {
  await getPrisma().session.deleteMany({ where: { userId } });
}
