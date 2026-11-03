// ============================================================
// Attendee import (Excel / CSV) — PURE, shared by the admin dialog and the API
// ============================================================
//
// One spreadsheet row = one attendance-portal submission. The columns are the
// four fields the portal asks for (app/attendance/page.tsx):
//
//   Full Name | Email | College ID | Course
//
// The same rules apply as in the portal: name 2-100 characters, a valid
// email, College ID digits only, and a course. The browser uses this file for
// the preview; the API runs it again because the browser cannot be trusted.
// ============================================================

import { cleanFullName } from "../utils.ts";

export const ATTENDEE_IMPORT_MAX_ROWS = 500;
export const ATTENDEE_IMPORT_MAX_FILE_BYTES = 2 * 1024 * 1024;

/** The fixed course choices in the attendance portal ("Other" = free text). */
export const PORTAL_COURSES = ["B.Tech", "BCA", "MCA", "BBA", "MBA"] as const;

export type AttendeeField = "fullName" | "email" | "collegeId" | "course";

export const ATTENDEE_FIELDS: readonly AttendeeField[] = ["fullName", "email", "collegeId", "course"];

export const ATTENDEE_FIELD_LABELS: Record<AttendeeField, string> = {
  fullName: "Full Name",
  email: "Email",
  collegeId: "College ID",
  course: "Course",
};

// Header text is matched after normalizeHeader(): lower case, anything that is
// not a letter or digit becomes one space. "Roll No." -> "roll no".
const HEADER_ALIASES: Record<string, AttendeeField> = {
  "full name": "fullName",
  name: "fullName",
  "student name": "fullName",
  "participant name": "fullName",
  email: "email",
  "e mail": "email",
  "email address": "email",
  "email id": "email",
  "mail id": "email",
  "college id": "collegeId",
  "college id no": "collegeId",
  "student id": "collegeId",
  "roll no": "collegeId",
  "roll number": "collegeId",
  "enrollment no": "collegeId",
  "enrolment no": "collegeId",
  "enrollment number": "collegeId",
  course: "course",
  program: "course",
  programme: "course",
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const HEADER_SEARCH_ROWS = 10;

export function normalizeHeader(value: unknown): string {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Turns a spreadsheet cell into text. Whole numbers keep every digit (no "2.02E+08"). */
export function cellToText(value: unknown): string {
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return "";
    return Number.isInteger(value) ? value.toFixed(0) : String(value);
  }
  if (typeof value === "string") return value.trim();
  if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
  return "";
}

/** "btech", "B. Tech" -> "B.Tech". Anything else is kept as typed (the portal's "Other"). */
export function normalizeCourse(raw: string): string {
  const text = raw.trim().replace(/\s+/g, " ");
  const key = text.toLowerCase().replace(/[^a-z]/g, "");
  const known = PORTAL_COURSES.find((c) => c.toLowerCase().replace(/[^a-z]/g, "") === key);
  return known ?? text;
}

export interface AttendeeInput {
  fullName: string;
  email: string;
  collegeId: string;
  course: string;
}

export type AttendeeValidation = { ok: true; value: AttendeeInput } | { ok: false; error: string };

/** Same checks as the attendance portal. Accepts untrusted input (used by the API). */
export function validateAttendee(raw: Partial<Record<AttendeeField, unknown>>): AttendeeValidation {
  const name = cellToText(raw.fullName).replace(/\s+/g, " ");
  if (!name) return { ok: false, error: "Full name is required." };
  if (name.length < 2) return { ok: false, error: "Full name must be at least 2 characters." };
  if (name.length > 100) return { ok: false, error: "Full name cannot exceed 100 characters." };

  const email = cellToText(raw.email).toLowerCase();
  if (!email) return { ok: false, error: "Email is required." };
  if (email.length > 254 || !EMAIL_PATTERN.test(email)) {
    return { ok: false, error: "Enter a valid email address." };
  }

  const collegeId = cellToText(raw.collegeId).replace(/\s+/g, "");
  if (!collegeId) return { ok: false, error: "College ID is required." };
  if (!/^\d+$/.test(collegeId)) return { ok: false, error: "College ID must contain only numbers." };
  if (collegeId.length > 30) return { ok: false, error: "College ID cannot exceed 30 digits." };

  const course = normalizeCourse(cellToText(raw.course));
  if (!course) return { ok: false, error: "Course is required." };
  if (course.length > 100) return { ok: false, error: "Course cannot exceed 100 characters." };

  return { ok: true, value: { fullName: cleanFullName(name), email, collegeId, course } };
}

export interface ParsedAttendeeRow {
  /** Row number as shown in Excel (1-based, header included). */
  rowNumber: number;
  /** The cells as read, for the preview table. */
  cells: Record<AttendeeField, string>;
  result: AttendeeValidation;
}

/**
 * Finds the header row (within the first rows), maps the four columns and
 * validates every data row. A repeated email is an error on its later rows.
 * Throws a readable Error when the sheet cannot be used at all.
 */
export function parseAttendeeSheet(matrix: readonly (readonly unknown[])[]): ParsedAttendeeRow[] {
  let headerIndex = -1;
  let columns: Partial<Record<AttendeeField, number>> = {};

  for (let i = 0; i < Math.min(matrix.length, HEADER_SEARCH_ROWS); i += 1) {
    const mapped: Partial<Record<AttendeeField, number>> = {};
    (matrix[i] ?? []).forEach((value, columnIndex) => {
      const field = HEADER_ALIASES[normalizeHeader(value)];
      if (field && mapped[field] === undefined) mapped[field] = columnIndex;
    });
    if (ATTENDEE_FIELDS.every((f) => mapped[f] !== undefined)) {
      headerIndex = i;
      columns = mapped;
      break;
    }
  }
  if (headerIndex < 0) {
    throw new Error("Could not find the header row. The sheet needs columns: Full Name, Email, College ID, Course.");
  }

  const rows: ParsedAttendeeRow[] = [];
  const firstRowForEmail = new Map<string, number>();

  for (let i = headerIndex + 1; i < matrix.length; i += 1) {
    const line = matrix[i] ?? [];
    const cells = {} as Record<AttendeeField, string>;
    for (const f of ATTENDEE_FIELDS) cells[f] = cellToText(line[columns[f] as number]);
    if (ATTENDEE_FIELDS.every((f) => cells[f] === "")) continue; // blank line

    const rowNumber = i + 1;
    let result = validateAttendee(cells);
    if (result.ok) {
      const earlier = firstRowForEmail.get(result.value.email);
      if (earlier !== undefined) {
        result = { ok: false, error: `This email is already on row ${earlier}.` };
      } else {
        firstRowForEmail.set(result.value.email, rowNumber);
      }
    }
    rows.push({ rowNumber, cells, result });
  }

  if (rows.length === 0) throw new Error("The sheet has a header row but no attendees under it.");
  if (rows.length > ATTENDEE_IMPORT_MAX_ROWS) {
    throw new Error(`One import can add at most ${ATTENDEE_IMPORT_MAX_ROWS} attendees. Split the sheet and import it in parts.`);
  }
  return rows;
}
