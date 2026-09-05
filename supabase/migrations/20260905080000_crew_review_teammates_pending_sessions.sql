SET lock_timeout = '3s';

-- Crew deck teammates (v2.2827): count sessions that have not been rejected or revoked, not only
-- APPROVED ones. Approvals lag the week by days (108 pending vs 27 approved sessions in the last
-- 14 days on 2026-09-05), so an approved-only deck was almost always empty. A pending session
-- still means the two people worked the same job the same day, which is all the card claims.

CREATE OR REPLACE FUNCTION public.crew_review_teammates(p_lookback_days integer DEFAULT 14, p_extra_user_ids uuid[] DEFAULT '{}')
RETURNS TABLE (user_id uuid, name text, role text, days_together integer, jobs text[])
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  WITH me AS (
    SELECT DISTINCT cs.job_ledger_id, cs.work_date
    FROM public.clock_sessions cs
    WHERE cs.user_id = (SELECT auth.uid())
      AND cs.job_ledger_id IS NOT NULL
      AND cs.rejected_at IS NULL
      AND cs.revoked_at IS NULL
      AND cs.work_date >= (public.app_today() - GREATEST(COALESCE(p_lookback_days, 14), 1))
  ),
  shared AS (
    SELECT cs.user_id, cs.job_ledger_id, cs.work_date
    FROM public.clock_sessions cs
    JOIN me ON me.job_ledger_id = cs.job_ledger_id AND me.work_date = cs.work_date
    WHERE cs.user_id <> (SELECT auth.uid())
      AND cs.rejected_at IS NULL
      AND cs.revoked_at IS NULL
    GROUP BY cs.user_id, cs.job_ledger_id, cs.work_date
  ),
  per_user AS (
    SELECT s.user_id, COUNT(DISTINCT s.work_date)::integer AS days_together
    FROM shared s
    GROUP BY s.user_id
  ),
  job_labels AS (
    SELECT s.user_id, s.job_ledger_id, MAX(s.work_date) AS last_day
    FROM shared s
    GROUP BY s.user_id, s.job_ledger_id
  ),
  job_lists AS (
    SELECT jl.user_id,
      (ARRAY_AGG(
        trim(BOTH ' — ' FROM concat_ws(' — ', NULLIF(trim(j.hcp_number), ''), COALESCE(NULLIF(trim(j.job_name), ''), NULLIF(trim(j.customer_name), ''))))
        ORDER BY jl.last_day DESC
      ))[1:3] AS jobs
    FROM job_labels jl
    JOIN public.jobs_ledger j ON j.id = jl.job_ledger_id
    GROUP BY jl.user_id
  ),
  candidates AS (
    SELECT pu.user_id FROM per_user pu
    UNION
    SELECT x FROM unnest(COALESCE(p_extra_user_ids, '{}'::uuid[])) AS x WHERE x <> (SELECT auth.uid())
  )
  SELECT
    u.id AS user_id,
    u.name,
    u.role::text AS role,
    COALESCE(pu.days_together, 0) AS days_together,
    COALESCE(jl.jobs, '{}'::text[]) AS jobs
  FROM candidates c
  JOIN public.users u ON u.id = c.user_id AND u.archived_at IS NULL
  LEFT JOIN per_user pu ON pu.user_id = c.user_id
  LEFT JOIN job_lists jl ON jl.user_id = c.user_id
  WHERE (SELECT auth.uid()) IS NOT NULL
  ORDER BY COALESCE(pu.days_together, 0) DESC, u.name
$$;

COMMENT ON FUNCTION public.crew_review_teammates(integer, uuid[]) IS 'Clock-out deck (v2.2824, v2.2827): who the caller shared clock sessions with in the lookback (same job, same day; sessions not rejected or revoked — pending counts), plus any extra ids (their lead). Names come from users; nothing about other people''s hours leaves the function.';
