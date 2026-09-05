import express from "express";
import cors from "cors";
import multer from "multer";
import { categoriesRouter } from "./routes/categories.js";
import { relatedSystemsRouter } from "./routes/relatedSystems.js";
import { requestersRouter } from "./routes/requesters.js";
import { ticketsRouter } from "./routes/tickets.js";
import { attachmentsRouter } from "./routes/attachments.js";
import { UnsupportedAttachmentTypeError } from "./services/attachmentStorage.js";

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

  app.use("/api/categories", categoriesRouter);
  app.use("/api/related-systems", relatedSystemsRouter);
  app.use("/api/requesters", requestersRouter);
  app.use("/api/tickets", ticketsRouter);
  app.use("/api/attachments", attachmentsRouter);

  // BR-22/BR-23: multer surfaces attachment type/size failures as errors
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
