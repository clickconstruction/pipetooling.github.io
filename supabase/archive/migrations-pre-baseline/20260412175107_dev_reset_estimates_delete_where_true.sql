-- pg_safeupdate on the database rejects DELETE without WHERE. Use an always-true predicate (dev-only RPC).

CREATE OR REPLACE FUNCTION public.dev_reset_estimates_for_testing()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  deleted_count int;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT public.is_dev() THEN
    RAISE EXCEPTION 'Only dev users may reset estimates';
  END IF;

  DELETE FROM public.estimates WHERE true;

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
  'Dev only: DELETE all estimates (WHERE true for pg_safeupdate); resets estimates_estimate_number_seq.';
