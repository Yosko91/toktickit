import express from "express";
import cors from "cors";
import { getPrisma } from "./prisma.js";

export function createApp() {
  const app = express();

  app.use(cors());
  app.use(express.json());

  // Issue 2 - API health check
  app.get("/api/health", (_req, res) => {
    res.status(200).json({
      status: "ok",
      service: "TokTickIT API",
    });
  });

  // Issue 4 - Category list, read from PostgreSQL through Prisma
  app.get("/api/categories", async (_req, res) => {
    try {
      const categories = await getPrisma().category.findMany({
        orderBy: { id: "asc" },
        select: { id: true, name: true },
      });
      res.status(200).json(categories);
    } catch (err) {
      console.error("[GET /api/categories]", err);
      res.status(500).json({ error: "Unable to load categories" });
    }
  });

  return app;
}
