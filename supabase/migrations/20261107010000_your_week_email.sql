SET lock_timeout = '3s';

-- v2.6607 · Punch list #255 · The Monday email: Your week, mailed to each person with a signal (your-week-email).
--
--   * week_card_data(p_user_id): the read my_week() makes, for a given person, so the Monday function can build each
--     person's card as the service role. SECURITY DEFINER, EXECUTE revoked from everyone but the service role (the
--     function's own client). It answers what my_week() answers plus the person's credited customer words of the last
--     56 days (the strip's read) and their address. my_week() becomes the wrapper over it for auth.uid(), minus nothing:
--     a person reads their own words and address.
--   * The switch, app_settings your_week_email_on_v1, ships 'false'. A dev turns it on or off from Settings → What the
--     team sees (its own UPDATE policy, dev only, the shape of bridge_weekly_sheet_on_v1's).
--   * The last run, your_week_email_last_run_v1, is written by the function as the service role and read by the page.
--   * A cron row, your-week-email, Mondays at 11:00 and 12:00 UTC (6 AM Central in summer and in winter; the function
--     runs only the tick that is 6 AM): POST /functions/v1/your-week-email with {} and the cron secret, only while the
--     switch is on. Unscheduled first if it exists, so a second push leaves one row.
-- No table, so no fences. Pushed after the function is deployed, so the cron never posts to a function that is not there.

CREATE OR REPLACE FUNCTION public.week_card_data(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := p_user_id;
  v_name text;
  v_role text;
  v_signal text;
  v_email text;
BEGIN
  IF v_uid IS NULL THEN
    RETURN NULL;
  END IF;
  SELECT u.name, u.role, u.week_signal, u.email INTO v_name, v_role, v_signal, v_email FROM public.users u WHERE u.id = v_uid;

  RETURN jsonb_build_object(
    'signal', v_signal,
    'name', coalesce(v_name, ''),
    'role', coalesce(v_role, ''),
    'email', coalesce(v_email, ''),
    'hours', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'session_id', cs.id,
        'work_date', cs.work_date,
        'clocked_in_at', cs.clocked_in_at,
        'clocked_out_at', cs.clocked_out_at,
        'hours', (EXTRACT(EPOCH FROM (cs.clocked_out_at - cs.clocked_in_at)) / 3600.0)::numeric,
        'approved', cs.approved_at IS NOT NULL,
        'job_ledger_id', cs.job_ledger_id,
        'job_number', COALESCE(NULLIF(jl.hcp_number, ''), NULLIF(jl.click_number, ''), ''),
        'job_name', COALESCE(jl.job_name, ''),
        'job_address', COALESCE(jl.job_address, ''),
        'service_type_name', COALESCE(st.name, ''),
        'bid_id', cs.bid_id
      ) ORDER BY cs.work_date, cs.clocked_in_at)
      FROM public.clock_sessions cs
      LEFT JOIN public.jobs_ledger jl ON jl.id = cs.job_ledger_id
      LEFT JOIN public.service_types st ON st.id = jl.service_type_id
      WHERE cs.user_id = v_uid
        AND cs.rejected_at IS NULL
        AND cs.revoked_at IS NULL
        AND cs.clocked_in_at IS NOT NULL
        AND cs.clocked_out_at IS NOT NULL
    ), '[]'::jsonb),
    'licenses', coalesce((
      SELECT jsonb_agg(jsonb_build_object('license_type', pl.license_type, 'date_of_expiry', pl.date_of_expiry) ORDER BY pl.license_type)
      FROM public.person_licenses pl
      WHERE v_name IS NOT NULL AND pl.person_name = v_name
    ), '[]'::jsonb),
    'office_job_id', (SELECT nullif(btrim(s.value_text), '') FROM public.app_settings s WHERE s.key = 'overhead_office_job_ledger_id_v1'),
    'jobs', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'job_id', j.id,
        'job_number', COALESCE(NULLIF(j.hcp_number, ''), NULLIF(j.click_number, ''), ''),
        'job_name', COALESCE(j.job_name, ''),
        'finished_ymd', CASE WHEN j.status IN ('billed', 'paid') THEN COALESCE(j.last_bill_date, j.last_work_date) END,
        'expected_hours', (SELECT e.hours FROM public.job_expected_hours e WHERE e.job_id = j.id AND e.cleared_at IS NULL ORDER BY e.set_at DESC LIMIT 1),
        'budget_hours', (SELECT b.labor_hours FROM public.job_budgets b WHERE b.job_id = j.id),
        'crew_hours', coalesce((
          SELECT sum(EXTRACT(EPOCH FROM (c2.clocked_out_at - c2.clocked_in_at)) / 3600.0)
          FROM public.clock_sessions c2
          WHERE c2.job_ledger_id = j.id AND c2.rejected_at IS NULL AND c2.revoked_at IS NULL AND c2.clocked_out_at IS NOT NULL
        ), 0)::numeric,
        'my_first_ymd', mine.first_ymd
      ) ORDER BY mine.first_ymd)
      FROM (
        SELECT cs.job_ledger_id AS job_id, min(cs.work_date) AS first_ymd
        FROM public.clock_sessions cs
        WHERE cs.user_id = v_uid AND cs.job_ledger_id IS NOT NULL AND cs.rejected_at IS NULL AND cs.revoked_at IS NULL
          AND cs.work_date >= (now() AT TIME ZONE 'America/Chicago')::date - 120
        GROUP BY cs.job_ledger_id
      ) mine
      JOIN public.jobs_ledger j ON j.id = mine.job_id
    ), '[]'::jsonb),
    'callbacks', coalesce((
      SELECT jsonb_agg(jsonb_build_object('first_job_id', k.first_job_id, 'second_job_id', k.second_job_id))
      FROM public.job_callbacks k
      WHERE k.verdict = 'callback'
        AND EXISTS (
          SELECT 1 FROM public.clock_sessions cs
          WHERE cs.user_id = v_uid AND cs.job_ledger_id = k.first_job_id AND cs.rejected_at IS NULL AND cs.revoked_at IS NULL
        )
    ), '[]'::jsonb),
    'words', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'id', r.id,
        'customer_name', coalesce(r.customer_name, ''),
        'score', r.score,
        'words', coalesce(r.words, ''),
        'answered_at', r.answered_at,
        'google_pressed_at', r.google_pressed_at,
        'job_id', r.job_id,
        'job_number', COALESCE(NULLIF(jl.hcp_number, ''), NULLIF(jl.click_number, ''), ''),
        'job_name', COALESCE(jl.job_name, ''),
        'job_address', COALESCE(jl.job_address, ''),
        'seen_at', s.seen_at
      ) ORDER BY r.answered_at DESC)
      FROM public.customer_ratings r
      JOIN public.jobs_ledger jl ON jl.id = r.job_id
      LEFT JOIN public.rating_credit_seen s ON s.rating_id = r.id AND s.user_id = v_uid
      WHERE r.answered_at IS NOT NULL
        AND r.score >= 4
        AND r.answered_at >= now() - interval '56 days'
        AND EXISTS (
          SELECT 1 FROM public.clock_sessions cs
          WHERE cs.job_ledger_id = r.job_id AND cs.user_id = v_uid AND cs.revoked_at IS NULL AND cs.rejected_at IS NULL
        )
    ), '[]'::jsonb)
  );
