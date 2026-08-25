import { Router } from "express";
import { getPrisma } from "../prisma.js";

export const relatedSystemsRouter = Router();

// Lab 2 - only active Related Systems are exposed (handout section 6).
relatedSystemsRouter.get("/", async (_req, res) => {
  try {
    const relatedSystems = await getPrisma().relatedSystem.findMany({
      where: { isActive: true },
      orderBy: { id: "asc" },
      select: { id: true, name: true },
    });
    res.status(200).json(relatedSystems);
  } catch (err) {
    console.error("[GET /api/related-systems]", err);
    res.status(500).json({ error: "Unable to load related systems" });
  }
});
