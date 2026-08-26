ALTER TABLE public.maintenance_cases ADD COLUMN IF NOT EXISTS case_created_notified_at TIMESTAMPTZ;

-- Backfill: cases already linked to a property were already notified at intake,
-- so mark them as notified to avoid a retroactive SMS burst.
UPDATE public.maintenance_cases SET case_created_notified_at = COALESCE(updated_at, created_at) WHERE property_id IS NOT NULL AND case_created_notified_at IS NULL;