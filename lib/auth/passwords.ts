// ============================================================
// Temporary password generator (SERVER ONLY)
// ============================================================
//
// Used when a super admin creates or resets a media-member account. The
// password is shown to the super admin exactly once and never stored.
//
// - crypto.randomInt is unbiased (unlike `randomByte % length`).
// - Ambiguous characters (0 O 1 l I) are left out so it can be read aloud
//   or typed from a chat message without mistakes.
// - Guaranteed to contain a lowercase letter, an uppercase letter and a digit
//   so it satisfies common Supabase password rules.
//
// Do not import this from client components (it pulls in Node crypto).
// ============================================================

import { randomInt } from "node:crypto";

const LOWER = "abcdefghijkmnopqrstuvwxyz";
const UPPER = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const DIGITS = "23456789";
const ALPHABET = LOWER + UPPER + DIGITS;

function pick(chars: string): string {
  return chars[randomInt(chars.length)];
}

export function generateTempPassword(length = 16): string {
  if (length < 12) throw new Error("Temporary passwords must be at least 12 characters.");

  while (true) {
    let out = "";
    for (let i = 0; i < length; i++) out += pick(ALPHABET);
    if (/[a-z]/.test(out) && /[A-Z]/.test(out) && /[0-9]/.test(out)) return out;
  }
}
