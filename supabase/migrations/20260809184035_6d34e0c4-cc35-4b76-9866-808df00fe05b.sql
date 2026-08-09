-- 1. Agencies
CREATE TABLE public.agencies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.agencies TO authenticated;
GRANT ALL ON public.agencies TO service_role;
ALTER TABLE public.agencies ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_agencies_updated_at BEFORE UPDATE ON public.agencies
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Agency members
CREATE TABLE public.agency_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  member_role text NOT NULL DEFAULT 'staff',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (agency_id, user_id)
);
CREATE INDEX agency_members_user_idx ON public.agency_members (user_id);
GRANT SELECT ON public.agency_members TO authenticated;
GRANT ALL ON public.agency_members TO service_role;
ALTER TABLE public.agency_members ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_agency_members_updated_at BEFORE UPDATE ON public.agency_members
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "Members can view their own memberships"
  ON public.agency_members FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Members can view their agencies"
  ON public.agencies FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.agency_members m
    WHERE m.agency_id = agencies.id AND m.user_id = auth.uid()
  ));

-- 3. Channel endpoints (destination number / WhatsApp sender -> agency)
CREATE TABLE public.channel_endpoints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  channel text NOT NULL CHECK (channel IN ('phone','whatsapp')),
  identifier text NOT NULL,
  identifier_key text NOT NULL,
  label text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (channel, identifier_key)
);
GRANT SELECT ON public.channel_endpoints TO authenticated;
GRANT ALL ON public.channel_endpoints TO service_role;
ALTER TABLE public.channel_endpoints ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_channel_endpoints_updated_at BEFORE UPDATE ON public.channel_endpoints
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "Members can view their agency endpoints"
  ON public.channel_endpoints FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.agency_members m
    WHERE m.agency_id = channel_endpoints.agency_id AND m.user_id = auth.uid()
  ));

-- 4. agency_id on maintenance_cases + backfill
ALTER TABLE public.maintenance_cases
  ADD COLUMN agency_id uuid REFERENCES public.agencies(id) ON DELETE RESTRICT;

INSERT INTO public.agencies (name, slug) VALUES ('Ovelo', 'ovelo');

INSERT INTO public.agency_members (agency_id, user_id, member_role)
SELECT a.id, u.id, 'owner'
FROM public.agencies a CROSS JOIN auth.users u
WHERE a.slug = 'ovelo';

UPDATE public.maintenance_cases
SET agency_id = (SELECT id FROM public.agencies WHERE slug = 'ovelo')
WHERE agency_id IS NULL;

ALTER TABLE public.maintenance_cases ALTER COLUMN agency_id SET NOT NULL;
CREATE INDEX maintenance_cases_agency_idx ON public.maintenance_cases (agency_id);

INSERT INTO public.channel_endpoints (agency_id, channel, identifier, identifier_key, label)
SELECT id, 'phone', '+441137336198', '441137336198', 'Ovelo test line'
FROM public.agencies WHERE slug = 'ovelo';

-- 5. Agency-scoped RLS on maintenance_cases
DROP POLICY IF EXISTS "Console staff can view cases" ON public.maintenance_cases;
DROP POLICY IF EXISTS "Console staff can delete cases" ON public.maintenance_cases;

CREATE POLICY "Agency members can view their cases"
  ON public.maintenance_cases FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.agency_members m
    WHERE m.agency_id = maintenance_cases.agency_id AND m.user_id = auth.uid()
  ));

CREATE POLICY "Agency members can delete their cases"
  ON public.maintenance_cases FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.agency_members m
    WHERE m.agency_id = maintenance_cases.agency_id AND m.user_id = auth.uid()
  ));

-- 6. Agency-scoped recording storage policies (path = <agency_id>/<file>)
DROP POLICY IF EXISTS "Console staff can read call recordings" ON storage.objects;
DROP POLICY IF EXISTS "Console staff can upload call recordings" ON storage.objects;
DROP POLICY IF EXISTS "Console staff can update call recordings" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete call recordings" ON storage.objects;

CREATE POLICY "Agency members can read their recordings"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'call-recordings'
    AND EXISTS (
      SELECT 1 FROM public.agency_members m
      WHERE m.user_id = auth.uid()
        AND m.agency_id::text = (storage.foldername(name))[1]
    )
  );

CREATE POLICY "Agency members can upload their recordings"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'call-recordings'
    AND EXISTS (
      SELECT 1 FROM public.agency_members m
      WHERE m.user_id = auth.uid()
        AND m.agency_id::text = (storage.foldername(name))[1]
    )
  );

CREATE POLICY "Agency members can update their recordings"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'call-recordings'
    AND EXISTS (
      SELECT 1 FROM public.agency_members m
      WHERE m.user_id = auth.uid()
        AND m.agency_id::text = (storage.foldername(name))[1]
    )
  )
  WITH CHECK (
    bucket_id = 'call-recordings'
    AND EXISTS (
      SELECT 1 FROM public.agency_members m
      WHERE m.user_id = auth.uid()
        AND m.agency_id::text = (storage.foldername(name))[1]
    )
  );

CREATE POLICY "Agency owners can delete their recordings"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'call-recordings'
    AND EXISTS (
      SELECT 1 FROM public.agency_members m
      WHERE m.user_id = auth.uid()
        AND m.member_role IN ('owner','admin')
        AND m.agency_id::text = (storage.foldername(name))[1]
    )
  );