-- Dev Settings: aggregated job counts per master (replaces full jobs_ledger client scan).

CREATE OR REPLACE FUNCTION public.list_job_counts_by_master_for_dev_settings()
RETURNS TABLE (master_user_id uuid, job_count bigint)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'list_job_counts_by_master_for_dev_settings: not authenticated';
  END IF;
  IF NOT public.is_dev() THEN
    RAISE EXCEPTION 'list_job_counts_by_master_for_dev_settings: dev only';
  END IF;

  RETURN QUERY
  SELECT jl.master_user_id, COUNT(*)::bigint AS job_count
  FROM public.jobs_ledger jl
  WHERE jl.master_user_id IS NOT NULL
  GROUP BY jl.master_user_id;
END;
$$;

COMMENT ON FUNCTION public.list_job_counts_by_master_for_dev_settings() IS
  'Returns job counts grouped by jobs_ledger.master_user_id. Dev-only (is_dev). Used by Settings People & accounts.';

REVOKE ALL ON FUNCTION public.list_job_counts_by_master_for_dev_settings() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_job_counts_by_master_for_dev_settings() TO authenticated;
