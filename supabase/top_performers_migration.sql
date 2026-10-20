-- Adds top-performer tracking and excellence certificate support to the V2 schema without dropping or deleting data.

ALTER TABLE public.certificates
  ADD COLUMN IF NOT EXISTS award_title TEXT;

ALTER TABLE public.certificates
  ALTER COLUMN attendance_id DROP NOT NULL;

CREATE TABLE IF NOT EXISTS public.top_performers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  participant_id UUID NOT NULL REFERENCES public.participants(id) ON DELETE CASCADE,
  rank INTEGER NOT NULL CHECK (rank > 0),
  full_name TEXT NOT NULL,
  course TEXT NOT NULL,
  roll_no TEXT NOT NULL,
  UNIQUE (event_id, participant_id)
);

CREATE INDEX IF NOT EXISTS idx_top_performers_event_rank
  ON public.top_performers (event_id, rank);

CREATE INDEX IF NOT EXISTS idx_top_performers_participant
  ON public.top_performers (participant_id);

ALTER TABLE public.top_performers ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'top_performers'
      AND policyname = 'Admin full access top_performers'
  ) THEN
    CREATE POLICY "Admin full access top_performers"
      ON public.top_performers
      FOR ALL
      TO authenticated
      USING (true)
      WITH CHECK (true);
  END IF;
END
$$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_certificates_excellence_event_participant
  ON public.certificates (event_id, participant_id)
  WHERE award_title IS NOT NULL;
