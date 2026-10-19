// ============================================================
// GET /api/events — Public events endpoint
// ============================================================
//
// In Production: Queries live database from Supabase strictly.
// In Local Development: If Supabase credentials in .env.local are
// placeholders, serves preview events so you can design and test
// locally. Once pushed or configured, strictly fetches real DB data.
// ============================================================

import { NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";
import type { ApiResponse, DbEvent } from "@/types/certificate";

/**
 * Local development preview data.
 * Active ONLY in local development (NODE_ENV === 'development')
 * when .env.local has unconfigured placeholder credentials.
 * This is NEVER served in production.
 */
const DEV_PREVIEW_EVENTS: DbEvent[] = [
  {
    id: "cloud-kickstart-2026",
    name: "Cloud Kickstart 2026: AWS Core Infrastructure",
    description:
      "Hands-on foundation workshop covering AWS EC2, S3 storage, IAM security policies, and VPC architecture.",
    event_date: "2026-09-30",
    event_timing: "11:00 AM - 01:00 PM",
    speaker_name: "AWS Student Builder Group",
    attendance_open: false,
    event_type: "Workshop",
  },
  {
    id: "aws-serverless-masterclass",
    name: "Serverless Application Design with AWS Lambda",
    description:
      "Build, test, and deploy event-driven serverless APIs using Lambda, DynamoDB, and API Gateway with automated CI/CD.",
    event_date: "2026-10-05",
    event_timing: "02:00 PM - 04:30 PM",
    speaker_name: "AWS Community Mentors",
    attendance_open: false,
    event_type: "Workshop",
  },
  {
    id: "aws-cloud-practitioner-sprint",
    name: "AWS Certified Cloud Practitioner (CLF-C02) Sprint",
    description:
      "Comprehensive exam prep sprint reviewing core cloud concepts, security compliance, pricing models, and architectural best practices.",
    event_date: "2026-11-20",
    event_timing: "10:30 AM - 01:00 PM",
    speaker_name: "AWS Student Builder Group",
    attendance_open: true,
    event_type: "Workshop",
  },
];

export async function GET(): Promise<NextResponse<ApiResponse<DbEvent[]>>> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SECRET_KEY;
  const isPlaceholder =
    !url ||
    !serviceKey ||
    url.includes("your-project.supabase.co") ||
    serviceKey === "your_secret_key";

  // 1. Check if Supabase credentials are not configured yet
  if (isPlaceholder) {
    // If in local development, serve preview events so the UI renders locally
    if (process.env.NODE_ENV === "development") {
      return NextResponse.json(
        { success: true, data: DEV_PREVIEW_EVENTS },
        {
          headers: {
            "X-Data-Source": "local-development-preview",
          },
        }
      );
    }

    // In production, strictly reject and do NOT serve preview data
    return NextResponse.json(
      {
        success: false,
        error:
          "Supabase environment variables are not configured in production settings.",
      },
      { status: 503 }
    );
  }

  // 2. Real database query (used in Production and whenever real keys are set)
  const supabase = getAdminClient();
  if (!supabase) {
    return NextResponse.json(
      { success: false, error: "Database client failed to initialize." },
      { status: 500 }
    );
  }

  try {
    const { data, error } = await supabase
      .from("events")
      .select("id, name, description, event_date, event_timing, speaker_name, attendance_open, event_type")
      .order("event_date", { ascending: true });

    if (error) {
      console.error("[API/events] Database query error:", error);
      // In local development only, if query fails, provide preview data
      if (process.env.NODE_ENV === "development") {
        return NextResponse.json({ success: true, data: DEV_PREVIEW_EVENTS });
      }
      return NextResponse.json(
        { success: false, error: "Database query failed: " + error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { success: true, data: data ?? [] },
      {
        headers: {
          "Cache-Control": "public, s-maxage=10, stale-while-revalidate=60",
        },
      }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Network error";
    if (process.env.NODE_ENV === "development") {
      return NextResponse.json({ success: true, data: DEV_PREVIEW_EVENTS });
    }
    return NextResponse.json(
      { success: false, error: "Server network error: " + message },
      { status: 500 }
    );
  }
}
