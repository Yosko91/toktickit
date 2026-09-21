import { Router } from "express";
import { getPrisma } from "../prisma.js";
import { publicUser, requireAuth } from "../middleware/auth.js";
import { hashPassword, validatePassword, verifyPassword } from "../services/password.js";
import {
  SESSION_COOKIE,
  SESSION_TTL_MS,
  createSession,
  destroyOtherSessions,
  destroySession,
} from "../services/session.js";

export const authRouter = Router();

// BR-05: one message for every login failure. An attacker must not be able to
// tell an unknown address from a known one with a wrong password, or from a
// deactivated account.
const GENERIC_LOGIN_FAILURE = "Invalid email or password";

const COOKIE_OPTIONS = {
  httpOnly: true as const,
  sameSite: "lax" as const,
  // Secure is deliberately off: the lab runs over plain HTTP on localhost. It
  // must be switched on for any real deployment (api-spec.md section 1).
  secure: false,
  path: "/",
  maxAge: SESSION_TTL_MS,
};

// POST /api/auth/login - FR-01, BR-01, BR-05, BR-10.
authRouter.post("/login", async (req, res) => {
  const { email, password } = req.body ?? {};

  if (typeof email !== "string" || typeof password !== "string" || !email || !password) {
    res.status(400).json({ error: "Email and password are required" });
    return;
  }

  try {
    const user = await getPrisma().user.findUnique({
      where: { email: email.trim().toLowerCase() },
    });

    // The password is verified even when the account is missing or inactive, so
    // that a failed login always costs the same amount of time and the response
    // cannot be distinguished by how long it took.
    const hash = user?.passwordHash ?? "$2b$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidinv";
    const passwordMatches = await verifyPassword(password, hash);

    if (!user || !user.isActive || !passwordMatches) {
      res.status(401).json({ error: GENERIC_LOGIN_FAILURE });
      return;
    }

    const session = await createSession(user.id);
    res.cookie(SESSION_COOKIE, session.id, COOKIE_OPTIONS);
    res.status(200).json(publicUser(user));
  } catch (err) {
    console.error("[POST /api/auth/login]", err);
    res.status(500).json({ error: "Unable to sign in" });
  }
});

// POST /api/auth/logout - FR-02, BR-08.
authRouter.post("/logout", requireAuth, async (req, res) => {
  try {
    await destroySession(req.sessionToken!);
    res.clearCookie(SESSION_COOKIE, { ...COOKIE_OPTIONS, maxAge: undefined });
    res.status(204).send();
  } catch (err) {
    console.error("[POST /api/auth/logout]", err);
    res.status(500).json({ error: "Unable to sign out" });
  }
});

// GET /api/auth/me - FR-03. Reachable with a pending password change (BR-02),
// because the client needs to know that is why it is being redirected.
authRouter.get("/me", requireAuth, (req, res) => {
  res.status(200).json(req.user);
});

// POST /api/auth/change-password - FR-04, BR-06, BR-07.
authRouter.post("/change-password", requireAuth, async (req, res) => {
  const { currentPassword, newPassword } = req.body ?? {};

  if (typeof currentPassword !== "string" || currentPassword.length === 0) {
    res.status(400).json({
      error: "Validation failed",
      details: { currentPassword: "Your current password is required" },
    });
    return;
  }

  const ruleFailure = validatePassword(newPassword);
  if (ruleFailure) {
    res.status(400).json({ error: "Validation failed", details: { newPassword: ruleFailure } });
    return;
  }

  if (currentPassword === newPassword) {
    res.status(400).json({
      error: "Validation failed",
      details: { newPassword: "The new password must be different from the current one" },
    });
    return;
  }

  try {
    const prisma = getPrisma();
    const user = await prisma.user.findUnique({ where: { id: req.user!.id } });

    if (!user || !(await verifyPassword(currentPassword, user.passwordHash))) {
      res.status(400).json({
        error: "Validation failed",
        details: { currentPassword: "Your current password is not correct" },
      });
      return;
    }

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await hashPassword(newPassword as string), mustChangePassword: false },
    });

    // BR-07: every other session of this user stops working, in case the old
    // password was known to somebody else.
    await destroyOtherSessions(user.id, req.sessionToken!);

    res.status(200).json(publicUser(updated));
  } catch (err) {
    console.error("[POST /api/auth/change-password]", err);
    res.status(500).json({ error: "Unable to change the password" });
  }
});
