-- Extend thread note stats for Stages "last activity" column; migrate stage_notes into thread; drop stage_notes.

-- One row per job: only if legacy stage_notes is non-empty, master exists in users, and job has no thread yet.
INSERT INTO public.jobs_ledger_thread_notes (job_id, author_user_id, body, created_at)
SELECT j.id,
       j.master_user_id,
       left(trim(j.stage_notes), 2000),
       now()
FROM public.jobs_ledger j
WHERE j.stage_notes IS NOT NULL
  AND trim(j.stage_notes) <> ''
  AND char_length(trim(j.stage_notes)) >= 1
  AND EXISTS (SELECT 1 FROM public.users u WHERE u.id = j.master_user_id)
  AND NOT EXISTS (SELECT 1 FROM public.jobs_ledger_thread_notes n WHERE n.job_id = j.id);

-- OUT parameters changed; Postgres requires drop before recreate.
DROP FUNCTION IF EXISTS public.jobs_ledger_thread_note_stats(uuid[]);

CREATE FUNCTION public.jobs_ledger_thread_note_stats(p_job_ids uuid[])
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
  WITH latest AS (
    SELECT DISTINCT ON (n.job_id)
      n.job_id,
      n.created_at AS ln_at,
      left(n.body, 400) AS ln_body,
      u.name AS ln_author_name
    FROM public.jobs_ledger_thread_notes n
    LEFT JOIN public.users u ON u.id = n.author_user_id
    WHERE n.job_id = ANY(p_job_ids)
    ORDER BY n.job_id, n.created_at DESC
  ),
  counts AS (
    SELECT n2.job_id, count(*)::bigint AS cnt
    FROM public.jobs_ledger_thread_notes n2
    WHERE n2.job_id = ANY(p_job_ids)
    GROUP BY n2.job_id
  )
  SELECT c.job_id,
         c.cnt AS note_count,
         l.ln_at AS last_note_at,
         l.ln_body AS last_note_body,
         l.ln_author_name AS last_note_author_name
  FROM counts c
  INNER JOIN latest l ON l.job_id = c.job_id;
$$;

COMMENT ON FUNCTION public.jobs_ledger_thread_note_stats(uuid[]) IS 'Per-job thread aggregates for Stages: count, last note time, preview body (400 chars), author display name; only jobs with ≥1 note.';

GRANT EXECUTE ON FUNCTION public.jobs_ledger_thread_note_stats(uuid[]) TO authenticated;

ALTER TABLE public.jobs_ledger DROP COLUMN IF EXISTS stage_notes;
