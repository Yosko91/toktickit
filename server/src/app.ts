import fs from "node:fs";
import path from "node:path";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import multer from "multer";
import { authRouter } from "./routes/auth.js";
import { categoriesRouter } from "./routes/categories.js";
import { relatedSystemsRouter } from "./routes/relatedSystems.js";
import { ticketsRouter } from "./routes/tickets.js";
import { staffTicketsRouter } from "./routes/staffTickets.js";
import { adminUsersRouter } from "./routes/adminUsers.js";
import { attachmentsRouter } from "./routes/attachments.js";
import { dashboardRouter } from "./routes/dashboard.js";
import { UnsupportedAttachmentTypeError } from "./services/attachmentStorage.js";
import { getPrisma } from "./prisma.js";

// The client origin must be named explicitly rather than reflected, because a
// wildcard origin is not allowed together with credentials, and the session
// cookie is a credential (api-spec.md section 1).
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN ?? "http://localhost:5173";

export function createApp() {
  const app = express();

  app.use(cors({ origin: CLIENT_ORIGIN, credentials: true }));
  app.use(express.json());
  app.use(cookieParser());

  // Issue 2 - API health check
  app.get("/api/health", (_req, res) => {
    res.status(200).json({
      status: "ok",
      service: "TokTickIT API",
    });
  });

  // Lab 5 - R-08: the commit the running image was built from.
  app.get("/api/version", (_req, res) => {
    res.status(200).json({ commit: process.env.COMMIT_SHA || "local" });
  });

  // Lab 5 - readiness: the app can reach the database (used by the smoke test).
  app.get("/api/ready", async (_req, res) => {
    try {
      await getPrisma().$queryRaw`SELECT 1`;
      res.status(200).json({ status: "ready", db: "connected" });
    } catch (err) {
      console.error("[GET /api/ready]", err);
      res.status(503).json({ status: "not ready", db: "disconnected" });
    }
  });

  app.use("/api/auth", authRouter);
  app.use("/api/categories", categoriesRouter);
  app.use("/api/related-systems", relatedSystemsRouter);
  app.use("/api/tickets", ticketsRouter);
  app.use("/api/staff", staffTicketsRouter);
  app.use("/api/admin/users", adminUsersRouter);
  app.use("/api/attachments", attachmentsRouter);
  app.use("/api/dashboard", dashboardRouter);

  // Lab 5: in the Docker image the built React app is served by this server, so
  // UI and API share one URL. Not set in local dev (Vite serves the UI).
  const CLIENT_DIST_DIR = process.env.CLIENT_DIST_DIR;
  if (CLIENT_DIST_DIR && fs.existsSync(path.join(CLIENT_DIST_DIR, "index.html"))) {
    app.use(express.static(CLIENT_DIST_DIR));
    // React Router pages (/login, /tickets/12...) all load index.html.
    app.get(/^\/(?!api(\/|$)).*/, (_req, res) => {
      res.sendFile(path.join(CLIENT_DIST_DIR, "index.html"));
    });
  }

  // BR-22/BR-23 (Lab 2): multer surfaces attachment type/size failures as errors
  // rather than calling next() with a handled response, so they are mapped
  // to their documented status codes here (api-spec.md "HTTP status summary").
  app.use(
    (
      err: unknown,
      _req: express.Request,
      res: express.Response,
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      _next: express.NextFunction
    ) => {
      if (err instanceof UnsupportedAttachmentTypeError) {
        res.status(415).json({ error: "Attachment type not permitted" });
        return;
      }
      if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
        res.status(413).json({ error: "Attachment exceeds the 5 MB limit" });
        return;
      }
      console.error("[unhandled]", err);
      res.status(500).json({ error: "Unexpected server error" });
    }
  );

  return app;
}
