-- Dev reset: prior versions deleted by resolved master_user_id. RLS for estimates allows devs to
-- SELECT all rows (user_can_access_estimate() OR-clauses include public.is_dev() first). A dev who
-- is not linked as assistant/creator to the company master therefore still sees estimates under
-- that master but DELETE matched zero rows. Align RPC with visibility: dev-only caller deletes
-- all estimate rows, then resets global estimate_number sequence.

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

  DELETE FROM public.estimates;

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
  'Dev only: DELETE all rows from estimates (matches dev RLS breadth); cascades thread notes and customer events; resets estimates_estimate_number_seq from MAX.';
