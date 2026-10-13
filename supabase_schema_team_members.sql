-- ============================================================
-- AWS SBG — Schema: Team Members
-- ============================================================
--
-- This migration adds the `team_members` table to store
-- AWS Student Builder Group team member details.
--
-- Fields: name, pic_url, course, branch, year, role
--
-- ============================================================

-- Enable pgcrypto if not already enabled
CREATE EXTENSION IF NOT EXISTS "pgcrypto";


-- ── team_members ──────────────────────────────────────────────

CREATE TABLE public.team_members (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        TEXT NOT NULL,
    pic_url     TEXT,                        -- URL to member's profile picture
    course      TEXT NOT NULL,               -- e.g. B.Tech, BCA, MCA
    branch      TEXT NOT NULL,               -- e.g. CSE, ECE, IT
    year        TEXT NOT NULL,               -- e.g. 1st Year, 2nd Year, 3rd Year, 4th Year
    role        TEXT NOT NULL,               -- e.g. Tech Lead, Cloud Lead, Member
    batch       TEXT NOT NULL DEFAULT '2026-27', -- e.g. 2026-27, 2027-28
    display_order INT NOT NULL DEFAULT 0,    -- for custom ordering in the UI
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.team_members IS 'AWS SBG team members displayed on the Team page. Managed via the admin panel.';

-- Add batch column if table already exists (safe migration)
ALTER TABLE public.team_members ADD COLUMN IF NOT EXISTS batch TEXT NOT NULL DEFAULT '2026-27';

CREATE INDEX IF NOT EXISTS idx_team_members_role ON public.team_members (role);
CREATE INDEX IF NOT EXISTS idx_team_members_batch ON public.team_members (batch);
CREATE INDEX IF NOT EXISTS idx_team_members_display_order ON public.team_members (display_order);


-- ── Row Level Security ────────────────────────────────────────

ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

-- Public read access (team page is public)
CREATE POLICY "Public can read team members"
    ON public.team_members FOR SELECT
    USING (true);

-- Admin full access
CREATE POLICY "Admin full access team_members"
    ON public.team_members FOR ALL TO authenticated
    USING (true) WITH CHECK (true);


-- ── Updated-at trigger ────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_team_members_updated_at
    BEFORE UPDATE ON public.team_members
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();


-- ── Storage Bucket: team-avatars (Optional / Recommended) ────
-- If not already created automatically via the admin API, you can
-- create the public bucket in Supabase Storage with:

INSERT INTO storage.buckets (id, name, public)
VALUES ('team-avatars', 'team-avatars', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Policy to allow public read access for avatars
CREATE POLICY "Public team avatars access"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'team-avatars');

-- Policy to allow authenticated admin uploads
CREATE POLICY "Admin upload team avatars"
    ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'team-avatars');