END;
$$;
COMMENT ON FUNCTION public.week_card_data(uuid) IS
  'Punch list #255 (v2.6607): one person''s Your week read, for the Monday email (your-week-email, as the service role) and my_week(). What my_week() answers, plus the person''s credited customer words of the last 56 days and their address. The service role alone may call it.';
REVOKE ALL ON FUNCTION public.week_card_data(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.my_week()
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT public.week_card_data(auth.uid());
$$;
COMMENT ON FUNCTION public.my_week() IS
  'Punch list #255 (v2.6589; the wrapper since v2.6607): the signed-in person''s Your week read, week_card_data(auth.uid()). Their signal, their closed clock hours (approved and waiting) with job metadata, their licenses, the office job id, the jobs they clocked onto in the last 120 days with the open target, the labor budget, the crew''s hours in aggregate and the finished day, the confirmed callbacks among them, and their credited customer words. Hours only, no wages, nobody else''s hours by name. NULL with no caller.';
REVOKE ALL ON FUNCTION public.my_week() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_week() TO authenticated;

-- ---------- the switch and the last run ----------

INSERT INTO public.app_settings (key, value_text)
VALUES ('your_week_email_on_v1', 'false')
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.app_settings (key, value_text)
VALUES ('your_week_email_last_run_v1', NULL)
ON CONFLICT (key) DO NOTHING;

DROP POLICY IF EXISTS dev_update_your_week_email_on ON public.app_settings;
CREATE POLICY dev_update_your_week_email_on ON public.app_settings
  FOR UPDATE TO authenticated
  USING (key = 'your_week_email_on_v1' AND public.is_dev())
  WITH CHECK (key = 'your_week_email_on_v1' AND public.is_dev());

-- ---------- the cron ----------

SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'your-week-email';

SELECT cron.schedule(
  'your-week-email',
  '0 11,12 * * 1',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'PROJECT_URL') || '/functions/v1/your-week-email',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Cron-Secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'CRON_SECRET')
    ),
    body := '{}'::jsonb
  ) AS request_id
  WHERE EXISTS (SELECT 1 FROM public.app_settings WHERE key = 'your_week_email_on_v1' AND value_text = 'true');
  $$
);
