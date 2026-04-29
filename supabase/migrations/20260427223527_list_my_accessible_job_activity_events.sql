-- Last job activity events for current user: RLS invoker, team-member guard, union of four sources.

CREATE OR REPLACE FUNCTION public.list_my_accessible_job_activity_events(
  p_job_id uuid,
  p_limit int DEFAULT 10
)
RETURNS TABLE (
  activity_at timestamptz,
  kind text,
  summary text
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT e.activity_at,
         e.kind,
         e.summary
  FROM (
    SELECT
      n.created_at AS activity_at,
      'thread_note'::text AS kind,
      left(
        coalesce(
          nullif(
            btrim(
              regexp_replace(
                regexp_replace(coalesce(n.body, ''), chr(13), ' ', 'g'),
                chr(10),
                ' ',
                'g'
              )
            ),
            ''
          ),
          'Thread note'
        ),
        500
      ) AS summary
    FROM public.jobs_ledger_thread_notes n
    WHERE n.job_id = p_job_id
    UNION ALL
    SELECT
      r.created_at AS activity_at,
      'field_report'::text AS kind,
      left(coalesce(rt.name, 'Field report'), 500) AS summary
    FROM public.reports r
    JOIN public.report_templates rt ON r.template_id = rt.id
    WHERE r.job_ledger_id = p_job_id
    UNION ALL
    SELECT
      coalesce(cs.clocked_out_at, cs.clocked_in_at) AS activity_at,
      'clock'::text AS kind,
      left(
        'Work session'
        || coalesce(' · ' || u.name, '')
        || CASE
          WHEN cs.clocked_out_at IS NOT NULL THEN
            ' · '
            || (greatest(
              1,
              (extract(epoch FROM (cs.clocked_out_at - cs.clocked_in_at)) / 60.0)
            ))::int::text
            || ' min'
          ELSE
            ' · in progress'
        END,
        500
      ) AS summary
    FROM public.clock_sessions cs
    LEFT JOIN public.users u ON u.id = cs.user_id
    WHERE cs.job_ledger_id = p_job_id
      AND cs.approved_at IS NOT NULL
      AND cs.rejected_at IS NULL
      AND cs.revoked_at IS NULL
    UNION ALL
    SELECT
      greatest(jb.created_at, jb.updated_at) AS activity_at,
      'schedule'::text AS kind,
      left(
        coalesce(
          nullif(btrim(jb.note), ''),
          to_char(jb.work_date, 'Mon DD, YYYY')
          || ' — '
          || to_char(jb.time_start, 'HH24:MI')
          || '–'
          || to_char(jb.time_end, 'HH24:MI')
        ),
        500
      ) AS summary
    FROM public.job_schedule_blocks jb
    WHERE jb.job_id = p_job_id
  ) e
  WHERE EXISTS (
    SELECT 1
    FROM public.jobs_ledger_team_members jtm
    WHERE jtm.job_id = p_job_id
      AND jtm.user_id = auth.uid()
  )
  ORDER BY e.activity_at DESC
  LIMIT least(greatest(coalesce(p_limit, 10), 1), 50);
$$;

COMMENT ON FUNCTION public.list_my_accessible_job_activity_events(uuid, int) IS
  'Reverse-chronological job activity the caller can see (RLS on each source), union of thread notes, field reports, qualifying approved clock sessions, and schedule block touches. Requires jobs_ledger_team_members row for p_job_id.';

GRANT EXECUTE ON FUNCTION public.list_my_accessible_job_activity_events(uuid, int) TO authenticated;
