SET lock_timeout = '3s';

-- Bid Board → Customer review → row click detail (v2.1382): the individual
-- clock sessions behind one customer's hours, so the modal can show who
-- contributed and where the time went (per bid / per job, expandable).
--
-- SECURITY DEFINER like the two aggregate RPCs this modal already uses
-- (list_bid_estimators_all_time_hours, list_customer_review_job_hours) and
-- with the same session filters, but scoped to a SINGLE customer key per call
-- (the modal only fetches on row click). Row-key semantics mirror the client
-- kernel's customerReviewGroupKey:
--   p_customer_id set          → bids with that customer_id (regardless of
--                                 gc_builder_id) + jobs with that customer_id
--   only p_gc_builder_id set   → legacy bids with NO customer_id and that
--                                 gc_builder_id (no job sessions — job hours
--                                 only group under customer ids)
--   both NULL                  → the "No customer" row (bids with neither)

CREATE OR REPLACE FUNCTION public.list_customer_review_customer_sessions(
  p_customer_id uuid DEFAULT NULL,
  p_gc_builder_id uuid DEFAULT NULL
)
RETURNS TABLE(
  session_id uuid,
  user_id uuid,
  user_name text,
  kind text,
  target_id uuid,
  target_label text,
  bid_number text,
  clocked_in_at timestamp with time zone,
  clocked_out_at timestamp with time zone,
  hours numeric
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH bid_sessions AS (
    SELECT
      cs.id,
      cs.user_id,
      'bid'::text AS kind,
      b.id AS target_id,
      COALESCE(NULLIF(TRIM(b.project_name), ''), 'Untitled bid') AS target_label,
      NULLIF(TRIM(b.bid_number), '') AS bid_number,
      cs.clocked_in_at,
      cs.clocked_out_at
    FROM public.clock_sessions cs
    JOIN public.bids b ON b.id = cs.bid_id
    WHERE cs.rejected_at IS NULL
      AND cs.revoked_at IS NULL
      AND COALESCE(cs.clocked_out_at, now()) > cs.clocked_in_at
      AND (
        (p_customer_id IS NOT NULL AND b.customer_id = p_customer_id)
        OR (p_customer_id IS NULL AND p_gc_builder_id IS NOT NULL
            AND b.customer_id IS NULL AND b.gc_builder_id = p_gc_builder_id)
        OR (p_customer_id IS NULL AND p_gc_builder_id IS NULL
            AND b.customer_id IS NULL AND b.gc_builder_id IS NULL)
      )
  ),
  job_sessions AS (
    SELECT
      cs.id,
      cs.user_id,
      'job'::text AS kind,
      jl.id AS target_id,
      COALESCE(NULLIF(TRIM(jl.job_name), ''), 'Untitled job') AS target_label,
      NULL::text AS bid_number,
      cs.clocked_in_at,
      cs.clocked_out_at
    FROM public.clock_sessions cs
    JOIN public.jobs_ledger jl ON jl.id = cs.job_ledger_id
    WHERE p_customer_id IS NOT NULL
      AND jl.customer_id = p_customer_id
      AND cs.rejected_at IS NULL
      AND cs.revoked_at IS NULL
      AND COALESCE(cs.clocked_out_at, now()) > cs.clocked_in_at
  ),
  all_sessions AS (
    SELECT * FROM bid_sessions
    UNION ALL
    SELECT * FROM job_sessions
  )
  SELECT
    s.id,
    s.user_id,
    COALESCE(u.name, 'Unknown') AS user_name,
    s.kind,
    s.target_id,
    s.target_label,
    s.bid_number,
    s.clocked_in_at,
    s.clocked_out_at,
    (EXTRACT(EPOCH FROM (COALESCE(s.clocked_out_at, now()) - s.clocked_in_at)) / 3600.0)::numeric AS hours
  FROM all_sessions s
  LEFT JOIN public.users u ON u.id = s.user_id
  ORDER BY s.clocked_in_at DESC;
$$;

COMMENT ON FUNCTION public.list_customer_review_customer_sessions(uuid, uuid) IS
  'Bid Board → Customer review row-click detail: the clock sessions behind one customer''s estimating (bid) + job hours, with user names and bid/job labels. Same filters as the modal''s aggregate RPCs (excludes rejected/revoked, clips open sessions at now()); single-customer scope per call.';

GRANT EXECUTE ON FUNCTION public.list_customer_review_customer_sessions(uuid, uuid) TO authenticated;
