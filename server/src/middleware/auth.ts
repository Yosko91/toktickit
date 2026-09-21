import type { NextFunction, Request, Response } from "express";
import type { Role, User } from "@prisma/client";
import { SESSION_COOKIE, findValidSession } from "../services/session.js";

// Lab 3 replaces the Lab 2 X-Dev-Requester-Id header entirely (BR-03). Identity
// comes from the session row behind an httpOnly cookie and nothing the client
// sends in a body or a header can change who it is acting as.

export interface AuthUser {
  id: number;
  name: string;
  email: string;
  role: Role;
  mustChangePassword: boolean;
}

declare module "express-serve-static-core" {
  interface Request {
    user?: AuthUser;
    sessionToken?: string;
  }
}

/** BR-38: the only user shape any endpoint is allowed to return. */
export function publicUser(user: User): AuthUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    mustChangePassword: user.mustChangePassword,
  };
}

/** BR-12: no valid session means 401, never 403. */
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies?.[SESSION_COOKIE];

  if (typeof token !== "string" || token.length === 0) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  try {
    const session = await findValidSession(token);

    if (!session) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }
    // BR-01: deactivating an account takes effect on the next request, without
    // waiting for the session to expire.
    if (!session.user.isActive) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }

    req.user = publicUser(session.user);
    req.sessionToken = token;
    next();
  } catch (err) {
    console.error("[requireAuth]", err);
    res.status(500).json({ error: "Unable to verify the session" });
  }
}

/**
 * BR-02: an account holding an initial password can reach current-user,
 * password change and logout, and nothing else. The distinct `code` lets the
 * client redirect to the change screen instead of showing an error.
 */
export function requirePasswordChanged(req: Request, res: Response, next: NextFunction) {
  if (req.user?.mustChangePassword) {
    res.status(403).json({
      error: "You must change your password before continuing",
      code: "PASSWORD_CHANGE_REQUIRED",
    });
    return;
  }
  next();
}

/** BR-12/BR-15: authenticated but wrong role is 403. */
export function requireRole(...roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      res.status(403).json({ error: "You do not have permission to perform this action" });
      return;
    }
    next();
  };
}

// BR-16: IT Staff and Administrator hold the same Ticket operation rights.
export const requireStaff = requireRole("IT_STAFF", "ADMINISTRATOR");
export const requireRequester = requireRole("REQUESTER");
export const requireAdministrator = requireRole("ADMINISTRATOR");
