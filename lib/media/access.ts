// ============================================================
// Who may act on an upload — PURE
// ============================================================
//
// Dashboard admins (super_admin, admin) may manage any upload.
// Media members (media_manager) may manage ONLY the uploads they created.
// A row whose uploader account was deleted (uploaded_by = NULL) is
// manageable by admins only.
// ============================================================

import type { PortalRole } from "../auth/roles.ts";

/** True for roles that may manage everyone's uploads, not just their own. */
export function canManageAllUploads(role: PortalRole): boolean {
  return role === "super_admin" || role === "admin";
}

export function canManageUpload(
  role: PortalRole,
  userId: string,
  uploadedBy: string | null
): boolean {
  if (canManageAllUploads(role)) return true;
  if (role === "media_manager") return uploadedBy !== null && uploadedBy === userId;
  return false;
}
