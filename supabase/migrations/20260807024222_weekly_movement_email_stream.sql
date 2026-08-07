SET lock_timeout = '3s';

-- weekly_movement Report Subscriptions stream (v2.1437) — payload RPC,
-- requests table, and cron registration (docs/REPORT_SUBSCRIPTIONS.md
-- checklist steps 1–3). Mirrors the gc_statement stream's shapes; recipients
-- are INTERNAL users only (recipient_user_id — the report names who moved
-- what, office-capable eyes only, like the billed report).

-- ── Payload RPC ──────────────────────────────────────────────────────────────
-- Kernel-faithful to src/lib/jobs/stagesWeeklyMovement.ts buildWeeklyMovement:
--   * window = [Monday 00:00 Central, +7 days); p_week_monday NULL = the
--     PREVIOUS COMPLETE week (a Monday-morning subscription reports last week);
--   * forward moves bucket by destination in pipeline order; backward moves
--     (from-index > to-index) are send_backs with from/to labels;
--   * section totals sum DISTINCT jobs' revenue; movers resolve to users.name,
--     NULL auth = 'Automatic'; weekday labels are Central.

CREATE OR REPLACE FUNCTION public.get_weekly_movement_email_payload(
  p_week_monday date DEFAULT NULL
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
WITH pipeline AS (
  SELECT ARRAY['waiting','working','ready_to_bill','billed','paid']::text[] AS stages,
         ARRAY['Waiting','Working','Ready to Bill','Billed','Paid in Full']::text[] AS labels
),
week AS (
  SELECT COALESCE(
    p_week_monday,
    -- Monday of the PREVIOUS complete Central week.
    ((now() AT TIME ZONE 'America/Chicago')::date
      - ((EXTRACT(ISODOW FROM (now() AT TIME ZONE 'America/Chicago')::date)::int - 1)) - 7)
  ) AS monday
),
bounds AS (
  SELECT monday,
         (monday::timestamp AT TIME ZONE 'America/Chicago') AS start_at,
         ((monday + 7)::timestamp AT TIME ZONE 'America/Chicago') AS end_at
  FROM week
),
ev AS (
  SELECT e.id, e.job_id, e.from_status, e.to_status, e.changed_at,
         to_char(e.changed_at AT TIME ZONE 'America/Chicago', 'Dy') AS weekday,
         COALESCE(NULLIF(trim(u.name), ''), CASE WHEN e.changed_by_user_id IS NULL THEN 'Automatic' ELSE '—' END) AS mover_name,
         COALESCE(NULLIF(trim(j.hcp_number), ''), j.click_number) AS display_number,
         COALESCE(j.job_name, '') AS job_name,
         COALESCE(j.job_address, '') AS job_address,
         COALESCE(j.revenue, 0) AS revenue,
         array_position((SELECT stages FROM pipeline), e.from_status) AS from_idx,
         array_position((SELECT stages FROM pipeline), e.to_status) AS to_idx
  FROM public.job_status_events e
  JOIN bounds b ON e.changed_at >= b.start_at AND e.changed_at < b.end_at
  LEFT JOIN public.jobs_ledger j ON j.id = e.job_id
  LEFT JOIN public.users u ON u.id = e.changed_by_user_id
  WHERE array_position((SELECT stages FROM pipeline), e.to_status) IS NOT NULL
),
entry AS (
  SELECT ev.*,
         jsonb_build_object(
           'event_id', ev.id,
           'job_id', ev.job_id,
           'display', CASE WHEN ev.job_name <> '' THEN COALESCE(ev.display_number, '—') || ' · ' || ev.job_name
                           ELSE COALESCE(ev.display_number, '—') END,
           'address', ev.job_address,
           'weekday', ev.weekday,
           'mover_name', ev.mover_name,
           'revenue', round(ev.revenue::numeric, 2)
         ) AS entry_json,
         (COALESCE(ev.from_idx, 0) > ev.to_idx) AS is_send_back
  FROM ev
),
section AS (
  SELECT e.to_status,
         (SELECT labels[array_position(stages, e.to_status)] FROM pipeline) AS label,
         e.to_idx,
         jsonb_agg(e.entry_json ORDER BY e.changed_at) AS entries,
         COUNT(DISTINCT e.job_id) AS job_count,
         (SELECT round(SUM(r)::numeric, 2) FROM (
            SELECT DISTINCT ON (x.job_id) x.revenue AS r FROM ev x
            WHERE x.to_status = e.to_status AND NOT (COALESCE(x.from_idx, 0) > x.to_idx)
          ) d) AS total
  FROM entry e
  WHERE NOT e.is_send_back
  GROUP BY e.to_status, e.to_idx
)
SELECT jsonb_build_object(
  'generated_at', now(),
  'week_monday', (SELECT monday FROM week),
  'sections', COALESCE((SELECT jsonb_agg(jsonb_build_object(
      'to_status', s.to_status,
      'label', s.label,
      'entries', s.entries,
      'job_count', s.job_count,
      'total', COALESCE(s.total, 0)
    ) ORDER BY s.to_idx) FROM section s), '[]'::jsonb),
  'send_backs', COALESCE((SELECT jsonb_agg(
      e.entry_json || jsonb_build_object(
        'from_label', COALESCE((SELECT labels[array_position(stages, e.from_status)] FROM pipeline), COALESCE(e.from_status, '—')),
        'to_label', (SELECT labels[array_position(stages, e.to_status)] FROM pipeline)
      ) ORDER BY e.changed_at) FROM entry e WHERE e.is_send_back), '[]'::jsonb),
  'move_count', (SELECT COUNT(*) FROM entry),
  'job_count', (SELECT COUNT(DISTINCT job_id) FROM entry)
);
$function$;

COMMENT ON FUNCTION public.get_weekly_movement_email_payload(date) IS
  'Weekly movement report rebuilt server-side for the weekly_movement Report Subscriptions stream (v2.1437). Service-role only; kernel-faithful to stagesWeeklyMovement.ts. p_week_monday NULL = previous complete Central week.';

REVOKE EXECUTE ON FUNCTION public.get_weekly_movement_email_payload(date) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_weekly_movement_email_payload(date) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_weekly_movement_email_payload(date) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.get_weekly_movement_email_payload(date) TO service_role;

-- ── Requests table (internal recipients, like billed_report_email_requests) ──

CREATE TABLE IF NOT EXISTS public.weekly_movement_email_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requested_by uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  recipient_user_id uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  send_at timestamptz NOT NULL,
  repeat_weekly boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  error text,
  attempts int NOT NULL DEFAULT 0
);

