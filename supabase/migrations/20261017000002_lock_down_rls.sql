-- ============================================================
-- 0002 — Lock down Row Level Security      (APPLY LAST — see rollout order)
-- ============================================================
-- Problem this fixes:
--   The Supabase URL and publishable (anon) key are shipped to every browser.
--   The old policies let ANYONE with them, calling the Supabase REST API
--   directly (bypassing the Next.js app entirely):
--     - read every row of participants (name, email, course, roll no)
--     - UPDATE any participant
--     - INSERT rows into certificates
--   and let ANY signed-in account act as admin (USING (true)).
--
-- What this does:
--   - drops every existing policy on the app tables (whatever state the
--     live DB is in: init / v2 / team_members schemas)
--   - re-enables RLS
--   - adds ONE policy per table: admins only (public.is_admin())
--   Anonymous users get NO direct table access.
--
-- Why that is safe for the app: all public features (attendance, register,
-- verify, events, team page, recruitment status) read/write through Next.js
-- route handlers using the SERVICE-ROLE key, which bypasses RLS. The admin
-- UI also only calls /api/admin/*. No browser code queries tables directly.
--
-- PREREQUISITES: 0001 applied, seed-admins.sql run, new code deployed.
-- Otherwise authenticated users lose access to rows they could reach before.
--
-- ROLLBACK (emergency only): the previous permissive policies are in
-- supabase_schema_v2.sql, section "6. Row Level Security". Prefer fixing
-- forward; restoring them re-opens the data exposure above.
-- ============================================================

DO $$
DECLARE
    t TEXT;
    p RECORD;
    app_tables TEXT[] := ARRAY[
        'participants', 'events', 'attendance', 'certificates',
        'portal_config', 'audit_logs', 'certificate_attendance', 'team_members'
    ];
BEGIN
    FOREACH t IN ARRAY app_tables LOOP
        IF to_regclass('public.' || t) IS NULL THEN
            CONTINUE; -- table not present in this database
        END IF;

        FOR p IN
            SELECT policyname FROM pg_policies
            WHERE schemaname = 'public' AND tablename = t
        LOOP
            EXECUTE format('DROP POLICY %I ON public.%I', p.policyname, t);
        END LOOP;

        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);

        EXECUTE format(
            'CREATE POLICY "admins_all" ON public.%I '
            'FOR ALL TO authenticated '
            'USING (public.is_admin()) WITH CHECK (public.is_admin())',
            t
        );
    END LOOP;
END
$$;

-- Team avatar uploads: admins only (was: ANY authenticated user).
-- Public READ of the (public) bucket is unchanged.
DROP POLICY IF EXISTS "Admin upload team avatars" ON storage.objects;
DROP POLICY IF EXISTS "admins_upload_team_avatars" ON storage.objects;
CREATE POLICY "admins_upload_team_avatars"
    ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'team-avatars' AND public.is_admin());
