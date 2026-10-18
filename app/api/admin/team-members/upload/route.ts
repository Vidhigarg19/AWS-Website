// ============================================================
// POST /api/admin/team-members/upload
// Handles profile image upload for team members.
// Uploads to Supabase Storage ('team-avatars' bucket) with a
// fallback to local /public/members/uploads/ directory.
// ============================================================

import { requireAdmin } from "@/lib/auth/require-admin";
import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";
import path from "path";
import fs from "fs/promises";

export const dynamic = "force-dynamic";

const BUCKET_NAME = "team-avatars";
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file || typeof file === "string") {
      return NextResponse.json(
        { success: false, error: "No image file provided." },
        { status: 400 }
      );
    }

    // Validate mime type
    if (!file.type.startsWith("image/")) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid file type. Only image files (PNG, JPG, WebP, GIF, SVG) are accepted.",
        },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        {
          success: false,
          error: "File size exceeds the 5MB limit. Please upload a smaller image.",
        },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const originalExt = path.extname(file.name) || ".png";
    const rawBaseName = path.basename(file.name, originalExt).replace(/[^a-zA-Z0-9_-]/g, "_");
    const safeFileName = `${Date.now()}_${rawBaseName}${originalExt}`;

    // ── 1. Try Supabase Storage ──────────────────────────────
    const supabase = getAdminClient();
    if (supabase) {
      try {
        // Ensure bucket exists
        const { data: buckets } = await supabase.storage.listBuckets();
        const bucketExists = buckets?.some((b) => b.name === BUCKET_NAME);

        if (!bucketExists) {
          const { error: bucketError } = await supabase.storage.createBucket(BUCKET_NAME, {
            public: true,
            fileSizeLimit: MAX_FILE_SIZE,
          });
          if (bucketError) {
            console.warn("[upload] Note on creating bucket:", bucketError.message);
          }
        }

        const storagePath = `avatars/${safeFileName}`;
        const { error: uploadError } = await supabase.storage
          .from(BUCKET_NAME)
          .upload(storagePath, buffer, {
            contentType: file.type || "image/png",
            upsert: true,
          });

        if (!uploadError) {
          const { data: publicUrlData } = supabase.storage
            .from(BUCKET_NAME)
            .getPublicUrl(storagePath);

          if (publicUrlData?.publicUrl) {
            return NextResponse.json({
              success: true,
              url: publicUrlData.publicUrl,
              filename: safeFileName,
              source: "supabase",
            });
          }
        } else {
          console.warn("[upload] Supabase storage upload failed, trying fallback:", uploadError.message);
        }
      } catch (sbErr: any) {
        console.warn("[upload] Supabase storage error, trying fallback:", sbErr?.message);
      }
    }

    // ── 2. Local Fallback (/public/members/uploads/) ────────
    try {
      const uploadDir = path.join(process.cwd(), "public", "members", "uploads");
      await fs.mkdir(uploadDir, { recursive: true });
      const localFilePath = path.join(uploadDir, safeFileName);
      await fs.writeFile(localFilePath, buffer);

      return NextResponse.json({
        success: true,
        url: `/members/uploads/${safeFileName}`,
        filename: safeFileName,
        source: "local",
      });
    } catch (fsErr: any) {
      console.error("[upload] Local filesystem write error:", fsErr);
      return NextResponse.json(
        {
          success: false,
          error: "Failed to upload image. Please check storage configuration or provide an image URL.",
        },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error("[upload] Unexpected error in POST handler:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to process image upload." },
      { status: 500 }
    );
  }
}
