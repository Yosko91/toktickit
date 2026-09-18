import type { Role } from "@prisma/client";
import { validatePassword } from "./password.js";

// Validation and the safety rules for Administrator user management
// (specification.md BR-32 to BR-38).

export const ROLES: Role[] = ["REQUESTER", "IT_STAFF", "ADMINISTRATOR"];

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export class LastAdministratorError extends Error {
  constructor() {
    super("The last active administrator cannot be deactivated or demoted");
    this.name = "LastAdministratorError";
  }
}

export interface ValidationResult<T> {
  valid: boolean;
  value?: T;
  errors?: Record<string, string>;
}

export interface CreateUserInput {
  name: string;
  email: string;
  role: Role;
  isActive: boolean;
  initialPassword: string;
}

function validateName(raw: unknown, errors: Record<string, string>): string | undefined {
  if (typeof raw !== "string" || raw.trim().length < 2) {
    errors.name = "A name of at least 2 characters is required";
    return undefined;
  }
  return raw.trim();
}

function validateEmail(raw: unknown, errors: Record<string, string>): string | undefined {
  if (typeof raw !== "string" || !EMAIL_PATTERN.test(raw.trim())) {
    errors.email = "A valid email address is required";
    return undefined;
  }
  // BR-10: stored lower-cased so the unique index is effectively
  // case-insensitive without needing a functional index.
  return raw.trim().toLowerCase();
}

function validateRole(raw: unknown, errors: Record<string, string>): Role | undefined {
  if (typeof raw !== "string" || !ROLES.includes(raw as Role)) {
    errors.role = `Must be one of ${ROLES.join(", ")}`;
    return undefined;
  }
  return raw as Role;
}

// BR-32
export function validateCreateUser(body: unknown): ValidationResult<CreateUserInput> {
  const input = (body ?? {}) as Record<string, unknown>;
  const errors: Record<string, string> = {};

  const name = validateName(input.name, errors);
  const email = validateEmail(input.email, errors);
  const role = validateRole(input.role, errors);

  const passwordFailure = validatePassword(input.initialPassword);
  if (passwordFailure) {
    errors.initialPassword = passwordFailure;
  }

  if (input.isActive !== undefined && typeof input.isActive !== "boolean") {
    errors.isActive = "Must be true or false";
  }

  if (Object.keys(errors).length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    value: {
      name: name!,
      email: email!,
      role: role!,
      isActive: input.isActive === undefined ? true : (input.isActive as boolean),
      initialPassword: input.initialPassword as string,
    },
  };
}

export interface UpdateUserInput {
  name?: string;
  email?: string;
  role?: Role;
  isActive?: boolean;
}

// BR-18 of the labsheet: name, email, role and activation state, nothing else.
// A field that is absent is left alone; a field that is present is validated.
export function validateUpdateUser(body: unknown): ValidationResult<UpdateUserInput> {
  const input = (body ?? {}) as Record<string, unknown>;
  const errors: Record<string, string> = {};
  const value: UpdateUserInput = {};

  if (input.name !== undefined) {
    const name = validateName(input.name, errors);
    if (name) value.name = name;
  }
  if (input.email !== undefined) {
    const email = validateEmail(input.email, errors);
    if (email) value.email = email;
  }
  if (input.role !== undefined) {
    const role = validateRole(input.role, errors);
    if (role) value.role = role;
  }
  if (input.isActive !== undefined) {
    if (typeof input.isActive !== "boolean") {
      errors.isActive = "Must be true or false";
    } else {
      value.isActive = input.isActive;
    }
  }

  if (Object.keys(errors).length > 0) {
    return { valid: false, errors };
  }
  if (Object.keys(value).length === 0) {
    return { valid: false, errors: { body: "No changes were supplied" } };
  }

  return { valid: true, value };
}

/**
 * BR-35 applies whenever a change could remove an active Administrator, which
 * is either deactivating one or moving one to another role.
 */
export function couldRemoveAnAdministrator(
  current: { role: Role; isActive: boolean },
  update: UpdateUserInput
): boolean {
  if (current.role !== "ADMINISTRATOR" || !current.isActive) return false;
  return update.isActive === false || (update.role !== undefined && update.role !== "ADMINISTRATOR");
}
