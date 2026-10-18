// ============================================================
// Certificate ID — format helpers (pure, isomorphic)
// ============================================================
//
// Format: AWS-SBG-{YEAR}-{CODE}   Example: AWS-SBG-2026-A8F92K
//
// This file MUST stay free of Node-only imports (crypto, fs, ...).
// It is imported by client components (e.g. the /verify search form), and
// any Node built-in here makes Next ship a browser polyfill (~130 KB gzip of
// crypto-browserify) to every visitor of those pages. Random generation —
// which needs crypto — lives in ./id-generator.ts (server only).
//
// ============================================================

export const CERTIFICATE_ID_PREFIX = "AWS-SBG";

const CERTIFICATE_ID_PATTERN = /^AWS-SBG-\d{4}-[A-Z2-9]{6}$/;
const CERTIFICATE_ID_YEAR_PATTERN = /^AWS-SBG-(\d{4})-[A-Z2-9]{6}$/;

/**
 * Composes a full certificate ID from a random code.
 *
 * @param code - The random code part
 * @param year - The year to include in the ID (defaults to current year)
 * @returns A certificate ID like "AWS-SBG-2026-A8F92K"
 */
export function composeCertificateId(code: string, year?: number): string {
  const y = year ?? new Date().getFullYear();
  return `${CERTIFICATE_ID_PREFIX}-${y}-${code}`;
}

/**
 * Validates the format of a certificate ID.
 *
 * @param certificateId - The certificate ID to validate
 * @returns true if the format matches AWS-SBG-{YEAR}-{CODE}
 */
export function isValidCertificateIdFormat(certificateId: string): boolean {
  return CERTIFICATE_ID_PATTERN.test(certificateId);
}

/**
 * Extracts the year from a certificate ID.
 *
 * @param certificateId - A valid certificate ID
 * @returns The year as a number, or null if invalid format
 */
export function extractYearFromCertificateId(
  certificateId: string
): number | null {
  const match = certificateId.match(CERTIFICATE_ID_YEAR_PATTERN);
  return match ? parseInt(match[1], 10) : null;
}
