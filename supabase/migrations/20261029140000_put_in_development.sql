SET lock_timeout = '3s';

-- Put the N in (punch list #208 PR 3, v2.6046): the Development page's one press that puts every bid
-- and job at the site's address into the development in one transaction. SECURITY INVOKER: the
-- caller's own update policies on bids and jobs_ledger decide, row by row; a row the caller may not
-- update is left as it is and the counts say what moved. PR 1's backstop trigger on bids and the
-- job's same-master trigger run as on any update.

CREATE OR REPLACE FUNCTION public.put_in_development(p_development_id uuid, p_bid_ids uuid[] DEFAULT '{}'::uuid[], p_job_ids uuid[] DEFAULT '{}'::uuid[])
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'public'
AS $fn$
DECLARE
  v_name text;
  v_bids integer := 0;
  v_jobs integer := 0;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'put_in_development: sign in first' USING ERRCODE = '42501';
  END IF;
  SELECT name INTO v_name FROM public.developments WHERE id = p_development_id;
  IF v_name IS NULL THEN
    RAISE EXCEPTION 'put_in_development: development % not found', p_development_id;
  END IF;
  IF COALESCE(array_length(p_bid_ids, 1), 0) + COALESCE(array_length(p_job_ids, 1), 0) = 0 THEN
    RAISE EXCEPTION 'put_in_development: nothing to put in — name at least one bid or job';
  END IF;
  IF COALESCE(array_length(p_bid_ids, 1), 0) + COALESCE(array_length(p_job_ids, 1), 0) > 500 THEN
    RAISE EXCEPTION 'put_in_development: at most 500 pieces in one press';
  END IF;

  WITH moved AS (
    UPDATE public.bids SET development_id = p_development_id
    WHERE id = ANY(COALESCE(p_bid_ids, '{}'::uuid[])) AND development_id IS DISTINCT FROM p_development_id
    RETURNING id
  ) SELECT count(*) INTO v_bids FROM moved;

  WITH moved AS (
    UPDATE public.jobs_ledger SET development_id = p_development_id
    WHERE id = ANY(COALESCE(p_job_ids, '{}'::uuid[])) AND development_id IS DISTINCT FROM p_development_id
    RETURNING id
  ) SELECT count(*) INTO v_jobs FROM moved;

  RETURN jsonb_build_object('ok', true, 'development', v_name, 'bids', v_bids, 'jobs', v_jobs);
END;
$fn$;

REVOKE ALL ON FUNCTION public.put_in_development(uuid, uuid[], uuid[]) FROM anon;
REVOKE ALL ON FUNCTION public.put_in_development(uuid, uuid[], uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.put_in_development(uuid, uuid[], uuid[]) TO authenticated;

COMMENT ON FUNCTION public.put_in_development(uuid, uuid[], uuid[]) IS 'The Development page''s Put the N in (v2.6046): every named bid and job into the development in one transaction, as the caller (SECURITY INVOKER, the tables'' own update policies decide). Returns the counts that moved.';
