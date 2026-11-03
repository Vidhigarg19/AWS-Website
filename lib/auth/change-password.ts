// ============================================================
// Change your own password — PURE orchestration over ports
// ============================================================
//
// Order matters and is tested (tests/auth/change-password.test.ts):
//
//   1. validate the request                     (never touches the network)
//   2. verify the CURRENT password              (a stolen session or an unlocked
//                                                laptop alone cannot change it)
//   3. set the new password
//   4. clear `must_change_password`             (only after step 3 worked)
//   5. sign out the account's OTHER sessions    (best effort)
//
// If step 3 fails, nothing else happens and the old password still works.
// ============================================================

import { checkNewPassword } from "./password-policy.ts";

export interface ChangePasswordPorts {
  /** True only if (email, password) signs in AND belongs to `userId`. */
  verifyCurrent(email: string, password: string, userId: string): Promise<boolean>;
  /** Throws on failure. */
  setPassword(userId: string, newPassword: string): Promise<void>;
  /** Throws on failure. A no-op for accounts that have no such flag (admins). */
  clearMustChange(userId: string): Promise<void>;
  /** Best effort: failures are swallowed by the caller of this port. */
  revokeOtherSessions(): Promise<void>;
}

export type ChangePasswordOutcome =
  | { ok: true; flagCleared: boolean; otherSessionsRevoked: boolean }
  | { ok: false; code: "invalid_input" | "weak_password" | "wrong_current"; error: string };

export async function changePassword(
  body: unknown,
  who: { userId: string; email: string | null },
  ports: ChangePasswordPorts
): Promise<ChangePasswordOutcome> {
  if (typeof body !== "object" || body === null) {
    return { ok: false, code: "invalid_input", error: "Invalid request body." };
  }
  const { currentPassword, newPassword } = body as Record<string, unknown>;
  if (typeof currentPassword !== "string" || currentPassword.length === 0 || currentPassword.length > 1024) {
    return { ok: false, code: "invalid_input", error: "Enter your current password." };
  }
  if (typeof newPassword !== "string") {
    return { ok: false, code: "invalid_input", error: "Enter a new password." };
  }

  const weak = checkNewPassword(newPassword, { currentPassword, email: who.email });
  if (weak) return { ok: false, code: "weak_password", error: weak };

  if (!who.email) {
    return { ok: false, code: "invalid_input", error: "This account has no email, so it cannot change its password here." };
  }
  const verified = await ports.verifyCurrent(who.email, currentPassword, who.userId);
  if (!verified) return { ok: false, code: "wrong_current", error: "Your current password is not correct." };

  await ports.setPassword(who.userId, newPassword); // throws -> nothing else runs

  // The password IS changed now. Make the flag follow, with one retry.
  let flagCleared = false;
  for (let attempt = 0; attempt < 2 && !flagCleared; attempt++) {
    try {
      await ports.clearMustChange(who.userId);
      flagCleared = true;
    } catch {
      /* retry once, then report */
    }
  }

  let otherSessionsRevoked = false;
  try {
    await ports.revokeOtherSessions();
    otherSessionsRevoked = true;
  } catch {
    /* best effort */
  }

  return { ok: true, flagCleared, otherSessionsRevoked };
}
