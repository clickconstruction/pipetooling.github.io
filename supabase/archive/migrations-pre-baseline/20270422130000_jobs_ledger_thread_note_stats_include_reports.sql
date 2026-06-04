-- Stages "Last activity": batch RPC includes latest field report per job (RLS) vs thread notes; report-only jobs get a row.

DROP FUNCTION IF EXISTS public.jobs_ledger_thread_note_stats(uuid[]);

CREATE OR REPLACE FUNCTION public.jobs_ledger_thread_note_stats(p_job_ids uuid[])
RETURNS TABLE (
  job_id uuid,
  note_count bigint,
  last_note_at timestamptz,
  last_note_body text,
  last_note_author_name text,
  report_count bigint,
  last_report_at timestamptz,
  last_report_author_name text,
  last_report_template_name text,
  last_report_preview text
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
    WHERE p_job_ids IS NOT NULL
      AND n.job_id = ANY (p_job_ids)
  ),
  note_one AS (
    SELECT
      r.job_id,
      r.note_count_val::bigint AS note_count,
      r.created_at AS last_note_at,
      r.body_prev AS last_note_body,
      r.author_nm AS last_note_author_name
    FROM ranked r
    WHERE r.rn = 1
  ),
  rep_counts AS (
    SELECT r.job_ledger_id AS job_id, count(*)::bigint AS cnt
    FROM public.reports r
    WHERE p_job_ids IS NOT NULL
      AND r.job_ledger_id = ANY (p_job_ids)
    GROUP BY r.job_ledger_id
  ),
  rep_latest AS (
    SELECT DISTINCT ON (r.job_ledger_id)
      r.job_ledger_id AS job_id,
      r.created_at AS last_report_at,
      u.name AS last_report_author_name,
      rt.name AS last_report_template_name,
      (
        SELECT left(t.val, 200)
        FROM jsonb_each_text(coalesce(r.field_values, '{}'::jsonb)) AS t(key, val)
        WHERE t.val IS NOT NULL
          AND btrim(t.val) <> ''
        LIMIT 1
      ) AS last_report_preview
    FROM public.reports r
    JOIN public.users u ON u.id = r.created_by_user_id
    JOIN public.report_templates rt ON rt.id = r.template_id
    WHERE p_job_ids IS NOT NULL
      AND r.job_ledger_id = ANY (p_job_ids)
    ORDER BY r.job_ledger_id, r.created_at DESC
  ),
  eligible AS (
    SELECT n.job_id FROM note_one n
    UNION
    SELECT rc.job_id FROM rep_counts rc
  )
  SELECT
    e.job_id,
    coalesce(n.note_count, 0::bigint) AS note_count,
    n.last_note_at,
    n.last_note_body,
    n.last_note_author_name,
    coalesce(rc.cnt, 0::bigint) AS report_count,
    l.last_report_at,
    l.last_report_author_name,
    l.last_report_template_name,
    l.last_report_preview
  FROM eligible e
  LEFT JOIN note_one n ON n.job_id = e.job_id
  LEFT JOIN rep_counts rc ON rc.job_id = e.job_id
  LEFT JOIN rep_latest l ON l.job_id = e.job_id;
$$;

COMMENT ON FUNCTION public.jobs_ledger_thread_note_stats(uuid[]) IS
  'Per-job Stages activity: note_count + last note fields; report_count + last report (template, author, field preview) for RLS-visible reports. One row per job with ≥1 note or ≥1 report.';

GRANT EXECUTE ON FUNCTION public.jobs_ledger_thread_note_stats(uuid[]) TO authenticated;
