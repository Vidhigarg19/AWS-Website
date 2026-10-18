-- ============================================================
-- Seed admins (run MANUALLY in the Supabase SQL editor, after 0001)
-- ============================================================
-- 1) Edit the email list below, then run the INSERT.
-- 2) Run the two SELECTs and READ the output.

INSERT INTO public.admin_users (id, role)
SELECT id, 'super_admin'
FROM auth.users
WHERE lower(email) IN (
    'replace-with-your-admin-email@example.com'
)
ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role;

-- Who is an admin now? (should be exactly the people you expect)
SELECT u.email, a.role, a.created_at
FROM public.admin_users a
JOIN auth.users u ON u.id = a.id
ORDER BY a.created_at;

-- EVERY account that exists. Anyone you do not recognise: delete them in
-- Dashboard → Authentication → Users. Also consider turning OFF public
-- sign-ups (Authentication → Providers → Email → "Allow new users to sign up")
-- since admins are created by script/SQL, not by self-registration.
SELECT id, email, created_at, last_sign_in_at
FROM auth.users
ORDER BY created_at;
