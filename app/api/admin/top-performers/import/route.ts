import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { cleanFullName } from "@/lib/utils";

export const dynamic = "force-dynamic";

interface ImportRow {
  rowNumber?: unknown;
  rank?: unknown;
  fullName?: unknown;
  email?: unknown;
  rollNo?: unknown;
  course?: unknown;
}

interface RowResult {
  rowNumber: number;
  status: "imported" | "already_added" | "error";
  message: string;
  fullName: string;
  email: string;
}

type ValidatedRow =
  | { error: string; rowNumber: number; fullName: string; email: string }
  | { rank: number; rowNumber: number; fullName: string; email: string; rollNo: string; course: string };

function errorResponse(error: string, status: number) {
  return NextResponse.json({ success: false, error }, { status });
}

function validateRow(row: ImportRow, index: number): ValidatedRow {
  const rowNumber = Number.isSafeInteger(row.rowNumber) && Number(row.rowNumber) > 0
    ? Number(row.rowNumber)
    : index + 2;
  const rank = typeof row.rank === "number" ? row.rank : Number(String(row.rank ?? "").trim());
  const nameInput = typeof row.fullName === "string" ? row.fullName.trim().slice(0, 100) : "";
  const fullName = cleanFullName(nameInput);
  const email = typeof row.email === "string" ? row.email.trim().slice(0, 254).toLowerCase() : "";
  const rollNo = typeof row.rollNo === "string" ? row.rollNo.trim().slice(0, 100) : "";
  const course = typeof row.course === "string" ? row.course.trim().slice(0, 100) : "";

  if (!Number.isSafeInteger(rank) || rank < 1 || rank > 2147483647) return { error: "Rank must be a whole number >= 1.", rowNumber, fullName, email };
  if (fullName.length < 2) return { error: "Name must be between 2 and 100 characters.", rowNumber, fullName, email };
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "Enter a valid email address.", rowNumber, fullName, email };
  if (!rollNo) return { error: "Roll No is required.", rowNumber, fullName, email };
  if (!course) return { error: "Course is required.", rowNumber, fullName, email };
  return { rowNumber, rank, fullName, email, rollNo, course };
}

