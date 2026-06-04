-- Raise peer candidate row cap so same-master roster beyond 200 is visible in team feedback picker (client filters full list).

CREATE OR REPLACE FUNCTION public.list_feedback_peer_candidates()
RETURNS TABLE (person_id UUID, peer_name TEXT)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
  r TEXT;
  mid UUID;
BEGIN
  IF uid IS NULL THEN RETURN; END IF;

  SELECT u.role INTO r FROM public.users u WHERE u.id = uid;
  IF r IS NULL THEN RETURN; END IF;

  IF r IN ('master_technician', 'dev') THEN
    mid := uid;
  ELSIF r = 'assistant' THEN
    SELECT ma.master_id INTO mid FROM public.master_assistants ma WHERE ma.assistant_id = uid LIMIT 1;
  ELSIF r = 'superintendent' THEN
    SELECT ms.master_id INTO mid FROM public.master_superintendents ms WHERE ms.superintendent_id = uid LIMIT 1;
  ELSE
    SELECT p.master_user_id INTO mid
    FROM public.users u
    INNER JOIN public.people p ON p.archived_at IS NULL
      AND p.email IS NOT NULL AND trim(p.email) <> ''
      AND lower(trim(p.email)) = lower(trim(u.email))
    WHERE u.id = uid
    LIMIT 1;
  END IF;

  IF mid IS NULL THEN RETURN; END IF;

  RETURN QUERY
  SELECT p.id, p.name::text
  FROM public.people p
  WHERE p.master_user_id = mid
    AND p.archived_at IS NULL
  ORDER BY p.name
  LIMIT 5000;
END;
$$;

COMMENT ON FUNCTION public.list_feedback_peer_candidates() IS 'People on the same master roster as the reviewer; for peer feedback selection. Result capped at 5000 rows.';
