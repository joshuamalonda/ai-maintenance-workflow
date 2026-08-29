CREATE UNIQUE INDEX IF NOT EXISTS agency_members_one_owner_per_user
  ON public.agency_members (user_id)
  WHERE member_role = 'owner';

CREATE OR REPLACE FUNCTION public.create_agency_for_current_user(_name text)
RETURNS TABLE (id uuid, name text, slug text, notification_phone text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _existing uuid;
  _base text;
  _slug text;
  _n int := 0;
  _new uuid;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT m.agency_id INTO _existing
  FROM public.agency_members m
  WHERE m.user_id = _uid
  ORDER BY m.created_at
  LIMIT 1;

  IF _existing IS NOT NULL THEN
    RETURN QUERY
      SELECT a.id, a.name, a.slug, a.notification_phone
      FROM public.agencies a WHERE a.id = _existing;
    RETURN;
  END IF;

  IF _name IS NULL OR btrim(_name) = '' THEN
    RAISE EXCEPTION 'Agency name is required';
  END IF;

  _base := regexp_replace(lower(btrim(_name)), '[^a-z0-9]+', '-', 'g');
  _base := btrim(_base, '-');
  IF _base = '' THEN _base := 'agency'; END IF;
  _slug := left(_base, 48);

  WHILE EXISTS (SELECT 1 FROM public.agencies a WHERE a.slug = _slug) LOOP
    _n := _n + 1;
    _slug := left(_base, 44) || '-' || _n::text;
  END LOOP;

  INSERT INTO public.agencies (name, slug)
  VALUES (btrim(_name), _slug)
  RETURNING agencies.id INTO _new;

  INSERT INTO public.agency_members (agency_id, user_id, member_role)
  VALUES (_new, _uid, 'owner')
  ON CONFLICT (agency_id, user_id) DO NOTHING;

  RETURN QUERY
    SELECT a.id, a.name, a.slug, a.notification_phone
    FROM public.agencies a WHERE a.id = _new;
END;
$function$;

REVOKE ALL ON FUNCTION public.create_agency_for_current_user(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_agency_for_current_user(text) TO authenticated;