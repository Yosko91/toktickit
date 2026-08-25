import { Router } from "express";
import { getPrisma } from "../prisma.js";

export const requestersRouter = Router();

// BR-06/BR-30 - inactive Requesters never appear in the selector.
requestersRouter.get("/", async (_req, res) => {
  try {
    const requesters = await getPrisma().requesterUser.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, email: true },
    });
    res.status(200).json(requesters);
  } catch (err) {
    console.error("[GET /api/requesters]", err);
    res.status(500).json({ error: "Unable to load requesters" });
  }
});
