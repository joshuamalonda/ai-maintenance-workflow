ALTER TABLE public.maintenance_cases
  ADD COLUMN IF NOT EXISTS caller_number text,
  ADD COLUMN IF NOT EXISTS call_leg_id text,
  ADD COLUMN IF NOT EXISTS recording_storage_path text,
  ADD COLUMN IF NOT EXISTS enrichment_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS enrichment_attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS enrichment_last_checked_at timestamptz;

CREATE INDEX IF NOT EXISTS maintenance_cases_caller_number_idx ON public.maintenance_cases (caller_number);
CREATE INDEX IF NOT EXISTS maintenance_cases_call_leg_id_idx ON public.maintenance_cases (call_leg_id);
CREATE INDEX IF NOT EXISTS maintenance_cases_conversation_id_idx ON public.maintenance_cases (conversation_id);
CREATE INDEX IF NOT EXISTS maintenance_cases_enrichment_idx ON public.maintenance_cases (enrichment_status, reported_at DESC);