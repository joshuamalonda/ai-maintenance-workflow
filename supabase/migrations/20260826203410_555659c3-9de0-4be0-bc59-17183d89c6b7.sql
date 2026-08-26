ALTER TABLE public.maintenance_cases
  ADD COLUMN IF NOT EXISTS landlord_decision text,
  ADD COLUMN IF NOT EXISTS landlord_decision_at timestamp with time zone;

ALTER TABLE public.maintenance_cases
  DROP CONSTRAINT IF EXISTS maintenance_cases_landlord_decision_check;

ALTER TABLE public.maintenance_cases
  ADD CONSTRAINT maintenance_cases_landlord_decision_check
  CHECK (landlord_decision IS NULL OR landlord_decision IN ('landlord_handling', 'contractor'));