export async function POST(request: NextRequest) {
  try {
    const sessionClient = createClient(await cookies());
    const { data: { user }, error: authError } = await sessionClient.auth.getUser();
    if (authError || !user) return errorResponse("Please sign in to import top performers.", 401);

    let body: { rows?: unknown };
    try {
      body = await request.json();
    } catch {
      return errorResponse("The import data could not be read. Please try again.", 400);
    }
    if (!Array.isArray(body.rows)) return errorResponse("Provide rows to import.", 400);
    if (body.rows.length > 500) return errorResponse("Maximum 500 rows per import.", 400);

    const admin = getAdminClient();
    if (!admin) return errorResponse("Database client unavailable.", 500);
    const { data: config, error: configError } = await admin
      .from("portal_config")
      .select("active_event_id")
      .limit(1)
      .single();
    if (configError) {
      console.error("[API/admin/top-performers/import] Active event lookup failed:", configError);
      return errorResponse("Failed to load the active event.", 500);
    }
    if (!config?.active_event_id) return errorResponse("Set an active event before importing top performers.", 400);

    const { data: event, error: eventError } = await admin
      .from("events")
      .select("id")
      .eq("id", config.active_event_id)
      .maybeSingle();
    if (eventError) {
      console.error("[API/admin/top-performers/import] Event lookup failed:", eventError);
      return errorResponse("Failed to load the active event.", 500);
    }
    if (!event) return errorResponse("The active event could not be found.", 400);

    const seenEmails = new Set<string>();
    const results: RowResult[] = [];
    for (let index = 0; index < body.rows.length; index += 1) {
      const rawRow = body.rows[index];
      if (!rawRow || typeof rawRow !== "object" || Array.isArray(rawRow)) {
        results.push({ rowNumber: index + 2, status: "error", message: "Row data must be an object.", fullName: "", email: "" });
        continue;
      }
      const inputRow = rawRow as ImportRow;
      const inputEmail = typeof inputRow.email === "string"
        ? inputRow.email.trim().slice(0, 254).toLowerCase()
        : "";
      const duplicateEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(inputEmail)
        && seenEmails.has(inputEmail);
      if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(inputEmail)) seenEmails.add(inputEmail);
      const row = validateRow(rawRow as ImportRow, index);
      if (duplicateEmail) {
        results.push({ rowNumber: row.rowNumber, status: "error", message: "Email is duplicated in this file.", fullName: row.fullName, email: row.email });
        continue;
      }
      if ("error" in row) {
        results.push({ rowNumber: row.rowNumber, status: "error", message: row.error, fullName: row.fullName, email: row.email });
        continue;
      }

      try {
        const { data: participant, error: participantLookupError } = await admin
          .from("participants")
          .select("id")
          .eq("email", row.email)
          .maybeSingle();
        if (participantLookupError) {
          console.error("[API/admin/top-performers/import] Participant lookup failed:", participantLookupError);
          results.push({ rowNumber: row.rowNumber, status: "error", message: "Could not look up the participant.", fullName: row.fullName, email: row.email });
          continue;
        }

        let participantId = participant?.id;
        if (participantId) {
          const { data: existingTopPerformer, error: duplicateError } = await admin
            .from("top_performers")
            .select("id")
            .eq("event_id", event.id)
            .eq("participant_id", participantId)
            .maybeSingle();
          if (duplicateError) {
            console.error("[API/admin/top-performers/import] Duplicate lookup failed:", duplicateError);
            results.push({ rowNumber: row.rowNumber, status: "error", message: "Could not check whether this email is already added.", fullName: row.fullName, email: row.email });
            continue;
          }
          if (existingTopPerformer) {
            results.push({ rowNumber: row.rowNumber, status: "already_added", message: "Already added to this event.", fullName: row.fullName, email: row.email });
            continue;
          }
        } else {
          const { data: newParticipant, error: participantInsertError } = await admin
            .from("participants")
            .insert({
              email: row.email,
              full_name: row.fullName,
              course: row.course,
              roll_no: row.rollNo,
            })
            .select("id")
            .single();
          if (participantInsertError?.code === "23505") {
            const { data: racedParticipant, error: racedLookupError } = await admin
              .from("participants")
              .select("id")
              .eq("email", row.email)
              .maybeSingle();
            if (racedLookupError || !racedParticipant) {
              console.error("[API/admin/top-performers/import] Participant race lookup failed:", racedLookupError);
              results.push({ rowNumber: row.rowNumber, status: "error", message: "Could not create or find the participant.", fullName: row.fullName, email: row.email });
              continue;
            }
            participantId = racedParticipant.id;
          } else if (participantInsertError || !newParticipant) {
            console.error("[API/admin/top-performers/import] Participant creation failed:", participantInsertError);
            results.push({ rowNumber: row.rowNumber, status: "error", message: "Could not create the participant.", fullName: row.fullName, email: row.email });
            continue;
          } else {
            participantId = newParticipant.id;
          }
        }

        if (!participantId) {
          results.push({ rowNumber: row.rowNumber, status: "error", message: "Could not create or find the participant.", fullName: row.fullName, email: row.email });
          continue;
        }

        const { error: insertError } = await admin.from("top_performers").insert({
          event_id: event.id,
          participant_id: participantId,
          rank: row.rank,
          full_name: row.fullName,
          course: row.course,
          roll_no: row.rollNo,
        });
        if (insertError?.code === "23505") {
          results.push({ rowNumber: row.rowNumber, status: "already_added", message: "Already added to this event.", fullName: row.fullName, email: row.email });
        } else if (insertError) {
          console.error("[API/admin/top-performers/import] Top performer insert failed:", insertError);
          results.push({ rowNumber: row.rowNumber, status: "error", message: "Could not add this top performer.", fullName: row.fullName, email: row.email });
        } else {
          results.push({ rowNumber: row.rowNumber, status: "imported", message: "Imported successfully.", fullName: row.fullName, email: row.email });
        }
      } catch (rowError) {
        console.error(`[API/admin/top-performers/import] Row ${row.rowNumber} failed:`, rowError);
        results.push({ rowNumber: row.rowNumber, status: "error", message: "An unexpected error occurred for this row.", fullName: row.fullName, email: row.email });
      }
    }

    const summary = {
      imported: results.filter((result) => result.status === "imported").length,
      alreadyAdded: results.filter((result) => result.status === "already_added").length,
      errors: results.filter((result) => result.status === "error").length,
    };
    return NextResponse.json({ success: true, data: { results, summary } });
  } catch (error: unknown) {
    console.error("[API/admin/top-performers/import] POST failed:", error);
    return errorResponse("An unexpected error occurred while importing top performers.", 500);
  }
}
