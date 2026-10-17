-- ============================================================
-- 0001 — admin_users + is_admin()          (ADDITIVE, SAFE TO APPLY FIRST)
-- ============================================================
-- Creates the table that decides who is an admin. Changes nothing that
-- exists today, so it cannot break the running site.
--
-- ROLLOUT ORDER (important):
--   1. Apply THIS migration.
--   2. Run supabase/seed-admins.sql to add yourself (and other real admins).
--   3. Deploy the application code (requireAdmin guard).
--   4. Verify admin login + the dashboard still work.
--   5. Only then apply 0002_lock_down_rls.sql.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.admin_users (
    id         UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    role       TEXT NOT NULL DEFAULT 'admin'
               CHECK (role IN ('super_admin', 'admin')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

COMMENT ON TABLE public.admin_users IS
  'Who is an admin. Written only by trusted server code / SQL. Never derive admin status from user_metadata (users can edit it).';

-- RLS on with NO policies = invisible to anon/authenticated clients.
-- The server reads it with the service-role key; is_admin() reads it as definer.
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.admin_users FROM anon, authenticated;

-- Used by RLS policies (see 0002) to ask "is the current JWT user an admin?"
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.admin_users WHERE id = (SELECT auth.uid())
    );
$$;

REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
