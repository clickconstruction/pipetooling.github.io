-- Stages activity preview prefers real notes over clock stamps (v2.1045).
--
-- "Arrived at job" / "Leaving job" stamps are ordinary thread notes with a
-- fixed body suffix (buildJobThreadStampBody) — no marker column. The stats
-- RPC used to surface the newest note unconditionally, so a clock-out right
-- after a substantive note buried it on the Stages board. Now the last-note
-- pick skips stamp bodies and only falls back to the newest stamp when the
-- thread has nothing else. Note counts are unchanged (stamps still count and
-- still show in the expanded thread).

CREATE OR REPLACE FUNCTION "public"."jobs_ledger_thread_note_stats"("p_job_ids" "uuid"[]) RETURNS TABLE("job_id" "uuid", "note_count" bigint, "last_note_at" timestamp with time zone, "last_note_body" "text", "last_note_author_name" "text", "report_count" bigint, "last_report_at" timestamp with time zone, "last_report_author_name" "text", "last_report_template_name" "text", "last_report_preview" "text")
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public'
    AS $_$
  WITH counts AS (
    SELECT n.job_id, count(*)::bigint AS note_count_val
    FROM public.jobs_ledger_thread_notes n
    WHERE p_job_ids IS NOT NULL
      AND n.job_id = ANY (p_job_ids)
    GROUP BY n.job_id
  ),
  ranked AS (
    SELECT
      n.job_id,
      n.created_at,
      left(n.body, 400) AS body_prev,
      u.name AS author_nm,
      -- Non-stamp notes rank first (false < true), newest within each group:
      -- rn = 1 is the newest substantive note, or the newest stamp when the
      -- thread holds nothing else.
      row_number() OVER (
        PARTITION BY n.job_id
        ORDER BY (n.body ~ '— (Arrived at job|Leaving job)$') ASC, n.created_at DESC
      ) AS rn
    FROM public.jobs_ledger_thread_notes n
    LEFT JOIN public.users u ON u.id = n.author_user_id
    WHERE p_job_ids IS NOT NULL
      AND n.job_id = ANY (p_job_ids)
  ),
  note_one AS (
    SELECT
      r.job_id,
      c.note_count_val AS note_count,
      r.created_at AS last_note_at,
      r.body_prev AS last_note_body,
      r.author_nm AS last_note_author_name
    FROM ranked r
    JOIN counts c ON c.job_id = r.job_id
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
        WITH
        has_new_completion_key AS (
          SELECT EXISTS(
            SELECT 1
            FROM jsonb_each_text(COALESCE(r.field_values, '{}'::jsonb)) AS e(key, val)
            WHERE e.key = 'How complete is the job?'
          ) AS v
        ),
        pairs AS (
          SELECT
            t.key,
            btrim(t.val) AS bval
          FROM jsonb_each_text(COALESCE(r.field_values, '{}'::jsonb)) AS t(key, val)
          WHERE t.val IS NOT NULL
            AND btrim(t.val) <> ''
        )
        SELECT (
          SELECT left(z.d, 200)
          FROM (
            SELECT
              CASE
                WHEN p.key = 'Who was on the job?'
                  AND (SELECT h.v FROM has_new_completion_key h)
                  THEN NULL::text
                WHEN
                  p.key IN ('How complete is the job?', 'Who was on the job?')
                  AND p.bval ~ '^[0-9]{1,3}$'
                  AND (p.bval::int) >= 0
                  AND (p.bval::int) <= 100
                  THEN
                    'I think the job is ' || p.bval::int::text || '% complete'
                ELSE left(p.bval, 200)
              END AS d
            FROM pairs p
          ) z
          WHERE z.d IS NOT NULL
          LIMIT 1
        )
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
$_$;
