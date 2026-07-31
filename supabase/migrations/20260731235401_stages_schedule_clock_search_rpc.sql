SET lock_timeout = '3s';

-- Server-side matcher for the Stages "Schedule & time in search" supplement (v2.1185).
--
-- Replaces the client-side path that chunked every loaded job id into .in() queries
-- against BOTH job_schedule_blocks and clock_sessions (up to 8,000 rows per 150-id
-- chunk, per table) and substring-matched in the browser — the whole note corpus
-- shipped over the wire per search settle. This does the same matching in SQL and
-- returns only the matching job ids, in one round trip.
--
-- SECURITY INVOKER on purpose: it runs under the caller's RLS, exactly like the
-- client queries it replaces — no new visibility. The LEFT JOINs to users behave
-- like the client's embedded users(name) selects: rows the caller cannot read
-- contribute a NULL name, matching nothing.
--
-- Match semantics mirror src/lib/jobsStagesScheduleSessionSearch.ts exactly:
-- case-insensitive SUBSTRING (strpos, not ILIKE — user-typed % and _ stay literal)
-- on note/notes, the assignee/puncher name, and work_date::text; clock sessions
-- must be job-linked and non-revoked; queries under 2 chars match nothing.
CREATE OR REPLACE FUNCTION public.search_job_ids_matching_schedule_or_clock(
  p_job_ids uuid[],
  p_query text
)
RETURNS uuid[]
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH q AS (
    SELECT lower(trim(coalesce(p_query, ''))) AS ql
  )
  SELECT coalesce(array_agg(DISTINCT m.job_id), '{}'::uuid[])
  FROM (
    SELECT b.job_id
    FROM q
    JOIN public.job_schedule_blocks b ON b.job_id = ANY (p_job_ids)
    LEFT JOIN public.users u ON u.id = b.assignee_user_id
    WHERE length(q.ql) >= 2
      AND (
        strpos(lower(coalesce(b.note, '')), q.ql) > 0
        OR strpos(b.work_date::text, q.ql) > 0
        OR strpos(lower(coalesce(u.name, '')), q.ql) > 0
      )
    UNION
    SELECT s.job_ledger_id
    FROM q
    JOIN public.clock_sessions s ON s.job_ledger_id = ANY (p_job_ids)
    LEFT JOIN public.users u ON u.id = s.user_id
    WHERE length(q.ql) >= 2
      AND s.revoked_at IS NULL
      AND (
        strpos(lower(coalesce(s.notes, '')), q.ql) > 0
        OR strpos(coalesce(s.work_date::text, ''), q.ql) > 0
        OR strpos(lower(coalesce(u.name, '')), q.ql) > 0
      )
  ) m(job_id)
$$;

COMMENT ON FUNCTION public.search_job_ids_matching_schedule_or_clock(uuid[], text) IS
  'Stages search supplement (v2.1185): job ids among p_job_ids with a schedule block or non-revoked, job-linked clock session whose note, person name, or work_date contains p_query (case-insensitive substring). SECURITY INVOKER — caller RLS applies.';

GRANT EXECUTE ON FUNCTION public.search_job_ids_matching_schedule_or_clock(uuid[], text) TO authenticated;
