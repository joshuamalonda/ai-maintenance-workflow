ALTER TABLE public.maintenance_cases
  ADD COLUMN IF NOT EXISTS contractor_response_status text,
  ADD COLUMN IF NOT EXISTS contractor_responded_at timestamptz;

ALTER TABLE public.maintenance_cases
  ADD CONSTRAINT maintenance_cases_contractor_response_status_check
  CHECK (contractor_response_status IS NULL OR contractor_response_status IN ('pending','accepted','declined'));