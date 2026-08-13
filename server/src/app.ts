import express from "express";

export function createApp() {
  const app = express();
  app.use(express.json());

  app.get("/api/health", (_req, res) => {
    res.status(200).json({
      status: "ok",
      service: "TokTickIT API"
    });
  });

  app.get("/api/categories", async (_req, res) => {
    const categories = [
      { id: 1, name: "Hardware" },
      { id: 2, name: "Software" },
      { id: 3, name: "Network" },
      { id: 4, name: "Security" }
    ];
    res.json(categories);
  });

  return app;
}