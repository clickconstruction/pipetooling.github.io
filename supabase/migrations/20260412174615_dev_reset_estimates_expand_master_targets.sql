-- Dev reset: previous logic used only resolved `mid`. Pure dev accounts often fall through to mid = auth.uid(),
-- while estimates use the real master_user_id (e.g. company master). Expand DELETE to all master ids linked
-- to the dev via people/assistant/superintendent/primary resolution AND distinct masters from estimates they created,
-- plus assistant/superintendent/primary links (same masters real org work typically uses).

CREATE OR REPLACE FUNCTION public.dev_reset_estimates_for_testing()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  r text;
  mid uuid;
  deleted_count int;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT public.is_dev() THEN
    RAISE EXCEPTION 'Only dev users may reset estimates';
  END IF;

  SELECT u.role INTO r FROM public.users u WHERE u.id = uid;
  IF r IS NULL THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  IF r = 'master_technician' THEN
    mid := uid;
  ELSIF r = 'assistant' THEN
    SELECT ma.master_id INTO mid FROM public.master_assistants ma WHERE ma.assistant_id = uid LIMIT 1;
  ELSIF r = 'superintendent' THEN
    SELECT ms.master_id INTO mid FROM public.master_superintendents ms WHERE ms.superintendent_id = uid LIMIT 1;
  ELSIF r = 'dev' THEN
    SELECT p.master_user_id INTO mid
    FROM public.users u
    INNER JOIN public.people p ON p.archived_at IS NULL
      AND p.email IS NOT NULL AND trim(p.email) <> ''
      AND lower(trim(p.email)) = lower(trim(u.email))
    WHERE u.id = uid
    LIMIT 1;
    IF mid IS NULL THEN
      SELECT ma.master_id INTO mid FROM public.master_assistants ma WHERE ma.assistant_id = uid LIMIT 1;
    END IF;
    IF mid IS NULL THEN
      SELECT ms.master_id INTO mid FROM public.master_superintendents ms WHERE ms.superintendent_id = uid LIMIT 1;
    END IF;
    IF mid IS NULL THEN
      SELECT mp.master_id INTO mid FROM public.master_primaries mp WHERE mp.primary_id = uid LIMIT 1;
    END IF;
    IF mid IS NULL THEN
      mid := uid;
    END IF;
  ELSE
    SELECT p.master_user_id INTO mid
    FROM public.users u
    INNER JOIN public.people p ON p.archived_at IS NULL
      AND p.email IS NOT NULL AND trim(p.email) <> ''
      AND lower(trim(p.email)) = lower(trim(u.email))
    WHERE u.id = uid
    LIMIT 1;
  END IF;

  IF mid IS NULL THEN
    RAISE EXCEPTION 'Could not resolve org master for current user';
  END IF;

  DELETE FROM public.estimates e
  WHERE e.master_user_id IN (
    SELECT mid
    UNION
    SELECT DISTINCT e2.master_user_id
    FROM public.estimates e2
    WHERE e2.created_by = uid
    UNION
    SELECT ma.master_id
    FROM public.master_assistants ma
    WHERE ma.assistant_id = uid
    UNION
    SELECT ms.master_id
    FROM public.master_superintendents ms
    WHERE ms.superintendent_id = uid
    UNION
    SELECT mp.master_id
    FROM public.master_primaries mp
    WHERE mp.primary_id = uid
  );

  GET DIAGNOSTICS deleted_count = ROW_COUNT;

  PERFORM setval(
    'public.estimates_estimate_number_seq',
    COALESCE((SELECT MAX(estimate_number) FROM public.estimates), 0),
    true
  );

  RETURN deleted_count;
END;
$$;

COMMENT ON FUNCTION public.dev_reset_estimates_for_testing() IS
  'Dev only: DELETE estimates whose master_user_id matches resolved org id OR distinct masters from estimates created_by caller OR master_assistants/superintendents/primaries; resets global sequence from MAX.';
