// BR-29: the same rule for Public Comments and Internal Notes.

export const MAX_MESSAGE_LENGTH = 2000;

export interface MessageValidationResult {
  valid: boolean;
  value?: string;
  error?: string;
}

export function validateMessageBody(raw: unknown): MessageValidationResult {
  if (typeof raw !== "string") {
    return { valid: false, error: "A message is required" };
  }

  const value = raw.trim();

  if (value.length === 0) {
    return { valid: false, error: "A message cannot be empty" };
  }
  if (value.length > MAX_MESSAGE_LENGTH) {
    return { valid: false, error: `A message cannot be longer than ${MAX_MESSAGE_LENGTH} characters` };
  }

  return { valid: true, value };
}
