// ============================================================
// POST /api/admin/events/[id]/participants/import — add attendees from a sheet
// ============================================================
//
// Body: { rows: [{ rowNumber, fullName, email, collegeId, course }] }
//   (max ATTENDEE_IMPORT_BATCH_ROWS per request; the dialog sends batches)
//
// Each row is treated exactly like an attendance-portal submission
// (app/api/attendance/route.ts), but for the event in the URL, whether or not
// it is the active event or attendance is open:
//   1. validate (lib/attendance/import.ts, same rules as the portal)
//   2. find the participant by email, or create one; an existing participant's
//      name / course / College ID are updated, as the portal does
//   3. record attendance (an existing record = "already added", nothing changes)
//   4. issue the participation certificate
//
// If step 4 fails, the attendance from step 3 is removed again so the row can
// simply be imported again.
//
// The certificate PDF is not rendered here: /api/certificates/[id] renders it
// on demand from the stored snapshots, as for every other certificate. Rendering
// 500 PDFs only to fill the unused pdf_hash column would make imports very slow,
// so imported certificates have pdf_hash = NULL.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";
import { getAdminClient } from "@/lib/supabase/admin";
import { generateCertificateId } from "@/lib/certificates/id-generator";
import { getVerificationUrl } from "@/lib/certificates/qr-generator";
import { mapLimit } from "@/lib/media/concurrency";
import { isUuid } from "@/lib/auth/roles";
import { validateAttendee, type AttendeeInput } from "@/lib/attendance/import";
import type { ApiResponse } from "@/types/certificate";

export const dynamic = "force-dynamic";

/** Rows per request. The dialog splits bigger sheets into batches of this size. */
const ATTENDEE_IMPORT_BATCH_ROWS = 50;
/** Rows processed at the same time inside one request. */
const ROW_CONCURRENCY = 5;

type RowStatus = "imported" | "already_added" | "error";

interface RowResult {
  rowNumber: number;
  status: RowStatus;
  message: string;
  certificateId?: string;
}

interface EventInfo {
  id: string;
  name: string;
  event_date: string;
}

type Db = NonNullable<ReturnType<typeof getAdminClient>>;

function fail(error: string, status: number) {
  return NextResponse.json({ success: false, error } satisfies ApiResponse, { status });
}

async function findOrCreateParticipant(db: Db, a: AttendeeInput): Promise<string> {
  const details = { full_name: a.fullName, course: a.course, roll_no: a.collegeId };

  const existing = await db.from("participants").select("id").eq("email", a.email).maybeSingle();
  if (existing.error) throw new Error(`participant lookup: ${existing.error.message}`);
  if (existing.data) {
    const upd = await db.from("participants").update(details).eq("id", existing.data.id);
    if (upd.error) throw new Error(`participant update: ${upd.error.message}`);
    return existing.data.id as string;
  }

  const created = await db
    .from("participants")
    .insert({ ...details, email: a.email })
    .select("id")
    .single();
  if (!created.error && created.data) return created.data.id as string;

  // Someone (the portal, another import) created this email a moment ago.
  if (created.error?.code === "23505") {
    const raced = await db.from("participants").select("id").eq("email", a.email).maybeSingle();
    if (raced.data) return raced.data.id as string;
  }
  throw new Error(`participant insert: ${created.error?.message ?? "no row returned"}`);
}

