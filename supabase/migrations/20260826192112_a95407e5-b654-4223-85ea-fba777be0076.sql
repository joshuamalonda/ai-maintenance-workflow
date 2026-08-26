ALTER TABLE public.agencies ADD COLUMN IF NOT EXISTS notification_phone text;

CREATE POLICY "Members can update their agency"
ON public.agencies
FOR UPDATE
TO authenticated
USING (EXISTS (SELECT 1 FROM public.agency_members m WHERE m.agency_id = agencies.id AND m.user_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.agency_members m WHERE m.agency_id = agencies.id AND m.user_id = auth.uid()));

GRANT UPDATE ON public.agencies TO authenticated;