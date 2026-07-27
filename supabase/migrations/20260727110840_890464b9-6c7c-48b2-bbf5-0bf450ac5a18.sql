DROP POLICY IF EXISTS "Maintenance cases are viewable by console users" ON public.maintenance_cases;

REVOKE ALL ON public.maintenance_cases FROM anon;
GRANT SELECT ON public.maintenance_cases TO authenticated;
GRANT ALL ON public.maintenance_cases TO service_role;

CREATE POLICY "Signed-in console users can view cases"
ON public.maintenance_cases
FOR SELECT
TO authenticated
USING (true);