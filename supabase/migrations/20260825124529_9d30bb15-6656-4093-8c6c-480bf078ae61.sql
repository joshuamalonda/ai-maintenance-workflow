ALTER TABLE public.maintenance_cases
  ADD COLUMN IF NOT EXISTS property_id uuid REFERENCES public.properties(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS contractor_id uuid REFERENCES public.contractors(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS assigned_at timestamptz;

CREATE INDEX IF NOT EXISTS maintenance_cases_property_id_idx ON public.maintenance_cases(property_id);
CREATE INDEX IF NOT EXISTS maintenance_cases_tenant_id_idx ON public.maintenance_cases(tenant_id);
CREATE INDEX IF NOT EXISTS maintenance_cases_contractor_id_idx ON public.maintenance_cases(contractor_id);