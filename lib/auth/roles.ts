// ============================================================
// Portal roles — PURE logic (no framework or Node imports)
// ============================================================
//
// Kept dependency-free so it can be unit-tested with `node --test`
// (see tests/auth/roles.test.ts) and imported from anywhere.
//
// Roles:
//   super_admin   — everything, incl. creating media accounts
//   admin         — the existing dashboard admins (from public.admin_users)
//   media_manager — media team: upload/manage event photos & videos only
//                   (from public.media_members; NOT an admin)
//
// ============================================================

export type PortalRole = "super_admin" | "admin" | "media_manager";

/** Who may sign in to /media and use /api/media/*. */
export const MEDIA_PORTAL_ROLES: readonly PortalRole[] = [
  "super_admin",
  "admin",
  "media_manager",
];

/** Who may manage media-member accounts. */
export const SUPER_ADMIN_ONLY: readonly PortalRole[] = ["super_admin"];

/**
 * Combines the two lookups into one role. Fails CLOSED:
 *  - an unknown admin_users.role value never grants anything by itself
 *  - media access needs an explicit `active === true`
 *  - an admin_users row always wins over a media_members row
 */
export function resolvePortalRole(
  adminRole: string | null | undefined,
  mediaMemberActive: boolean | null | undefined
): PortalRole | null {
  if (adminRole === "super_admin" || adminRole === "admin") return adminRole;
  if (mediaMemberActive === true) return "media_manager";
  return null;
}

export function isRoleAllowed(
  role: PortalRole | null,
  allowed: readonly PortalRole[]
): boolean {
  return role !== null && allowed.includes(role);
}

// ------------------------------------------------------------
// Input validation for the super-admin "media users" API
// ------------------------------------------------------------

export type Validation<T> = { ok: true; value: T } | { ok: false; error: string };

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/;

export interface MediaMemberInput {
  email: string;
  displayName: string;
}

export function validateMediaMemberInput(body: unknown): Validation<MediaMemberInput> {
  if (typeof body !== "object" || body === null) {
    return { ok: false, error: "Invalid request body." };
  }
  const { email, displayName } = body as Record<string, unknown>;

  if (typeof email !== "string" || typeof displayName !== "string") {
    return { ok: false, error: "Email and display name are required." };
  }

  const cleanEmail = email.trim().toLowerCase();
  if (cleanEmail.length > 254 || !EMAIL_PATTERN.test(cleanEmail)) {
    return { ok: false, error: "Enter a valid email address." };
  }

  const cleanName = displayName.trim().replace(/\s+/g, " ");
  if (cleanName.length < 2 || cleanName.length > 80 || CONTROL_CHARS.test(cleanName)) {
    return { ok: false, error: "Display name must be 2 to 80 characters." };
  }

  return { ok: true, value: { email: cleanEmail, displayName: cleanName } };
}

export interface MediaMemberPatch {
  active?: boolean;
  resetPassword?: boolean;
}

export function validateMediaMemberPatch(body: unknown): Validation<MediaMemberPatch> {
  if (typeof body !== "object" || body === null) {
    return { ok: false, error: "Invalid request body." };
  }
  const { active, resetPassword } = body as Record<string, unknown>;
  const patch: MediaMemberPatch = {};

  if (active !== undefined) {
    if (typeof active !== "boolean") return { ok: false, error: "`active` must be true or false." };
    patch.active = active;
  }
  if (resetPassword !== undefined) {
    if (typeof resetPassword !== "boolean") {
      return { ok: false, error: "`resetPassword` must be true or false." };
    }
    patch.resetPassword = resetPassword;
  }
  if (patch.active === undefined && patch.resetPassword === undefined) {
    return { ok: false, error: "Nothing to update." };
  }
  return { ok: true, value: patch };
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}
