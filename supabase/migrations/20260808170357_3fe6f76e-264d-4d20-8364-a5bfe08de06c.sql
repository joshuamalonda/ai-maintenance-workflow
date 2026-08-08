ALTER TABLE public.maintenance_cases ADD COLUMN IF NOT EXISTS call_control_id text;
CREATE INDEX IF NOT EXISTS maintenance_cases_call_control_id_idx ON public.maintenance_cases (call_control_id);