import { Router } from "express";
import type { Prisma, Role } from "@prisma/client";
import { getPrisma } from "../prisma.js";
import { requireAdministrator, requireAuth, requirePasswordChanged } from "../middleware/auth.js";
import { hashPassword, validatePassword } from "../services/password.js";
import { destroyUserSessions } from "../services/session.js";
import {
  LastAdministratorError,
  ROLES,
  couldRemoveAnAdministrator,
  validateCreateUser,
  validateUpdateUser,
} from "../services/userAdmin.js";

export const adminUsersRouter = Router();

// BR-15: every route here is Administrator-only. IT Staff do not gain user
// management just because they hold the ticket operations (BR-16).
adminUsersRouter.use(requireAuth, requirePasswordChanged, requireAdministrator);

/** BR-38: the administrator list shape. A password hash is never in it. */
const USER_SELECT = {
  id: true,
  name: true,
  email: true,
  role: true,
  isActive: true,
  mustChangePassword: true,
  createdAt: true,
} satisfies Prisma.UserSelect;

// GET /api/admin/users - FR-16. No pagination by scope decision (labsheet 4.2).
adminUsersRouter.get("/", async (req, res) => {
  const { search, role } = req.query as { search?: string; role?: string };

  if (role !== undefined && !ROLES.includes(role as Role)) {
    res.status(400).json({
      error: "Invalid query parameter",
      details: { role: `Must be one of ${ROLES.join(", ")}` },
    });
    return;
  }

  try {
    const where: Prisma.UserWhereInput = {};
    const term = search?.trim();
    if (term) {
      where.OR = [
        { name: { contains: term, mode: "insensitive" } },
        { email: { contains: term, mode: "insensitive" } },
      ];
    }
    if (role) {
      where.role = role as Role;
    }

    const users = await getPrisma().user.findMany({
      where,
      orderBy: { name: "asc" },
      select: USER_SELECT,
    });

    res.status(200).json(users);
  } catch (err) {
    console.error("[GET /api/admin/users]", err);
    res.status(500).json({ error: "Unable to load users" });
  }
});

// POST /api/admin/users - FR-17, BR-32, BR-33.
adminUsersRouter.post("/", async (req, res) => {
  const result = validateCreateUser(req.body);
  if (!result.valid) {
    res.status(400).json({ error: "Validation failed", details: result.errors });
    return;
  }
  const { name, email, role, isActive, initialPassword } = result.value!;

  try {
    const prisma = getPrisma();

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      res.status(409).json({
        error: "Validation failed",
        details: { email: "An account with this email address already exists" },
      });
      return;
    }

    const user = await prisma.user.create({
      data: {
        name,
        email,
        role,
        isActive,
        passwordHash: await hashPassword(initialPassword),
        // BR-32: an account created by somebody else always starts with a
        // password its owner has to replace.
        mustChangePassword: true,
      },
      select: USER_SELECT,
    });

    res.status(201).json(user);
  } catch (err) {
    console.error("[POST /api/admin/users]", err);
    res.status(500).json({ error: "Unable to create the user" });
  }
});

// PATCH /api/admin/users/:id - FR-18, BR-33 to BR-36.
adminUsersRouter.patch("/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const result = validateUpdateUser(req.body);
  if (!result.valid) {
    res.status(400).json({ error: "Validation failed", details: result.errors });
    return;
  }
  const update = result.value!;

  try {
    const prisma = getPrisma();
    const current = await prisma.user.findUnique({ where: { id } });
    if (!current) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    // BR-34: an Administrator cannot lock themselves out or demote themselves.
    // This is separate from BR-35 because it applies even when other active
    // Administrators exist.
    if (id === req.user!.id) {
      if (update.isActive === false) {
        res.status(403).json({ error: "You cannot deactivate your own account" });
        return;
      }
      if (update.role !== undefined && update.role !== current.role) {
        res.status(403).json({ error: "You cannot change your own role" });
        return;
      }
    }

    if (update.email && update.email !== current.email) {
      const clash = await prisma.user.findUnique({ where: { email: update.email } });
      if (clash) {
        res.status(409).json({
          error: "Validation failed",
          details: { email: "An account with this email address already exists" },
        });
        return;
      }
    }

    let updated;

    if (couldRemoveAnAdministrator(current, update)) {
      // BR-35: the write and the check happen in one serialisable transaction.
      // Doing it as a read-then-write would let two concurrent requests each
      // see one remaining administrator and both proceed, leaving none.
      updated = await prisma.$transaction(
        async (tx) => {
          const row = await tx.user.update({ where: { id }, data: update, select: USER_SELECT });

          const remaining = await tx.user.count({
            where: { role: "ADMINISTRATOR", isActive: true },
          });
          if (remaining === 0) {
            throw new LastAdministratorError();
          }

          return row;
        },
        { isolationLevel: "Serializable" }
      );
    } else {
      updated = await prisma.user.update({ where: { id }, data: update, select: USER_SELECT });
    }

    res.status(200).json(updated);
  } catch (err) {
    if (err instanceof LastAdministratorError) {
      res.status(409).json({ error: err.message });
      return;
    }
    console.error("[PATCH /api/admin/users/:id]", err);
    res.status(500).json({ error: "Unable to update the user" });
  }
});

// POST /api/admin/users/:id/initial-password - FR-19, BR-37.
adminUsersRouter.post("/:id/initial-password", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const { initialPassword } = req.body ?? {};
  const failure = validatePassword(initialPassword);
  if (failure) {
    res.status(400).json({ error: "Validation failed", details: { initialPassword: failure } });
    return;
  }

  try {
    const prisma = getPrisma();
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const updated = await prisma.user.update({
      where: { id },
      data: {
        passwordHash: await hashPassword(initialPassword as string),
        mustChangePassword: true,
      },
      select: USER_SELECT,
    });

    // BR-37: whoever was using the old password is signed out everywhere. This
    // is the point of the operation - it is used when an account may be
    // compromised or its owner is locked out.
    await destroyUserSessions(id);

    res.status(200).json(updated);
  } catch (err) {
    console.error("[POST /api/admin/users/:id/initial-password]", err);
    res.status(500).json({ error: "Unable to set the initial password" });
  }
});

// Kept for completeness of the module's own contract: nothing in Lab 3 deletes
// a user (BR-36). The route exists only to answer clearly rather than 404.
adminUsersRouter.delete("/:id", (_req, res) => {
  res.status(405).json({
    error: "Users are deactivated, not deleted. Set isActive to false instead.",
  });
});
