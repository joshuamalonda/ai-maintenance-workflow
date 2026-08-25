-- =========================
-- landlords
-- =========================
CREATE TABLE public.landlords (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  name text NOT NULL,
  phone text,
  email text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.landlords TO authenticated;
GRANT ALL ON public.landlords TO service_role;
ALTER TABLE public.landlords ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Agency members can view their landlords"
ON public.landlords FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.agency_members m WHERE m.agency_id = landlords.agency_id AND m.user_id = auth.uid()));

CREATE POLICY "Agency members can create their landlords"
ON public.landlords FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public.agency_members m WHERE m.agency_id = landlords.agency_id AND m.user_id = auth.uid()));

CREATE POLICY "Agency members can update their landlords"
ON public.landlords FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public.agency_members m WHERE m.agency_id = landlords.agency_id AND m.user_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.agency_members m WHERE m.agency_id = landlords.agency_id AND m.user_id = auth.uid()));

CREATE POLICY "Agency members can delete their landlords"
ON public.landlords FOR DELETE TO authenticated
USING (EXISTS (SELECT 1 FROM public.agency_members m WHERE m.agency_id = landlords.agency_id AND m.user_id = auth.uid()));

CREATE INDEX idx_landlords_agency_id ON public.landlords(agency_id);

CREATE TRIGGER update_landlords_updated_at
BEFORE UPDATE ON public.landlords
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================
-- tenants
-- =========================
CREATE TABLE public.tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  name text NOT NULL,
  phone text,
  email text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tenants TO authenticated;
GRANT ALL ON public.tenants TO service_role;
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Agency members can view their tenants"
ON public.tenants FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.agency_members m WHERE m.agency_id = tenants.agency_id AND m.user_id = auth.uid()));

CREATE POLICY "Agency members can create their tenants"
ON public.tenants FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public.agency_members m WHERE m.agency_id = tenants.agency_id AND m.user_id = auth.uid()));

CREATE POLICY "Agency members can update their tenants"
ON public.tenants FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public.agency_members m WHERE m.agency_id = tenants.agency_id AND m.user_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.agency_members m WHERE m.agency_id = tenants.agency_id AND m.user_id = auth.uid()));

CREATE POLICY "Agency members can delete their tenants"
ON public.tenants FOR DELETE TO authenticated
USING (EXISTS (SELECT 1 FROM public.agency_members m WHERE m.agency_id = tenants.agency_id AND m.user_id = auth.uid()));

CREATE INDEX idx_tenants_agency_id ON public.tenants(agency_id);

CREATE TRIGGER update_tenants_updated_at
BEFORE UPDATE ON public.tenants
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================
-- properties
-- =========================
CREATE TABLE public.properties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  address text NOT NULL,
  postcode text,
  landlord_id uuid REFERENCES public.landlords(id) ON DELETE SET NULL,
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.properties TO authenticated;
GRANT ALL ON public.properties TO service_role;
ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Agency members can view their properties"
ON public.properties FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.agency_members m WHERE m.agency_id = properties.agency_id AND m.user_id = auth.uid()));

CREATE POLICY "Agency members can create their properties"
ON public.properties FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public.agency_members m WHERE m.agency_id = properties.agency_id AND m.user_id = auth.uid()));

CREATE POLICY "Agency members can update their properties"
ON public.properties FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public.agency_members m WHERE m.agency_id = properties.agency_id AND m.user_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.agency_members m WHERE m.agency_id = properties.agency_id AND m.user_id = auth.uid()));

CREATE POLICY "Agency members can delete their properties"
ON public.properties FOR DELETE TO authenticated
USING (EXISTS (SELECT 1 FROM public.agency_members m WHERE m.agency_id = properties.agency_id AND m.user_id = auth.uid()));

CREATE INDEX idx_properties_agency_id ON public.properties(agency_id);
CREATE INDEX idx_properties_landlord_id ON public.properties(landlord_id);
CREATE INDEX idx_properties_tenant_id ON public.properties(tenant_id);

CREATE TRIGGER update_properties_updated_at
BEFORE UPDATE ON public.properties
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================
-- contractors
-- =========================
CREATE TABLE public.contractors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  name text NOT NULL,
  company text,
  trade text,
  phone text,
  whatsapp text,
  email text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.contractors TO authenticated;
GRANT ALL ON public.contractors TO service_role;
ALTER TABLE public.contractors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Agency members can view their contractors"
ON public.contractors FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.agency_members m WHERE m.agency_id = contractors.agency_id AND m.user_id = auth.uid()));

CREATE POLICY "Agency members can create their contractors"
ON public.contractors FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public.agency_members m WHERE m.agency_id = contractors.agency_id AND m.user_id = auth.uid()));

CREATE POLICY "Agency members can update their contractors"
ON public.contractors FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public.agency_members m WHERE m.agency_id = contractors.agency_id AND m.user_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.agency_members m WHERE m.agency_id = contractors.agency_id AND m.user_id = auth.uid()));

CREATE POLICY "Agency members can delete their contractors"
ON public.contractors FOR DELETE TO authenticated
USING (EXISTS (SELECT 1 FROM public.agency_members m WHERE m.agency_id = contractors.agency_id AND m.user_id = auth.uid()));

CREATE INDEX idx_contractors_agency_id ON public.contractors(agency_id);

CREATE TRIGGER update_contractors_updated_at
BEFORE UPDATE ON public.contractors
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================
-- contractor_properties (join)
-- =========================
CREATE TABLE public.contractor_properties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  contractor_id uuid NOT NULL REFERENCES public.contractors(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (property_id, contractor_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.contractor_properties TO authenticated;
GRANT ALL ON public.contractor_properties TO service_role;
ALTER TABLE public.contractor_properties ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Agency members can view their contractor assignments"
ON public.contractor_properties FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.properties p
  JOIN public.agency_members m ON m.agency_id = p.agency_id
  WHERE p.id = contractor_properties.property_id AND m.user_id = auth.uid()
));

CREATE POLICY "Agency members can create their contractor assignments"
ON public.contractor_properties FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.properties p
    JOIN public.agency_members m ON m.agency_id = p.agency_id
    WHERE p.id = contractor_properties.property_id AND m.user_id = auth.uid()
  )
  AND EXISTS (
    SELECT 1 FROM public.contractors c
    JOIN public.agency_members m2 ON m2.agency_id = c.agency_id
    WHERE c.id = contractor_properties.contractor_id AND m2.user_id = auth.uid()
  )
);

CREATE POLICY "Agency members can delete their contractor assignments"
ON public.contractor_properties FOR DELETE TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.properties p
  JOIN public.agency_members m ON m.agency_id = p.agency_id
  WHERE p.id = contractor_properties.property_id AND m.user_id = auth.uid()
));

CREATE INDEX idx_contractor_properties_property_id ON public.contractor_properties(property_id);
CREATE INDEX idx_contractor_properties_contractor_id ON public.contractor_properties(contractor_id);