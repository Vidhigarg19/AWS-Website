// ============================================================
// Certificate ID Generator
// ============================================================
//
// Format: AWS-SBG-{YEAR}-{CODE}
// Example: AWS-SBG-2026-A8F92K
//
// Character set (30 chars): ABCDEFGHJKMNPQRSTUVWXYZ23456789
// Excludes ambiguous: 0, O, 1, I, L
// 30^6 = 729,000,000 unique combinations per year
//
// ============================================================

import crypto from "crypto";
import { composeCertificateId } from "./id-format";

// Format helpers live in ./id-format (no Node imports) so client components can
// use them without bundling crypto. Re-exported here so server callers keep
// importing from one place.
export {
  composeCertificateId,
  isValidCertificateIdFormat,
  extractYearFromCertificateId,
} from "./id-format";

/** Unambiguous character set — excludes 0/O, 1/I/L */
const CHARSET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 6;
const MAX_GENERATION_ATTEMPTS = 10;

/**
 * Generates a cryptographically random alphanumeric code
 * using the unambiguous character set.
 */
function generateRandomCode(length: number = CODE_LENGTH): string {
  const bytes = crypto.randomBytes(length);
  let code = "";
  for (let i = 0; i < length; i++) {
    code += CHARSET[bytes[i] % CHARSET.length];
  }
  return code;
}

/**
 * Generates a unique certificate ID.
 *
 * In Phase 1 (no database), this just generates a random ID.
 * In Phase 2+, the `existsCheck` callback verifies uniqueness against the DB.
 *
 * @param existsCheck - Optional async function that returns true if the ID already exists
 * @param year - Optional year override (defaults to current year)
 * @returns A unique certificate ID
 * @throws Error if unable to generate a unique ID after max attempts
 */
export async function generateCertificateId(
  existsCheck?: (certificateId: string) => Promise<boolean>,
  year?: number
): Promise<string> {
  for (let attempt = 0; attempt < MAX_GENERATION_ATTEMPTS; attempt++) {
    const code = generateRandomCode();
    const certificateId = composeCertificateId(code, year);

    // If no uniqueness check is provided, trust randomness
    if (!existsCheck) {
      return certificateId;
    }

    const exists = await existsCheck(certificateId);
    if (!exists) {
      return certificateId;
    }

    console.warn(
      `[CertificateID] Collision detected for ${certificateId}, retrying (attempt ${attempt + 1}/${MAX_GENERATION_ATTEMPTS})`
    );
  }

  throw new Error(
    `Failed to generate a unique certificate ID after ${MAX_GENERATION_ATTEMPTS} attempts. This is extremely unlikely and may indicate a database issue.`
  );
}
