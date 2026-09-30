-- The assistant hours window fence (v2.4271): the floor math against the TypeScript kernel's
-- fixtures, then who the fence touches and what it lets through. Raises on the first failure.
DO $$
DECLARE
  u_worker uuid := '10000000-0000-0000-0000-00000000a001';
  u_asst   uuid := '10000000-0000-0000-0000-00000000a002';
  u_ctrl   uuid := '10000000-0000-0000-0000-00000000a003';
  u_dev    uuid := '10000000-0000-0000-0000-00000000a004';
  v_today  date := (now() AT TIME ZONE 'America/Chicago')::date;
  v_floor  date;
  v_in_id  uuid;
  v_old_id uuid;
  v_msg    text;
BEGIN
  INSERT INTO public.users (id, name, role) VALUES
    (u_worker, 'Window Worker', 'helper'),
    (u_asst, 'Window Assistant', 'assistant'),
    (u_ctrl, 'Window Controller', 'controller'),
    (u_dev, 'Window Dev', 'dev')
  ON CONFLICT (id) DO NOTHING;
  DELETE FROM public.app_settings WHERE key = 'assistant_hours_window_weeks_v1';

  -- W1: the pure math matches assistantHoursWindow.test.ts and the September fixtures.
  PERFORM public.t_assert(public.assistant_hours_window_floor_for('2026-08-12', 3) = '2026-07-26', 'W1 weeks=3 mid-week → the Sunday two weeks back');
  PERFORM public.t_assert(public.assistant_hours_window_floor_for('2026-08-12', 1) = '2026-08-09', 'W1 weeks=1 → this Sunday');
  PERFORM public.t_assert(public.assistant_hours_window_floor_for('2026-08-09', 1) = '2026-08-09', 'W1 on a Sunday the week starts that day');
  PERFORM public.t_assert(public.assistant_hours_window_floor_for('2026-08-15', 1) = '2026-08-09', 'W1 Saturday anchors to the preceding Sunday');
  PERFORM public.t_assert(public.assistant_hours_window_floor_for('2026-08-01', 2) = '2026-07-19', 'W1 crosses a month');
  PERFORM public.t_assert(public.assistant_hours_window_floor_for('2026-09-30', 3) = '2026-09-13', 'W1 Wed Sep 30, 3 weeks → Sun Sep 13');
  PERFORM public.t_assert(public.assistant_hours_window_floor_for('2026-08-12', 0) IS NULL, 'W1 weeks=0 → no limit');
  PERFORM public.t_assert(public.assistant_hours_window_floor_for('2026-08-12', -5) IS NULL, 'W1 negative → no limit');

  -- W2: who is limited. Missing setting = 3 weeks.
  PERFORM public.t_as(NULL);
  PERFORM public.t_assert(public.assistant_hours_window_floor() IS NULL, 'W2 no signed-in person → no floor');
  PERFORM public.t_as(u_worker);
  PERFORM public.t_assert(public.assistant_hours_window_floor() IS NULL, 'W2 a worker has no floor');
  PERFORM public.t_as(u_ctrl);
  PERFORM public.t_assert(public.assistant_hours_window_floor() IS NULL, 'W2 a controller has no floor');
  PERFORM public.t_as(u_dev);
  PERFORM public.t_assert(public.assistant_hours_window_floor() IS NULL, 'W2 a dev has no floor');
  PERFORM public.t_as(u_asst);
  v_floor := public.assistant_hours_window_floor();
  PERFORM public.t_assert(v_floor = public.assistant_hours_window_floor_for(v_today, 3), 'W2 an assistant with no setting row is on 3 weeks');

  -- W3: a worker's own punch far back is not the assistant's business.
  PERFORM public.t_as(u_worker);
  INSERT INTO public.clock_sessions (user_id, work_date, clocked_in_at, clocked_out_at, notes)
  VALUES (u_worker, v_today - 60, (v_today - 60)::timestamp AT TIME ZONE 'America/Chicago' + interval '8 hours',
          (v_today - 60)::timestamp AT TIME ZONE 'America/Chicago' + interval '16 hours', 'old punch')
  RETURNING id INTO v_old_id;
  PERFORM public.t_assert(v_old_id IS NOT NULL, 'W3 a worker inserts his own old punch');

  -- W4: the assistant may add on the floor day, not the day before.
  PERFORM public.t_as(u_asst);
  INSERT INTO public.clock_sessions (user_id, work_date, clocked_in_at, clocked_out_at, notes)
  VALUES (u_worker, v_floor, v_floor::timestamp AT TIME ZONE 'America/Chicago' + interval '10 hours',
          v_floor::timestamp AT TIME ZONE 'America/Chicago' + interval '21 hours', 'typed on the floor day')
  RETURNING id INTO v_in_id;
  PERFORM public.t_assert(v_in_id IS NOT NULL, 'W4 the floor day itself is inside the window');
  BEGIN
    INSERT INTO public.clock_sessions (user_id, work_date, clocked_in_at, clocked_out_at, notes)
    VALUES (u_worker, v_floor - 1, (v_floor - 1)::timestamp AT TIME ZONE 'America/Chicago' + interval '10 hours',
            (v_floor - 1)::timestamp AT TIME ZONE 'America/Chicago' + interval '21 hours', 'typed before the floor');
    PERFORM public.t_assert(false, 'W4 the day before the floor must be refused');
  EXCEPTION WHEN SQLSTATE 'P0001' THEN
    GET STACKED DIAGNOSTICS v_msg = MESSAGE_TEXT;
    PERFORM public.t_assert(v_msg LIKE to_char(v_floor, 'Dy Mon FMDD') || ' is the earliest day%', 'W4 the refusal names the floor day: ' || v_msg);
  END;
  -- A work_date inside the window with a clocked_in_at before it is the same trick.
  BEGIN
    INSERT INTO public.clock_sessions (user_id, work_date, clocked_in_at, clocked_out_at, notes)
    VALUES (u_worker, v_floor, (v_floor - 3)::timestamp AT TIME ZONE 'America/Chicago' + interval '10 hours',
            (v_floor - 3)::timestamp AT TIME ZONE 'America/Chicago' + interval '21 hours', 'work_date inside, clock-in before');
    PERFORM public.t_assert(false, 'W4 a clock-in before the floor must be refused whatever work_date says');
  EXCEPTION WHEN SQLSTATE 'P0001' THEN
    NULL;
  END;

  -- W5: the assistant cannot drag a session out of the window, nor touch the times of one before it.
  BEGIN
    UPDATE public.clock_sessions
       SET clocked_in_at = (v_floor - 1)::timestamp AT TIME ZONE 'America/Chicago' + interval '10 hours', work_date = v_floor - 1
     WHERE id = v_in_id;
    PERFORM public.t_assert(false, 'W5 moving a session before the floor must be refused');
  EXCEPTION WHEN SQLSTATE 'P0001' THEN
    NULL;
  END;
  BEGIN
    UPDATE public.clock_sessions
       SET clocked_out_at = clocked_out_at + interval '1 hour'
     WHERE id = v_old_id;
    PERFORM public.t_assert(false, 'W5 changing the times of a session before the floor must be refused');
  EXCEPTION WHEN SQLSTATE 'P0001' THEN
    NULL;
  END;

  -- W6: what is not a time change still goes through on the old session — notes, a job link, approval.
  UPDATE public.clock_sessions SET notes = 'notes edited by the assistant' WHERE id = v_old_id;
  PERFORM public.t_assert((SELECT notes FROM public.clock_sessions WHERE id = v_old_id) = 'notes edited by the assistant', 'W6 notes on an old session are not fenced');
  UPDATE public.clock_sessions SET approved_at = now(), approved_by = u_asst WHERE id = v_old_id;
  PERFORM public.t_assert((SELECT approved_at FROM public.clock_sessions WHERE id = v_old_id) IS NOT NULL, 'W6 approving an old session is not fenced');

  -- W7: the setting is read. 0 lifts the limit; 1 is this week only.
  INSERT INTO public.app_settings (key, value_num) VALUES ('assistant_hours_window_weeks_v1', 0);
  PERFORM public.t_assert(public.assistant_hours_window_floor() IS NULL, 'W7 weeks=0 → no floor');
  INSERT INTO public.clock_sessions (user_id, work_date, clocked_in_at, clocked_out_at, notes)
  VALUES (u_worker, v_today - 90, (v_today - 90)::timestamp AT TIME ZONE 'America/Chicago' + interval '8 hours',
          (v_today - 90)::timestamp AT TIME ZONE 'America/Chicago' + interval '12 hours', 'unlimited');
  UPDATE public.app_settings SET value_num = 1 WHERE key = 'assistant_hours_window_weeks_v1';
  PERFORM public.t_assert(public.assistant_hours_window_floor() = v_today - EXTRACT(DOW FROM v_today)::integer, 'W7 weeks=1 → this Sunday');
  UPDATE public.app_settings SET value_num = 2.9 WHERE key = 'assistant_hours_window_weeks_v1';
  PERFORM public.t_assert(public.assistant_hours_window_floor() = public.assistant_hours_window_floor_for(v_today, 2), 'W7 fractional weeks floor');
  UPDATE public.app_settings SET value_num = -4 WHERE key = 'assistant_hours_window_weeks_v1';
  PERFORM public.t_assert(public.assistant_hours_window_floor() = public.assistant_hours_window_floor_for(v_today, 3), 'W7 a negative setting falls back to 3');
  DELETE FROM public.app_settings WHERE key = 'assistant_hours_window_weeks_v1';

  -- W8: a controller and a dev type anywhere.
  PERFORM public.t_as(u_ctrl);
  INSERT INTO public.clock_sessions (user_id, work_date, clocked_in_at, clocked_out_at, notes)
  VALUES (u_worker, v_today - 120, (v_today - 120)::timestamp AT TIME ZONE 'America/Chicago' + interval '8 hours',
          (v_today - 120)::timestamp AT TIME ZONE 'America/Chicago' + interval '12 hours', 'controller, far back');
  PERFORM public.t_as(u_dev);
  UPDATE public.clock_sessions SET clocked_out_at = clocked_out_at + interval '1 hour' WHERE id = v_old_id;
  PERFORM public.t_assert(true, 'W8 controller and dev are not fenced');

  PERFORM public.t_as(NULL);
  DELETE FROM public.clock_sessions WHERE user_id = u_worker;
  DELETE FROM public.users WHERE id IN (u_worker, u_asst, u_ctrl, u_dev);
  RAISE NOTICE 'assistant_hours_window_fence scenarios PASSED';
END $$;
