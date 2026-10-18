-- ============================================================
-- 0003 — media_members                      (ADDITIVE, SAFE TO APPLY ANY TIME)
-- ============================================================
-- Who may use the Media Portal (/media) without being an admin.
--
-- WHY A SEPARATE TABLE (and not a new role in admin_users):
--   public.is_admin() and requireAdmin() both treat "has a row in admin_users"
--   as "is an admin". If media members lived there, every media account would
--   instantly pass those checks and could read or write admin data. Keeping
--   them in their own table means admin_users stays strictly "admins only", and
--   a media account can never reach /api/admin/* or any admin RLS policy.
--
-- Access model:
--   - RLS ON with NO policies, and all grants revoked from anon/authenticated:
--     browsers can never read or write this table.
--   - Only trusted server code (service-role key) touches it, after a
--     requireRole() check (lib/auth/require-role.ts).
--   - `active = false` revokes access immediately: every request re-checks it.
--
-- Does not touch admin_users or any existing table.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.media_members (
    id           UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email        TEXT NOT NULL,
    display_name TEXT NOT NULL,
    active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by   UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS media_members_email_lower_idx
    ON public.media_members (lower(email));

COMMENT ON TABLE public.media_members IS
  'Accounts allowed to use the Media Portal. Created by super admins via /api/admin/media-users. Deliberately NOT part of admin_users, so is_admin() stays false for them.';

ALTER TABLE public.media_members ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.media_members FROM anon, authenticated;
