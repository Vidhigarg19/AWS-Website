-- ============================================================
-- 0006 — media_members.must_change_password   (ADDITIVE, SAFE TO APPLY ANY TIME)
-- ============================================================
-- Accounts are created (and reset) by a super admin with a generated TEMPORARY
-- password that has been shared over chat or email. While this flag is TRUE the
-- member can do one thing only: choose their own password
-- (/media/change-password). Every portal page and /api/media/* route checks it
-- on every request, so a reset takes effect on already-open sessions too.
--
-- DEFAULT TRUE: members that exist today were also given temporary passwords,
-- so they are asked to choose their own the next time they open the portal.
-- ============================================================

ALTER TABLE public.media_members
    ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT TRUE;

COMMENT ON COLUMN public.media_members.must_change_password IS
  'TRUE while the member still has a super-admin-issued temporary password. Cleared by POST /api/media/change-password.';
