-- One pass over jobs_ledger_thread_notes (RLS + I/O) instead of DISTINCT ON + GROUP BY scans.

CREATE OR REPLACE FUNCTION public.jobs_ledger_thread_note_stats(p_job_ids uuid[])
RETURNS TABLE (
  job_id uuid,
  note_count bigint,
  last_note_at timestamptz,
  last_note_body text,
  last_note_author_name text
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH ranked AS (
    SELECT
      n.job_id,
      n.created_at,
      left(n.body, 400) AS body_prev,
      u.name AS author_nm,
      count(*) OVER (PARTITION BY n.job_id) AS note_count_val,
      row_number() OVER (PARTITION BY n.job_id ORDER BY n.created_at DESC) AS rn
    FROM public.jobs_ledger_thread_notes n
    LEFT JOIN public.users u ON u.id = n.author_user_id
    WHERE n.job_id = ANY(p_job_ids)
  )
  SELECT
    r.job_id,
    r.note_count_val::bigint AS note_count,
    r.created_at AS last_note_at,
    r.body_prev AS last_note_body,
    r.author_nm AS last_note_author_name
  FROM ranked r
  WHERE r.rn = 1;
$$;

COMMENT ON FUNCTION public.jobs_ledger_thread_note_stats(uuid[]) IS 'Per-job thread aggregates for Stages: count, last note time, preview body (400 chars), author display name; only jobs with ≥1 note. Single-scan aggregation.';
