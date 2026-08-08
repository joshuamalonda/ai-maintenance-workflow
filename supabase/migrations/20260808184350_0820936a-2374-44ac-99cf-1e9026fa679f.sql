GRANT DELETE ON public.maintenance_cases TO authenticated;

CREATE POLICY "Console staff can delete cases"
ON public.maintenance_cases
FOR DELETE
TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.user_roles ur
  WHERE ur.user_id = auth.uid()
    AND ur.role = ANY (ARRAY['admin'::app_role, 'staff'::app_role])
));