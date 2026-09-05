import type { NextFunction, Request, Response } from "express";
import { getPrisma } from "../prisma.js";

// Lab 2 - BR-05/BR-08: this is the "Development Requester" testing mechanism,
// not authentication. Every Ticket/Attachment endpoint requires the caller to
// identify itself with this header; the backend still enforces real ownership
// checks against it (BR-13), which is what makes it useful to test now and
// safe to swap for a real session in Lab 3 (BR-33).
const HEADER_NAME = "x-dev-requester-id";

export interface RequesterIdentity {
  id: number;
  name: string;
  email: string;
}

declare module "express-serve-static-core" {
  interface Request {
    requester?: RequesterIdentity;
  }
}

export async function requireDevRequester(req: Request, res: Response, next: NextFunction) {
  const raw = req.header(HEADER_NAME);
  const id = raw ? Number(raw) : NaN;

  if (!raw || !Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: "X-Dev-Requester-Id header is required" });
    return;
  }

  try {
    const requester = await getPrisma().requesterUser.findUnique({ where: { id } });

    if (!requester) {
      res.status(404).json({ error: "Requester not found" });
      return;
    }
    if (!requester.isActive) {
      res.status(403).json({ error: "Requester is inactive" });
      return;
    }

    req.requester = { id: requester.id, name: requester.name, email: requester.email };
    next();
  } catch (err) {
    console.error("[requireDevRequester]", err);
    res.status(500).json({ error: "Unable to verify requester identity" });
  }
}
