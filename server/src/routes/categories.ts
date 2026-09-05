import { Router } from "express";
import { getPrisma } from "../prisma.js";

export const categoriesRouter = Router();

// Issue 4 (Lab 1) + Lab 2 - only active Categories are exposed (handout section 6).
categoriesRouter.get("/", async (_req, res) => {
  try {
    const categories = await getPrisma().category.findMany({
      where: { isActive: true },
      orderBy: { id: "asc" },
      select: { id: true, name: true },
    });
    res.status(200).json(categories);
  } catch (err) {
    console.error("[GET /api/categories]", err);
    res.status(500).json({ error: "Unable to load categories" });
  }
});
