import express from "express";

export function createApp() {
  const app = express();
  app.use(express.json());

  // Health check endpoint requis par l'Issue 2
  app.get("/api/health", (_req, res) => {
    res.status(200).json({
      status: "ok",
      service: "TokTickIT API"
    });
  });

  return app;
}