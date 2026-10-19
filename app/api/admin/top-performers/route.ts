import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { cleanFullName } from "@/lib/utils";
import type { ApiResponse } from "@/types/certificate";

export const dynamic = "force-dynamic";

interface TopPerformerBody {
  rank?: unknown;
  fullName?: unknown;
  email?: unknown;
  rollNo?: unknown;
  course?: unknown;
}

function errorResponse(error: string, status: number) {
  return NextResponse.json(
    { success: false, error } satisfies ApiResponse,
    { status }
  );
}

async function getActiveEvent(admin: ReturnType<typeof getAdminClient>) {
  if (!admin) return { event: null, error: "Database client unavailable." };

  const { data: config, error: configError } = await admin
    .from("portal_config")
    .select("active_event_id")
    .limit(1)
    .single();

  if (configError) {
    console.error("[API/admin/top-performers] Active event lookup failed:", configError);
    return { event: null, error: "Failed to load the active event." };
  }

  if (!config?.active_event_id) return { event: null, error: null };

  const { data: event, error: eventError } = await admin
    .from("events")
    .select("id, name, event_date")
    .eq("id", config.active_event_id)
    .maybeSingle();

  if (eventError) {
    console.error("[API/admin/top-performers] Event lookup failed:", eventError);
    return { event: null, error: "Failed to load the active event." };
  }

  return { event, error: null };
}

