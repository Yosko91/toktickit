import { Router } from "express";
import {
  requireAuth,
  requirePasswordChanged,
  requireRequester,
  requireStaff,
} from "../middleware/auth.js";
import { requesterDashboard, staffDashboard } from "../services/dashboard.js";

// Lab 4 - api-spec.md section 6. Each role has its own endpoint, so the role
// check happens before any query runs (AC-18).
export const dashboardRouter = Router();

dashboardRouter.use(requireAuth, requirePasswordChanged);

// GET /api/dashboard/requester - BR-26: only the session Requester's tickets.
dashboardRouter.get("/requester", requireRequester, async (req, res) => {
  try {
    res.status(200).json(await requesterDashboard(req.user!.id));
  } catch (err) {
    console.error("[GET /api/dashboard/requester]", err);
    res.status(500).json({ error: "Unable to load the dashboard" });
  }
});

// GET /api/dashboard/staff - IT Staff and Administrators (BR-29).
dashboardRouter.get("/staff", requireStaff, async (req, res) => {
  try {
    res.status(200).json(await staffDashboard(req.user!));
  } catch (err) {
    console.error("[GET /api/dashboard/staff]", err);
    res.status(500).json({ error: "Unable to load the dashboard" });
  }
});
