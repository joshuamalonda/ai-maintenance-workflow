ALTER TABLE public.maintenance_cases REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.maintenance_cases;