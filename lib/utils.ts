import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Formats a single word or sub-token (e.g. within hyphens, dots, or apostrophes)
 * so that the first letter is capitalized and the remaining letters are lowercase.
 */
function formatNameWord(word: string): string {
  if (!word) return "";
  if (word.includes("-")) {
    return word.split("-").map(formatNameWord).join("-");
  }
  if (word.includes(".")) {
    return word.split(".").map(formatNameWord).join(".");
  }
  if (word.includes("'")) {
    return word.split("'").map(formatNameWord).join("'");
  }
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}

/**
 * Formats a full name to proper Title Case:
 * - Capitalizes the first letter of every name/word (first, middle, last)
 * - Converts the rest of each word to lowercase (e.g. ASDASDASD -> Asdasdasd, RAWAT -> Rawat)
 * - Preserves spacing while typing in input fields
 * - Handles hyphenated names (Mary-Jane), initials (A.P.J., P.K.), and apostrophes (O'Connor)
 */
export function formatFullName(name: string): string {
  if (!name) return "";
  return name.split(" ").map(formatNameWord).join(" ");
}

/**
 * Final clean and formatted name for database storage and certificate generation:
 * trims leading/trailing whitespace, collapses multiple consecutive spaces,
 * and applies proper Title Case.
 */
export function cleanFullName(name: string): string {
  if (!name) return "";
  return formatFullName(name.trim().replace(/\s+/g, " "));
}
