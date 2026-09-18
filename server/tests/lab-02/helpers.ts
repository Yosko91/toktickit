import { getPrisma } from "../../src/prisma.js";

// Lab 2 fixtures. The identity helpers moved to tests/shared/auth.ts in Lab 3,
// when the X-Dev-Requester-Id header was replaced by a real session, and are
// re-exported here so the Lab 2 suites keep reading the way they did.
export {
  cookieFor,
  createTestRequester,
  createTestStaff,
  createTestAdmin,
  uniqueSuffix,
  cleanupUsers,
  cleanupUsers as cleanupRequesters,
} from "../shared/auth.js";

export async function getSeededCategory(name = "Hardware") {
  return getPrisma().category.findUniqueOrThrow({ where: { name } });
}

export async function getSeededRelatedSystem(name = "Corporate Laptop") {
  return getPrisma().relatedSystem.findUniqueOrThrow({ where: { name } });
}

export function validTicketBody(overrides: Record<string, unknown> = {}) {
  return {
    summary: "Laptop battery drains quickly",
    description: "My laptop battery is draining much faster than usual even when the system is idle.",
    requestedPriority: "MEDIUM",
    ...overrides,
  };
}
