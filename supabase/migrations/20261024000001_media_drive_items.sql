-- ============================================================
-- 0005 — Google Drive link items            (ADDITIVE, SAFE TO APPLY ANY TIME)
-- ============================================================
-- Lets a media_items row point at a file that stays in Google Drive instead
-- of S3 ("link only": nothing is copied). Existing S3 rows are untouched:
-- they get source = 's3' by default.
--
--   source = 's3'    -> original_key required (as before)
--   source = 'drive' -> drive_file_id required; no S3 keys; size may be unknown
--
-- A Drive file id is not a secret: anyone who can view the file already has it
-- (it is in the share link), so it is safe in the public column list.
-- ============================================================

ALTER TABLE public.media_items
    ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 's3'
        CHECK (source IN ('s3', 'drive')),
    ADD COLUMN IF NOT EXISTS drive_file_id TEXT
        CHECK (drive_file_id IS NULL OR drive_file_id ~ '^[A-Za-z0-9_-]{10,128}$');

-- Drive rows have no S3 original and may not know the size.
ALTER TABLE public.media_items ALTER COLUMN original_key DROP NOT NULL;
ALTER TABLE public.media_items ALTER COLUMN size_bytes DROP NOT NULL;
ALTER TABLE public.media_items DROP CONSTRAINT IF EXISTS media_items_size_bytes_check;
ALTER TABLE public.media_items
    ADD CONSTRAINT media_items_size_bytes_check
    CHECK (size_bytes IS NULL OR size_bytes > 0);

-- Each source must carry what it needs, and nothing from the other source.
ALTER TABLE public.media_items DROP CONSTRAINT IF EXISTS media_items_source_shape;
ALTER TABLE public.media_items
    ADD CONSTRAINT media_items_source_shape CHECK (
        (source = 's3'    AND original_key IS NOT NULL AND drive_file_id IS NULL)
     OR (source = 'drive' AND drive_file_id IS NOT NULL AND original_key IS NULL
                          AND web_key IS NULL AND thumb_key IS NULL AND poster_key IS NULL)
    );

-- A Drive row is shown straight from Drive, so 'ready' needs no web_key.
ALTER TABLE public.media_items DROP CONSTRAINT IF EXISTS media_items_ready_has_web_key;
ALTER TABLE public.media_items
    ADD CONSTRAINT media_items_ready_has_web_key
    CHECK (status <> 'ready' OR web_key IS NOT NULL OR source = 'drive');

-- The same Drive file cannot be linked twice to one event (re-importing a
-- folder is then harmless). Soft-deleted rows do not block a re-import.
CREATE UNIQUE INDEX IF NOT EXISTS media_items_drive_file_per_event_idx
    ON public.media_items (event_id, drive_file_id)
    WHERE source = 'drive' AND deleted_at IS NULL;
