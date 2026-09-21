import bcrypt from "bcryptjs";

// BR-04: bcrypt with a per-password salt. Cost 10 is the usual default and is
// slow enough to matter against offline guessing without making the API tests
// take minutes.
const BCRYPT_COST = 10;

export const MIN_PASSWORD_LENGTH = 8;

// BR-06. The order here is the order the Change Password screen shows the
// checklist in, so the interface and the server never disagree about the rules.
export const PASSWORD_RULES: { id: string; label: string; test: (v: string) => boolean }[] = [
  { id: "length", label: `At least ${MIN_PASSWORD_LENGTH} characters`, test: (v) => v.length >= MIN_PASSWORD_LENGTH },
  { id: "upper", label: "An upper case letter", test: (v) => /[A-Z]/.test(v) },
  { id: "lower", label: "A lower case letter", test: (v) => /[a-z]/.test(v) },
  { id: "digit", label: "A number", test: (v) => /[0-9]/.test(v) },
  { id: "special", label: "A special character", test: (v) => /[^A-Za-z0-9]/.test(v) },
];

/**
 * BR-06. Returns null when the password is acceptable, otherwise the message
 * for the first rule it breaks.
 */
export function validatePassword(value: unknown): string | null {
  if (typeof value !== "string" || value.length === 0) {
    return "A new password is required";
  }
  const broken = PASSWORD_RULES.find((rule) => !rule.test(value));
  return broken ? `The password must contain: ${broken.label.toLowerCase()}` : null;
}

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_COST);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}
