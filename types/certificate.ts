// ============================================================
// Certificate System — Core Types (V2)
// ============================================================
//
// Matches supabase_schema_v2.sql exactly.
// No enums. No unnecessary timestamps.
//
// ============================================================

// ============================================================
// Database Models
// ============================================================

export interface DbParticipant {
  id: string;
  full_name: string;
  email: string;
  course: string;
  roll_no: string;
}

export interface DbEvent {
  id: string;
  name: string;
  description: string | null;
  event_date: string | null;       // ISO date string (YYYY-MM-DD) or null if TBA
  event_timing: string | null;     // Display-oriented, e.g. "11:00 AM - 12:30 PM" or null if TBA
  speaker_name: string | null;
  attendance_open: boolean;
}

export interface DbAttendance {
  id: string;
  event_id: string;
  participant_id: string;
  submitted_at: string;     // ISO timestamp
}

export interface DbCertificate {
  id: string;
  certificate_id: string;
  event_id: string;
  participant_id: string;
  attendance_id: string;
  recipient_name_snapshot: string;
  event_name_snapshot: string;
  event_date_snapshot: string;   // ISO date string
  pdf_url: string | null;
  verification_url: string;
  pdf_hash: string | null;
  issue_date: string;            // ISO date string
}

export interface DbPortalConfig {
  id: string;
  active_event_id: string | null;
  attendance_enabled: boolean;
}

export interface DbTeamMember {
  id: string;
  name: string;
  pic_url: string | null;
  course: string;
  branch: string;
  year: string;
  role: string;
  batch: string; // e.g. "2026-27", "2027-28"
  display_order: number;
  created_at: string;
  updated_at: string;
}

/**
 * Admin: Create/Update team member request.
 */
export interface AdminTeamMemberRequest {
  name: string;
  picUrl?: string | null;
  course: string;
  branch: string;
  year: string;
  role: string;
  batch?: string; // e.g. "2026-27", "2027-28"
  displayOrder?: number;
}

// ============================================================
// Certificate Generation
// ============================================================

/**
 * Input data required to generate a single certificate.
 */
export interface CertificateGenerationInput {
  participantName: string;
  eventTitle: string;
  eventDate: string;           // ISO date string or formatted date
  certificateId?: string;      // Optional pre-generated certificate ID
  achievementText?: string;    // Custom achievement text; falls back to default
  signerName?: string;         // Custom signer name; falls back to default
  signerTitle?: string;        // Custom signer title; falls back to default
}

/**
 * Result of a single certificate generation.
 */
export interface CertificateGenerationResult {
  success: boolean;
  certificateId?: string;
  pdfBuffer?: Buffer;
  error?: string;
}

// ============================================================
// API Types
// ============================================================

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

/**
 * Public-facing verification result.
 */
export type CertificatePublicStatus = "VALID" | "NOT_FOUND";

export interface CertificateVerificationResponse {
  valid: boolean;
  status: CertificatePublicStatus;
  certificateId: string;
  certificate?: {
    certificateId: string;
    recipientName: string;
    course: string;
    rollNo: string;
    eventName: string;
    eventDate: string;
    issueDate: string;
    issuedBy: string;
    awardTitle?: string;
  };
  error?: string;
  verifiedAt: string;
}

/**
 * Attendance submission request body (from student form).
 */
export interface AttendanceSubmitRequest {
  fullName: string;
  email: string;
  course: string;
  rollNo: string;
}

/**
 * Successful attendance submission response.
 */
export interface AttendanceSubmitResponse {
  certificateId: string;
  participantName: string;
  eventName: string;
  eventDate: string;
  verificationUrl: string;
  pdfDownloadUrl?: string;
}

/**
 * Portal config response (public).
 */
export interface PortalConfigResponse {
  attendanceEnabled: boolean;
  event: {
    id: string;
    name: string;
    description: string | null;
    eventDate: string | null;
    eventTiming: string | null;
    speakerName: string | null;
  } | null;
}

/**
 * Admin: Create/Update event request.
 */
export interface AdminEventRequest {
  name: string;
  description?: string;
  eventDate?: string | null;
  eventTiming?: string | null;
  isTBA?: boolean;
  speakerName?: string;
  attendanceOpen?: boolean;
  setAsActive?: boolean;       // If true, sets this event as the active portal event
}

/**
 * Admin: Participant view row (joined from attendance + participant + certificate).
 */
export interface AdminParticipantRow {
  attendanceId?: string;
  participantId?: string;
  name: string;
  email: string;
  course: string;
  rollNo: string;
  submittedAt: string;
  certificateId: string | null;
}
