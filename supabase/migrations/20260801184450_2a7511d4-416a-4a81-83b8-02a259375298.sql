CREATE SEQUENCE IF NOT EXISTS public.maintenance_case_ref_seq START WITH 1 INCREMENT BY 1;

CREATE OR REPLACE FUNCTION public.next_case_reference()
RETURNS text
LANGUAGE sql
VOLATILE
SET search_path = public
AS $$
  SELECT 'MC-' || lpad(nextval('public.maintenance_case_ref_seq')::text, 6, '0')
$$;

ALTER TABLE public.maintenance_cases
  ALTER COLUMN reference_code SET DEFAULT public.next_case_reference();

SELECT setval('public.maintenance_case_ref_seq',
  GREATEST(1, COALESCE((SELECT MAX(NULLIF(regexp_replace(reference_code, '\D', '', 'g'), ''))::bigint FROM public.maintenance_cases), 0)));