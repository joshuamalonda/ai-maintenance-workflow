CREATE POLICY "Console staff can read call recordings"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'call-recordings'
  AND EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.role = ANY (ARRAY['admin'::public.app_role, 'staff'::public.app_role])
  )
);

CREATE POLICY "Console staff can upload call recordings"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'call-recordings'
  AND EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.role = ANY (ARRAY['admin'::public.app_role, 'staff'::public.app_role])
  )
);

CREATE POLICY "Console staff can update call recordings"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'call-recordings'
  AND EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.role = ANY (ARRAY['admin'::public.app_role, 'staff'::public.app_role])
  )
)
WITH CHECK (
  bucket_id = 'call-recordings'
  AND EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.role = ANY (ARRAY['admin'::public.app_role, 'staff'::public.app_role])
  )
);

CREATE POLICY "Console admins can delete call recordings"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'call-recordings'
  AND EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.role = 'admin'::public.app_role
  )
);