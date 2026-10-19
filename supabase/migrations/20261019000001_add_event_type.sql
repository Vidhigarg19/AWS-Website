-- ============================================================
-- Migration: Add event_type column to events table
-- ============================================================
-- Allows categorizing sessions as Workshop, Hackathon, Quiz, Event, or custom.

ALTER TABLE public.events 
ADD COLUMN IF NOT EXISTS event_type TEXT DEFAULT 'Workshop';

COMMENT ON COLUMN public.events.event_type IS 'Category of event: Workshop, Hackathon, Quiz, Event, or custom';