export async function GET() {
  try {
    const sessionClient = createClient(await cookies());
    const { data: { user }, error: authError } = await sessionClient.auth.getUser();
    if (authError || !user) return errorResponse("Please sign in to view top performers.", 401);

    const admin = getAdminClient();
    if (!admin) return errorResponse("Database client unavailable.", 500);

    const { event, error: eventLookupError } = await getActiveEvent(admin);
    if (eventLookupError) return errorResponse(eventLookupError, 500);
    if (!event) {
      return NextResponse.json({
        success: true,
        data: { event: null, topPerformers: [] },
      } satisfies ApiResponse);
    }

    const { data: rows, error: rowsError } = await admin
      .from("top_performers")
      .select("id, event_id, participant_id, rank, full_name, course, roll_no")
      .eq("event_id", event.id)
      .order("rank", { ascending: true });

    if (rowsError) {
      console.error("[API/admin/top-performers] Top performer lookup failed:", rowsError);
      return errorResponse("Failed to load top performers.", 500);
    }

    const participantIds = [...new Set((rows || []).map((row) => row.participant_id))];
    let participantsById = new Map<string, { email: string }>();
    let certificatesByParticipant = new Map<string, string>();

    if (participantIds.length > 0) {
      const [{ data: participants, error: participantsError }, { data: certificates, error: certificatesError }] =
        await Promise.all([
          admin
            .from("participants")
            .select("id, email")
            .in("id", participantIds),
          admin
            .from("certificates")
            .select("participant_id, certificate_id")
            .eq("event_id", event.id)
            .not("award_title", "is", null)
            .in("participant_id", participantIds),
        ]);

      if (participantsError || certificatesError) {
        console.error("[API/admin/top-performers] Related data lookup failed:", {
          participantsError,
          certificatesError,
        });
        return errorResponse("Failed to load top performer contact and certificate details.", 500);
      }

      participantsById = new Map((participants || []).map((participant) => [
        participant.id,
        { email: participant.email },
      ]));
      certificatesByParticipant = new Map((certificates || []).map((certificate) => [
        certificate.participant_id,
        certificate.certificate_id,
      ]));
    }

    const topPerformers = (rows || []).map((row) => ({
      id: row.id,
      participantId: row.participant_id,
      rank: row.rank,
      fullName: row.full_name,
      email: participantsById.get(row.participant_id)?.email || "",
      course: row.course,
      rollNo: row.roll_no,
      certificateId: certificatesByParticipant.get(row.participant_id) || null,
    }));

    return NextResponse.json({
      success: true,
      data: {
        event: { id: event.id, name: event.name, eventDate: event.event_date },
        topPerformers,
      },
    } satisfies ApiResponse);
  } catch (error: unknown) {
    console.error("[API/admin/top-performers] GET failed:", error);
    return errorResponse("An unexpected error occurred while loading top performers.", 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const sessionClient = createClient(await cookies());
    const { data: { user }, error: authError } = await sessionClient.auth.getUser();
    if (authError || !user) return errorResponse("Please sign in to add a top performer.", 401);

    let body: TopPerformerBody;
    try {
      body = await request.json();
    } catch {
      return errorResponse("The form data could not be read. Please try again.", 400);
    }

    if (typeof body.rank !== "number" || !Number.isSafeInteger(body.rank) || body.rank < 1 || body.rank > 2147483647) {
      return errorResponse("Rank must be a whole number greater than or equal to 1.", 400);
    }

    if (typeof body.fullName !== "string" || !body.fullName.trim()) {
      return errorResponse("Please enter the top performer's full name.", 400);
    }
    const fullName = cleanFullName(body.fullName);
    if (fullName.length < 2 || fullName.length > 100) {
      return errorResponse("Full name must be between 2 and 100 characters.", 400);
    }

    if (typeof body.email !== "string" || !body.email.trim()) {
      return errorResponse("Please enter the top performer's email address.", 400);
    }
    const email = body.email.trim().toLowerCase();
    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return errorResponse("Please enter a valid email address.", 400);
    }

    if (typeof body.rollNo !== "string" || !body.rollNo.trim()) {
      return errorResponse("Please enter the top performer's roll number.", 400);
    }
    if (typeof body.course !== "string" || !body.course.trim()) {
      return errorResponse("Please enter the top performer's course.", 400);
    }

    const admin = getAdminClient();
    if (!admin) return errorResponse("Database client unavailable.", 500);

    const { event, error: eventLookupError } = await getActiveEvent(admin);
    if (eventLookupError) return errorResponse(eventLookupError, 500);
    if (!event) return errorResponse("Set an active event before adding top performers.", 400);

    const { data: participant, error: participantLookupError } = await admin
      .from("participants")
      .select("id")
      .eq("email", email)
      .maybeSingle();

    if (participantLookupError) {
      console.error("[API/admin/top-performers] Participant lookup failed:", participantLookupError);
      return errorResponse("We could not look up that email address. Please try again.", 500);
    }

    let participantId = participant?.id;
    if (!participantId) {
      const { data: newParticipant, error: participantInsertError } = await admin
        .from("participants")
        .insert({
          email,
          full_name: fullName,
          course: body.course.trim(),
          roll_no: body.rollNo.trim(),
        })
        .select("id")
        .single();

      if (participantInsertError?.code === "23505") {
        const { data: racedParticipant, error: racedLookupError } = await admin
          .from("participants")
          .select("id")
          .eq("email", email)
          .maybeSingle();
        if (racedLookupError || !racedParticipant) {
          console.error("[API/admin/top-performers] Participant race lookup failed:", racedLookupError);
          return errorResponse("We could not create or find that participant. Please try again.", 500);
        }
        participantId = racedParticipant.id;
      } else if (participantInsertError || !newParticipant) {
        console.error("[API/admin/top-performers] Participant creation failed:", participantInsertError);
        return errorResponse("We could not create the participant record. Please check the details and try again.", 500);
      } else {
        participantId = newParticipant.id;
      }
    }

    const { data: existingTopPerformer, error: duplicateLookupError } = await admin
      .from("top_performers")
      .select("id")
      .eq("event_id", event.id)
      .eq("participant_id", participantId)
      .maybeSingle();

    if (duplicateLookupError) {
      console.error("[API/admin/top-performers] Duplicate lookup failed:", duplicateLookupError);
      return errorResponse("Eligibility could not be checked. Please try again.", 500);
    }
    if (existingTopPerformer) {
      return errorResponse("This email is already listed as a top performer for the active event.", 409);
    }

    const { error: insertError } = await admin.from("top_performers").insert({
      event_id: event.id,
      participant_id: participantId,
      rank: body.rank,
      full_name: fullName,
      course: body.course.trim(),
      roll_no: body.rollNo.trim(),
    });

    if (insertError?.code === "23505") {
      return errorResponse("This email is already listed as a top performer for the active event.", 409);
    }
    if (insertError) {
      console.error("[API/admin/top-performers] Insert failed:", insertError);
      return errorResponse("We could not add this top performer. Please try again.", 500);
    }

    return NextResponse.json({
      success: true,
      message: `${fullName} was added to the active event's top performers.`,
    } satisfies ApiResponse);
  } catch (error: unknown) {
    console.error("[API/admin/top-performers] POST failed:", error);
    return errorResponse("An unexpected error occurred while adding the top performer.", 500);
  }
}
