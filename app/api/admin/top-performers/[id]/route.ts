import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getAdminClient } from "@/lib/supabase/admin";
import type { ApiResponse } from "@/types/certificate";

export const dynamic = "force-dynamic";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const sessionClient = createClient(await cookies());
    const { data: { user }, error: authError } = await sessionClient.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: "Please sign in to remove a top performer." } satisfies ApiResponse,
        { status: 401 }
      );
    }

    const { id } = await params;
    if (!id?.trim()) {
      return NextResponse.json(
        { success: false, error: "Top performer ID is required." } satisfies ApiResponse,
        { status: 400 }
      );
    }

    const admin = getAdminClient();
    if (!admin) {
      return NextResponse.json(
        { success: false, error: "Database client unavailable." } satisfies ApiResponse,
        { status: 500 }
      );
    }

    const { data: config, error: configError } = await admin
      .from("portal_config")
      .select("active_event_id")
      .limit(1)
      .single();

    if (configError) {
      console.error("[API/admin/top-performers] Active event lookup failed:", configError);
      return NextResponse.json(
        { success: false, error: "Failed to load the active event." } satisfies ApiResponse,
        { status: 500 }
      );
    }
    if (!config?.active_event_id) {
      return NextResponse.json(
        { success: false, error: "There is no active event." } satisfies ApiResponse,
        { status: 400 }
      );
    }

    const { data: topPerformer, error: topPerformerError } = await sessionClient
      .from("top_performers")
      .select("id, event_id, participant_id")
      .eq("id", id.trim())
      .eq("event_id", config.active_event_id)
      .maybeSingle();

    if (topPerformerError) {
      console.error("[API/admin/top-performers] Top performer lookup failed:", topPerformerError);
      return NextResponse.json(
        { success: false, error: "You do not have permission to remove this top performer." } satisfies ApiResponse,
        { status: 403 }
      );
    }
    if (!topPerformer) {
      return NextResponse.json(
        { success: false, error: "Top performer not found for the active event." } satisfies ApiResponse,
        { status: 404 }
      );
    }

    const { data: issuedCertificate, error: certificateError } = await admin
      .from("certificates")
      .select("id")
      .eq("event_id", topPerformer.event_id)
      .eq("participant_id", topPerformer.participant_id)
      .not("award_title", "is", null)
      .limit(1)
      .maybeSingle();

    if (certificateError) {
      console.error("[API/admin/top-performers] Certificate lookup failed:", certificateError);
      return NextResponse.json(
        { success: false, error: "Could not check whether a certificate has been issued." } satisfies ApiResponse,
        { status: 500 }
      );
    }
    if (issuedCertificate) {
      return NextResponse.json(
        { success: false, error: "This top performer cannot be removed because their certificate has already been issued." } satisfies ApiResponse,
        { status: 409 }
      );
    }

    const { data: deletedRow, error: deleteError } = await sessionClient
      .from("top_performers")
      .delete()
      .eq("id", topPerformer.id)
      .eq("event_id", config.active_event_id)
      .select("id")
      .maybeSingle();

    if (deleteError) {
      console.error("[API/admin/top-performers] Delete failed:", deleteError);
      return NextResponse.json(
        { success: false, error: "Could not remove this top performer." } satisfies ApiResponse,
        { status: deleteError.code === "42501" ? 403 : 500 }
      );
    }
    if (!deletedRow) {
      return NextResponse.json(
        { success: false, error: "Top performer could not be removed. Refresh the list and try again." } satisfies ApiResponse,
        { status: 409 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Top performer removed successfully.",
    } satisfies ApiResponse);
  } catch (error: unknown) {
    console.error("[API/admin/top-performers] DELETE failed:", error);
    return NextResponse.json(
      { success: false, error: "An unexpected error occurred while removing the top performer." } satisfies ApiResponse,
      { status: 500 }
    );
  }
}