COMMENT ON TABLE public.weekly_movement_email_requests IS
  'Requested sends of the Weekly movement report email (v2.1437, weekly_movement Report Subscriptions stream). Staff insert; the weekly-movement-email-dispatch edge function (pg_cron */5) processes due rows — the report covers the PREVIOUS complete Central week, rebuilt at send time. Internal recipients only (the report names who moved what).';

CREATE INDEX IF NOT EXISTS idx_weekly_movement_email_requests_due
  ON public.weekly_movement_email_requests (send_at)
  WHERE sent_at IS NULL;

ALTER TABLE public.weekly_movement_email_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff insert own weekly movement email requests" ON public.weekly_movement_email_requests;
CREATE POLICY "Staff insert own weekly movement email requests" ON public.weekly_movement_email_requests
  FOR INSERT WITH CHECK (
    requested_by = (SELECT auth.uid())
    AND (
      public.is_dev()
      OR public.is_assistant()
      OR EXISTS (
        SELECT 1 FROM public.users u
        WHERE u.id = (SELECT auth.uid()) AND u.role = 'master_technician'
      )
    )
  );

DROP POLICY IF EXISTS "Creators and devs read weekly movement email requests" ON public.weekly_movement_email_requests;
CREATE POLICY "Creators and devs read weekly movement email requests" ON public.weekly_movement_email_requests
  FOR SELECT USING (requested_by = (SELECT auth.uid()) OR public.is_dev());

DROP POLICY IF EXISTS "Creators cancel own unsent weekly movement email requests" ON public.weekly_movement_email_requests;
CREATE POLICY "Creators cancel own unsent weekly movement email requests" ON public.weekly_movement_email_requests
  FOR DELETE USING (
    (requested_by = (SELECT auth.uid()) AND sent_at IS NULL) OR public.is_dev()
  );

-- No client UPDATE policy — only the service-role edge function stamps rows.

-- ── pg_cron: dispatch every 5 minutes ────────────────────────────────────────

SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'weekly-movement-email-dispatch';

SELECT cron.schedule(
  'weekly-movement-email-dispatch',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'PROJECT_URL') || '/functions/v1/weekly-movement-email-dispatch',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Cron-Secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'CRON_SECRET')
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);

-- Training-mode write blocks (required for every CREATE TABLE — see CLAUDE.md).
SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
