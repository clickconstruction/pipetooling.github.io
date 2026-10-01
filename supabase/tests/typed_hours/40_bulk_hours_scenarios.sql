-- The bulk hours alert (v2.4281): who sees a burst, what counts as one, and the settings.
-- Rows are written straight into clock_typed_entries (the ledger the triggers fill on prod) so the
-- read is tested on its own. Raises on the first failure.
DO $$
DECLARE
  u_mike   uuid := '20000000-0000-0000-0000-00000000b001';
  u_darren uuid := '20000000-0000-0000-0000-00000000b002';
  u_asst   uuid := '20000000-0000-0000-0000-00000000b003';
  u_ctrl   uuid := '20000000-0000-0000-0000-00000000b004';
  u_dev    uuid := '20000000-0000-0000-0000-00000000b005';
  u_helper uuid := '20000000-0000-0000-0000-00000000b006';
  -- On a bucket edge on purpose: the buckets are fixed 60-minute floors, so a burst that started
  -- at an arbitrary minute could straddle two of them and read as two rows.
  v_t0     timestamptz := date_trunc('hour', now() - interval '2 hours');
  v_row    record;
  v_n      integer;
BEGIN
  INSERT INTO public.users (id, name, role) VALUES
    (u_mike, 'Michael A', 'helper'),
    (u_darren, 'Darren', 'helper'),
    (u_asst, 'Taunya', 'assistant'),
    (u_ctrl, 'Bulk Controller', 'controller'),
    (u_dev, 'Bulk Dev', 'dev'),
    (u_helper, 'Bulk Helper', 'helper')
  ON CONFLICT (id) DO NOTHING;
  DELETE FROM public.app_settings WHERE key LIKE 'bulk_hours_alert_%';
  DELETE FROM public.clock_typed_entries WHERE typed_by IN (u_asst, u_helper);

  -- Taunya types four days for two people inside 25 minutes, one already looked at.
  INSERT INTO public.clock_typed_entries (user_id, work_date, kind, typed_range, typed_seconds, day_seconds_before, day_seconds_after, typed_by, typed_by_name, typed_at, confirmed_by, confirmed_by_name, confirmed_at) VALUES
    (u_mike,   CURRENT_DATE - 9, 'added', tstzmultirange(tstzrange(v_t0, v_t0 + interval '11 hours')), 39600, 0, 39600, u_asst, 'Taunya', v_t0, NULL, NULL, NULL),
    (u_mike,   CURRENT_DATE - 8, 'added', tstzmultirange(tstzrange(v_t0, v_t0 + interval '8 hours')),  28800, 0, 28800, u_asst, 'Taunya', v_t0 + interval '5 minutes', NULL, NULL, NULL),
    (u_mike,   CURRENT_DATE - 8, 'added', tstzmultirange(tstzrange(v_t0, v_t0 + interval '1 hour')),   3600,  28800, 32400, u_asst, 'Taunya', v_t0 + interval '9 minutes', NULL, NULL, NULL),
    (u_darren, CURRENT_DATE - 7, 'added', tstzmultirange(tstzrange(v_t0, v_t0 + interval '8 hours')),  28800, 0, 28800, u_asst, 'Taunya', v_t0 + interval '20 minutes', u_ctrl, 'Bulk Controller', v_t0 + interval '1 hour'),
    (u_darren, CURRENT_DATE - 6, 'added', tstzmultirange(tstzrange(v_t0, v_t0 + interval '8 hours')),  28800, 0, 28800, u_asst, 'Taunya', v_t0 + interval '25 minutes', NULL, NULL, NULL);
  -- A trim by Taunya in the same minutes is not typing hours on.
  INSERT INTO public.clock_typed_entries (user_id, work_date, kind, typed_range, typed_seconds, day_seconds_before, day_seconds_after, typed_by, typed_by_name, typed_at) VALUES
    (u_mike, CURRENT_DATE - 5, 'trimmed', tstzmultirange(tstzrange(v_t0, v_t0 + interval '2 hours')), 7200, 36000, 28800, u_asst, 'Taunya', v_t0 + interval '12 minutes');
  -- The helper's own late entry for one day: below the threshold.
  INSERT INTO public.clock_typed_entries (user_id, work_date, kind, typed_range, typed_seconds, day_seconds_before, day_seconds_after, typed_by, typed_by_name, typed_at) VALUES
    (u_helper, CURRENT_DATE - 1, 'added', tstzmultirange(tstzrange(v_t0, v_t0 + interval '4 hours')), 14400, 0, 14400, u_helper, 'Bulk Helper', v_t0);

  -- B1: the controller sees Taunya's burst as one row with the right counts.
  PERFORM public.t_as(u_ctrl);
  SELECT count(*) INTO v_n FROM public.list_bulk_hours_alerts() WHERE actor_id = u_asst;
  PERFORM public.t_assert(v_n = 1, 'B1 one burst (got ' || v_n || ')');
  SELECT * INTO v_row FROM public.list_bulk_hours_alerts() WHERE actor_id = u_asst;
  PERFORM public.t_assert(v_row.actor_id = u_asst AND v_row.actor_name = 'Taunya', 'B1 the typist is named');
  PERFORM public.t_assert(v_row.days = 4, 'B1 four distinct days, not five entries (got ' || v_row.days || ')');
  PERFORM public.t_assert(v_row.people = 2, 'B1 two people');
  PERFORM public.t_assert(v_row.seconds = 39600 + 28800 + 3600 + 28800 + 28800, 'B1 seconds add up, the trim left out');
  PERFORM public.t_assert(v_row.waiting_days = 3, 'B1 three days still waiting (got ' || v_row.waiting_days || ')');
  PERFORM public.t_assert(v_row.people_names = ARRAY['Darren', 'Michael A'], 'B1 people named in order');
  PERFORM public.t_assert(v_row.first_work_date = CURRENT_DATE - 9 AND v_row.last_work_date = CURRENT_DATE - 6, 'B1 the date span');
  PERFORM public.t_assert(v_row.last_typed_at - v_row.first_typed_at = interval '25 minutes', 'B1 first to last typed');

  -- B2: the dev and an assistant see it too; Taunya never sees her own; a helper sees nothing.
  PERFORM public.t_as(u_dev);
  SELECT count(*) INTO v_n FROM public.list_bulk_hours_alerts() WHERE actor_id = u_asst;
  PERFORM public.t_assert(v_n = 1, 'B2 the dev sees the burst');
  PERFORM public.t_as(u_asst);
  SELECT count(*) INTO v_n FROM public.list_bulk_hours_alerts() WHERE actor_id = u_asst;
  PERFORM public.t_assert(v_n = 0, 'B2 the typist never sees her own burst');
  PERFORM public.t_as(u_helper);
  SELECT count(*) INTO v_n FROM public.list_bulk_hours_alerts();
  PERFORM public.t_assert(v_n = 0, 'B2 a helper sees nothing');
  PERFORM public.t_as(NULL);
  SELECT count(*) INTO v_n FROM public.list_bulk_hours_alerts();
  PERFORM public.t_assert(v_n = 0, 'B2 no signed-in person sees nothing');

  -- B3: the helper's own late entries count once they reach the threshold.
  INSERT INTO public.clock_typed_entries (user_id, work_date, kind, typed_range, typed_seconds, day_seconds_before, day_seconds_after, typed_by, typed_by_name, typed_at) VALUES
    (u_helper, CURRENT_DATE - 2, 'added', tstzmultirange(tstzrange(v_t0, v_t0 + interval '4 hours')), 14400, 0, 14400, u_helper, 'Bulk Helper', v_t0 + interval '3 minutes');
  PERFORM public.t_as(u_ctrl);
  SELECT count(*) INTO v_n FROM public.list_bulk_hours_alerts() WHERE actor_id IN (u_asst, u_helper);
  PERFORM public.t_assert(v_n = 2, 'B3 the helper typing two of his own days is a burst too (got ' || v_n || ')');

  -- B4: the settings are read. Threshold 5 hides both; the switch off hides both; a 1-day lookback hides nothing typed two hours ago.
  INSERT INTO public.app_settings (key, value_num) VALUES ('bulk_hours_alert_days_v1', 5);
  SELECT count(*) INTO v_n FROM public.list_bulk_hours_alerts() WHERE actor_id IN (u_asst, u_helper);
  PERFORM public.t_assert(v_n = 0, 'B4 days threshold 5 hides a four-day burst');
  DELETE FROM public.app_settings WHERE key = 'bulk_hours_alert_days_v1';
  INSERT INTO public.app_settings (key, value_text) VALUES ('bulk_hours_alert_enabled_v1', 'false');
  SELECT count(*) INTO v_n FROM public.list_bulk_hours_alerts();
  PERFORM public.t_assert(v_n = 0, 'B4 the switch off hides everything');
  DELETE FROM public.app_settings WHERE key = 'bulk_hours_alert_enabled_v1';
  INSERT INTO public.app_settings (key, value_num) VALUES ('bulk_hours_alert_lookback_days_v1', 1);
  SELECT count(*) INTO v_n FROM public.list_bulk_hours_alerts() WHERE actor_id IN (u_asst, u_helper);
  PERFORM public.t_assert(v_n = 2, 'B4 a one-day lookback still holds this morning');
  -- A 5-minute window splits Taunya's 25 minutes into buckets of one day each: below the threshold.
  INSERT INTO public.app_settings (key, value_num) VALUES ('bulk_hours_alert_window_minutes_v1', 5);
  SELECT count(*) INTO v_n FROM public.list_bulk_hours_alerts() WHERE actor_id = u_asst AND days >= 2;
  PERFORM public.t_assert(v_n <= 1, 'B4 a narrow window splits the burst (got ' || v_n || ' rows of 2+ days)');
  DELETE FROM public.app_settings WHERE key LIKE 'bulk_hours_alert_%';

  PERFORM public.t_as(NULL);
  DELETE FROM public.clock_typed_entries WHERE typed_by IN (u_asst, u_helper);
  DELETE FROM public.users WHERE id IN (u_mike, u_darren, u_asst, u_ctrl, u_dev, u_helper);
  RAISE NOTICE 'bulk_hours_alerts scenarios PASSED';
END $$;
