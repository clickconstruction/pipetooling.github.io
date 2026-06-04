-- After DELETE all estimates, MAX(estimate_number) is NULL; COALESCE(..., 0) made setval(..., 0, true)
-- invalid because estimates_estimate_number_seq has MINVALUE 1.

CREATE OR REPLACE FUNCTION public.dev_reset_estimates_for_testing()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  deleted_count int;
  max_en int;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT public.is_dev() THEN
    RAISE EXCEPTION 'Only dev users may reset estimates';
  END IF;

  DELETE FROM public.estimates WHERE true;

  GET DIAGNOSTICS deleted_count = ROW_COUNT;

  SELECT MAX(estimate_number) INTO max_en FROM public.estimates;
  IF max_en IS NULL THEN
    PERFORM setval('public.estimates_estimate_number_seq', 1, false);
  ELSE
    PERFORM setval('public.estimates_estimate_number_seq', max_en, true);
  END IF;

  RETURN deleted_count;
END;
$$;

COMMENT ON FUNCTION public.dev_reset_estimates_for_testing() IS
  'Dev only: DELETE all estimates (WHERE true for pg_safeupdate); resets sequence: empty table -> setval(1,false), else MAX+1 via is_called true.';