async function importOne(db: Db, event: EventInfo, rowNumber: number, raw: unknown): Promise<RowResult> {
  const fields = (typeof raw === "object" && raw !== null ? raw : {}) as Record<string, unknown>;
  const parsed = validateAttendee(fields);
  if (!parsed.ok) return { rowNumber, status: "error", message: parsed.error };
  const a = parsed.value;

  try {
    const participantId = await findOrCreateParticipant(db, a);

    const prior = await db
      .from("attendance")
      .select("id")
      .eq("event_id", event.id)
      .eq("participant_id", participantId)
      .maybeSingle();
    if (prior.error) throw new Error(`attendance lookup: ${prior.error.message}`);
    if (prior.data) return { rowNumber, status: "already_added", message: "Already an attendee of this event." };

    const att = await db
      .from("attendance")
      .insert({ event_id: event.id, participant_id: participantId })
      .select("id")
      .single();
    if (att.error?.code === "23505") {
      return { rowNumber, status: "already_added", message: "Already an attendee of this event." };
    }
    if (att.error || !att.data) throw new Error(`attendance insert: ${att.error?.message ?? "no row returned"}`);
    const attendanceId = att.data.id as string;

    try {
      const certificateId = await generateCertificateId(async (id) => {
        const { data, error } = await db.from("certificates").select("id").eq("certificate_id", id).maybeSingle();
        if (error) throw new Error(`certificate id check: ${error.message}`);
        return !!data;
      });
      const cert = await db.from("certificates").insert({
        certificate_id: certificateId,
        event_id: event.id,
        participant_id: participantId,
        attendance_id: attendanceId,
        recipient_name_snapshot: a.fullName,
        event_name_snapshot: event.name,
        event_date_snapshot: event.event_date,
        pdf_url: `/api/certificates/${certificateId}`,
        verification_url: getVerificationUrl(certificateId),
        issue_date: new Date().toISOString().split("T")[0],
      });
      if (cert.error) throw new Error(`certificate insert: ${cert.error.message}`);
      return { rowNumber, status: "imported", message: "Added and certificate issued.", certificateId };
    } catch (certErr) {
      // Undo the attendance so the row can be imported again cleanly.
      const undo = await db.from("attendance").delete().eq("id", attendanceId);
      if (undo.error) console.error(`[API/admin/participants/import] row ${rowNumber} undo failed:`, undo.error.message);
      throw certErr;
    }
  } catch (err) {
    console.error(`[API/admin/participants/import] row ${rowNumber} failed:`, err instanceof Error ? err.message : err);
    return { rowNumber, status: "error", message: "Could not add this attendee. Try importing the row again." };
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  if (!isUuid(id)) return fail("Invalid event id.", 400);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail("Invalid JSON body.", 400);
  }
  const rows = (body as { rows?: unknown } | null)?.rows;
  if (!Array.isArray(rows) || rows.length === 0) return fail("Provide the rows to import.", 400);
  if (rows.length > ATTENDEE_IMPORT_BATCH_ROWS) {
    return fail(`Send at most ${ATTENDEE_IMPORT_BATCH_ROWS} rows per request.`, 400);
  }

  const db = getAdminClient();
  if (!db) return fail("Database not configured.", 500);

  const ev = await db.from("events").select("id, name, event_date").eq("id", id.toLowerCase()).maybeSingle();
  if (ev.error) {
    console.error("[API/admin/participants/import] Event lookup error:", ev.error.message);
    return fail("Failed to load the event.", 500);
  }
  if (!ev.data) return fail("Event not found.", 404);
  if (!ev.data.event_date) {
    return fail("Set this event's date before importing attendees. Their certificates show the event date.", 400);
  }
  const event = ev.data as EventInfo;

  // Normalise row numbers and reject an email repeated inside this batch.
  const seen = new Set<string>();
  const jobs = rows.map((raw, index) => {
    const r = (typeof raw === "object" && raw !== null ? raw : {}) as Record<string, unknown>;
    const rowNumber = Number.isSafeInteger(r.rowNumber) && Number(r.rowNumber) > 0 ? Number(r.rowNumber) : index + 2;
    const email = typeof r.email === "string" ? r.email.trim().toLowerCase() : "";
    const duplicate = email !== "" && seen.has(email);
    if (email) seen.add(email);
    return { raw, rowNumber, duplicate };
  });

  const results = await mapLimit(jobs, ROW_CONCURRENCY, (job) =>
    job.duplicate
      ? Promise.resolve<RowResult>({ rowNumber: job.rowNumber, status: "error", message: "This email appears twice in the file." })
      : importOne(db, event, job.rowNumber, job.raw)
  );

  const summary = {
    imported: results.filter((r) => r.status === "imported").length,
    alreadyAdded: results.filter((r) => r.status === "already_added").length,
    errors: results.filter((r) => r.status === "error").length,
  };

  return NextResponse.json({ success: true, data: { results, summary } } satisfies ApiResponse, {
    headers: { "Cache-Control": "no-store" },
  });
}
