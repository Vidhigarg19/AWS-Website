// ============================================================
// Rules for a member's own new password — PURE (client + server)
// ============================================================
//
// Shared by the change-password form (instant feedback) and the API (the
// real check: the browser is never trusted).
//
// Length beats composition rules. We ask for a long password and refuse the
// obviously guessable ones, rather than forcing "one symbol and one digit",
// which pushes people towards "Password1!".
//
// Upper limit: 72 BYTES, because Supabase hashes with bcrypt, which ignores
// everything after byte 72. Accepting longer would silently weaken it.
// ============================================================

export const MIN_PASSWORD_LENGTH = 10;
export const MAX_PASSWORD_BYTES = 72;

// Words that make a password easy to guess wherever they appear (after we
// lowercase it and drop spaces and punctuation).
const GUESSABLE_PARTS = [
  "password", "passw0rd", "qwerty", "asdfgh", "zxcvbn", "123456", "654321", "letmein",
  "welcome", "iloveyou", "admin", "changeme", "temporary", "tulas", "awssbg", "sbgmedia",
  "mediaportal", "abcdef",
];

export interface PasswordContext {
  /** Their current (temporary) password: the new one must differ. */
  currentPassword?: string;
  /** Their email: the new password may not contain its first part. */
  email?: string | null;
}

/** null when the password is acceptable, otherwise one plain-language reason. */
export function checkNewPassword(password: unknown, ctx: PasswordContext = {}): string | null {
  if (typeof password !== "string") return "Enter a new password.";

  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  if (new TextEncoder().encode(password).length > MAX_PASSWORD_BYTES) {
    return `Too long. Use at most ${MAX_PASSWORD_BYTES} characters.`;
  }
  if (password.trim().length < MIN_PASSWORD_LENGTH) {
    return "Spaces alone do not count. Use real characters.";
  }
  if (new Set(password).size < 4) {
    return "Too repetitive. Mix in more different characters.";
  }
  if (ctx.currentPassword !== undefined && password === ctx.currentPassword) {
    return "The new password must be different from your current one.";
  }

  const flat = password.toLowerCase().replace(/[^a-z0-9]/g, "");

  const local = (ctx.email ?? "").split("@")[0].toLowerCase().replace(/[^a-z0-9]/g, "");
  if (local.length >= 4 && flat.includes(local)) {
    return "Do not include your email name in your password.";
  }
  if (GUESSABLE_PARTS.some((p) => flat.includes(p))) {
    return "That is too easy to guess. Try a few unrelated words, or a sentence.";
  }
  return null;
}
