-- Dev-only: delete all estimates for the caller's resolved org (master_user_id) and realign global estimate_number sequence.

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

  -- Match list_feedback_peer_candidates: resolve effective master for dev (and same branches if role differs).
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

  DELETE FROM public.estimates
  WHERE master_user_id = mid;

  GET DIAGNOSTICS deleted_count = ROW_COUNT;

  -- Global sequence: next insert gets MAX(estimate_number)+1, or 1 when table is empty (same as 20260405003103).
  PERFORM setval(
    'public.estimates_estimate_number_seq',
    COALESCE((SELECT MAX(estimate_number) FROM public.estimates), 0),
    true
  );

  RETURN deleted_count;
END;
$$;

COMMENT ON FUNCTION public.dev_reset_estimates_for_testing() IS
  'Dev only: DELETE all estimates for resolved master_user_id (org); cascades thread notes and customer events; resets estimates_estimate_number_seq from remaining MAX.';

GRANT EXECUTE ON FUNCTION public.dev_reset_estimates_for_testing() TO authenticated;
