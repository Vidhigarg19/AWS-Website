-- Step 9: indexes for the daily cleanup job (partial: they stay tiny).
-- Soft-deleted rows waiting out the grace period, oldest first.
CREATE INDEX IF NOT EXISTS media_items_deleted_at_idx
    ON public.media_items (deleted_at)
    WHERE deleted_at IS NOT NULL;

-- Failed / processing rows by last change (retention + stuck detection).
CREATE INDEX IF NOT EXISTS media_items_failed_processing_idx
    ON public.media_items (status, updated_at)
    WHERE status IN ('failed', 'processing') AND deleted_at IS NULL;
