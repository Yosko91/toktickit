// BR-06. This mirrors server/src/services/password.ts so the Change Password
// checklist and the backend never disagree about what a valid password is. The
// server remains the authority: this copy only drives the live feedback.

export const PASSWORD_RULES = [
  { id: "length", label: "At least 8 characters", test: (v: string) => v.length >= 8 },
  { id: "upper", label: "An upper case letter", test: (v: string) => /[A-Z]/.test(v) },
  { id: "lower", label: "A lower case letter", test: (v: string) => /[a-z]/.test(v) },
  { id: "digit", label: "A number", test: (v: string) => /[0-9]/.test(v) },
  { id: "special", label: "A special character", test: (v: string) => /[^A-Za-z0-9]/.test(v) },
];

export function passwordMeetsAllRules(value: string): boolean {
  return PASSWORD_RULES.every((rule) => rule.test(value));
}
