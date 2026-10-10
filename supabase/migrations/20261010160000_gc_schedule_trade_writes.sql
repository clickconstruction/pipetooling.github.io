SET lock_timeout = '3s';

-- GC mode, the schedule's PR 14a (v2.5196): a trade's four writes from its portal (to-dos/gc-mode/mockups/schedule-pr14.md
-- on branch spike/gc-mode), on PR 3's tables: a late notice and the day kept after the office's push back
-- (gc_schedule_late_notices), a crew count (gc_schedule_crew_counts) and a look-ahead mark (gc_schedule_lookahead_marks).
-- The Portal's P5d-ii adds their kinds to submit-gc-trade-portal, which calls each with the link's company first. Each
-- checks what the prototype's reducer and the portal's screen check, raises the portal's keys with their words as
-- DETAIL, and runs only as the service role. All are records: none touches the plan or its version, and each day is the
-- company's (app_today()). No table is created.

-- A late notice from the company (tradeSayLate, G-117): its own trade's line, awarded to it, on a job being built, not
-- finished. Under way and done read as lateDoor reads them: an actual start or finish, or the line's percent as the
-- kernels read it (lineOf): an open send-back's percent where we doubted the line, else the newest report on it (a
-- trade's report or a pay application's claim). Under way, it asks a new finish; not started, a new start, the bar
-- moving whole and keeping its length. The day is after the one it changes and not before today, with a reason and a
-- sentence. A second notice on the same bar replaces the first (lateNoticeState). Returns the notice's id.
CREATE OR REPLACE FUNCTION public.gc_trade_say_late(p_company_id uuid, p_activity_id uuid, p_day date, p_reason text, p_note text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_bar public.gc_schedule_activities%ROWTYPE;
  v_ours boolean;
  v_stage text;
  v_company uuid;
  v_sow uuid;
  v_line uuid;
  v_back uuid;
  v_pct numeric;
  v_started boolean;
  v_day date;
  v_note text := btrim(coalesce(p_note, ''));
  v_by text;
  v_id uuid;
BEGIN
  SELECT * INTO v_bar FROM public.gc_schedule_activities WHERE id = p_activity_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'notFound' USING ERRCODE = 'P0001', DETAIL = 'No bar with that id.';
  END IF;
  SELECT k.ours, g.stage, i.company_id INTO v_ours, v_stage, v_company
  FROM public.gc_trade_packages k
  JOIN public.gc_projects g ON g.project_id = k.project_id
  LEFT JOIN public.gc_invites i ON i.id = k.awarded_invite_id
  WHERE k.id = v_bar.package_id;
  IF v_bar.kind <> 'line' OR v_ours IS DISTINCT FROM false OR v_company IS DISTINCT FROM p_company_id THEN
    RAISE EXCEPTION 'notOnTrade' USING ERRCODE = 'P0001', DETAIL = 'Only the company we awarded this trade can say its work will be late.';
  END IF;
  IF v_stage <> 'building' THEN
    RAISE EXCEPTION 'jobNotBuilding' USING ERRCODE = 'P0001', DETAIL = 'A late notice opens once we are building the job.';
  END IF;
  -- The line's percent: its statement of work's line, the draw sent back and not yet sent again (sentBackOpen), and
  -- that draw's we_see on the line, else the newest report on the line, else none yet.
  SELECT s.id, l.id INTO v_sow, v_line
  FROM public.gc_sows s JOIN public.gc_sow_lines l ON l.sow_id = s.id
  WHERE s.package_id = v_bar.package_id AND l.scope_item_id = v_bar.scope_item_id;
  SELECT d.id INTO v_back FROM public.gc_draws d
  WHERE d.sow_id = v_sow AND d.status = 'sent_back'
    AND d.number = (SELECT count(*) + 1 FROM public.gc_draws x WHERE x.sow_id = v_sow AND x.status <> 'sent_back')
  ORDER BY d.seq DESC LIMIT 1;
  v_pct := coalesce(
    (SELECT dl.we_see FROM public.gc_draw_lines dl WHERE dl.draw_id = v_back AND dl.sow_line_id = v_line),
    (SELECT r.pct FROM public.gc_sow_line_reports r WHERE r.sow_line_id = v_line ORDER BY r.seq DESC LIMIT 1),
    0
  );
  IF v_bar.actual_finish IS NOT NULL OR v_pct >= 100 THEN
    RAISE EXCEPTION 'workDone' USING ERRCODE = 'P0001', DETAIL = 'That work is done.';
  END IF;
  v_started := v_bar.actual_start IS NOT NULL OR v_pct > 0;
  v_day := CASE WHEN v_started THEN v_bar.finish ELSE v_bar.start END;
  IF p_day IS NULL THEN
    RAISE EXCEPTION 'badRequest' USING ERRCODE = 'P0001', DETAIL = 'Pick the day.';
  END IF;
  IF p_day <= v_day THEN
    RAISE EXCEPTION 'lateLaterDay' USING ERRCODE = 'P0001', DETAIL = format('Pick a day after %s.', to_char(v_day, 'FMMon FMDD'));
  END IF;
  IF p_day < public.app_today() THEN
    RAISE EXCEPTION 'dayPassed' USING ERRCODE = 'P0001', DETAIL = 'Pick today or a later day.';
  END IF;
  IF p_reason IS NULL OR p_reason NOT IN ('weather', 'trade before', 'materials', 'crew', 'other') THEN
    RAISE EXCEPTION 'pickWhy' USING ERRCODE = 'P0001', DETAIL = 'Pick why.';
  END IF;
  IF char_length(v_note) < 8 THEN
    RAISE EXCEPTION 'noteNeeded' USING ERRCODE = 'P0001', DETAIL = 'Say what happened, in a sentence.';
  END IF;
  IF char_length(v_note) > 2000 THEN
    RAISE EXCEPTION 'tooLong' USING ERRCODE = 'P0001', DETAIL = 'Keep the note under 2,000 characters.';
  END IF;
  SELECT coalesce(nullif(btrim(contact_name), ''), name) INTO v_by FROM public.gc_companies WHERE id = p_company_id;
  INSERT INTO public.gc_schedule_late_notices
    (project_id, company_id, activity_id, sent_on, sent_by, started, was_start, was_finish, to_start, to_finish, reason, note)
  VALUES (
    v_bar.project_id, p_company_id, v_bar.id, public.app_today(), coalesce(v_by, 'The company'), v_started,
    v_bar.start, v_bar.finish,
    CASE WHEN v_started THEN v_bar.start ELSE p_day END,
    CASE WHEN v_started THEN p_day ELSE p_day + (v_bar.finish - v_bar.start) END,
    p_reason, v_note
  )
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

-- The company keeps its day after the office pushed its notice back (tradeKeepDay): its own notice, pushed back and not
-- kept, and still standing: not taken by a move, not replaced by a newer notice on the bar, and the bar where the notice
-- found it (lateNoticeState). The office's push back sets its three columns through its own column grant.
CREATE OR REPLACE FUNCTION public.gc_trade_keep_day(p_company_id uuid, p_notice_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v public.gc_schedule_late_notices%ROWTYPE;
BEGIN
  SELECT * INTO v FROM public.gc_schedule_late_notices WHERE id = p_notice_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'notFound' USING ERRCODE = 'P0001', DETAIL = 'No notice with that id.';
  END IF;
  IF v.company_id IS DISTINCT FROM p_company_id THEN
    RAISE EXCEPTION 'notYours' USING ERRCODE = 'P0001', DETAIL = 'That notice is another company''s.';
  END IF;
  IF v.kept_on IS NOT NULL THEN
    RAISE EXCEPTION 'alreadyAnswered' USING ERRCODE = 'P0001', DETAIL = 'You said you will make the day already.';
  END IF;
  IF v.pushed_back_on IS NULL THEN
    RAISE EXCEPTION 'notPushedBack' USING ERRCODE = 'P0001', DETAIL = 'The office has not answered that notice yet.';
  END IF;
  IF EXISTS (SELECT 1 FROM public.gc_schedule_moves WHERE late_notice_id = v.id AND undone_on IS NULL)
     OR EXISTS (
       SELECT 1 FROM public.gc_schedule_late_notices n
       WHERE n.company_id = v.company_id AND n.activity_id = v.activity_id AND n.created_at > v.created_at
     )
     OR NOT EXISTS (
       SELECT 1 FROM public.gc_schedule_activities a WHERE a.id = v.activity_id AND a.start = v.was_start AND a.finish = v.was_finish
     ) THEN
    RAISE EXCEPTION 'noticeClosed' USING ERRCODE = 'P0001', DETAIL = 'That notice is closed. The schedule moved since.';
  END IF;
  UPDATE public.gc_schedule_late_notices SET kept_on = public.app_today() WHERE id = v.id;
END;
$$;

-- A crew count from the company (tradeSetCrewCount, G-142): how many people its own trade sends a day in one of the
-- look-ahead's weeks (this Monday and the next two, crewWeeks), a whole number from 0 to 50 (CREW_MAX). On a job being
-- built that has a schedule. The same as the count that stands keeps nothing new; the newest for a trade and week counts.
CREATE OR REPLACE FUNCTION public.gc_trade_set_crew_count(p_company_id uuid, p_package_id uuid, p_week_of date, p_count integer)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_project uuid;
  v_ours boolean;
  v_stage text;
  v_company uuid;
  v_monday date := public.app_today() - (extract(isodow FROM public.app_today())::integer - 1);
BEGIN
  SELECT k.project_id, k.ours, g.stage, i.company_id INTO v_project, v_ours, v_stage, v_company
  FROM public.gc_trade_packages k
  JOIN public.gc_projects g ON g.project_id = k.project_id
  LEFT JOIN public.gc_invites i ON i.id = k.awarded_invite_id
  WHERE k.id = p_package_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'notFound' USING ERRCODE = 'P0001', DETAIL = 'No trade with that id.';
  END IF;
  IF v_ours IS DISTINCT FROM false OR v_company IS DISTINCT FROM p_company_id THEN
    RAISE EXCEPTION 'notOnTrade' USING ERRCODE = 'P0001', DETAIL = 'Only the company we awarded this trade can give its crew.';
  END IF;
  IF v_stage <> 'building' THEN
    RAISE EXCEPTION 'jobNotBuilding' USING ERRCODE = 'P0001', DETAIL = 'Crew counts open once we are building the job.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.gc_schedules WHERE project_id = v_project) THEN
    RAISE EXCEPTION 'notFound' USING ERRCODE = 'P0001', DETAIL = 'This job has no schedule yet.';
  END IF;
  IF p_week_of IS NULL OR extract(isodow FROM p_week_of) <> 1 THEN
    RAISE EXCEPTION 'badRequest' USING ERRCODE = 'P0001', DETAIL = 'A week starts on a Monday.';
  END IF;
  IF p_week_of NOT IN (v_monday, v_monday + 7, v_monday + 14) THEN
    RAISE EXCEPTION 'weekClosed' USING ERRCODE = 'P0001', DETAIL = 'Give a count for this week or the next two.';
  END IF;
  IF p_count IS NULL OR p_count < 0 OR p_count > 50 THEN
    RAISE EXCEPTION 'crewWhole' USING ERRCODE = 'P0001', DETAIL = 'A whole number, 0 to 50.';
  END IF;
  -- The same as the count that stands: nothing new to keep.
  IF (
    SELECT c.count FROM public.gc_schedule_crew_counts c
    WHERE c.package_id = p_package_id AND c.week_of = p_week_of
    ORDER BY c.said_on DESC, c.created_at DESC LIMIT 1
  ) IS NOT DISTINCT FROM p_count THEN
    RETURN;
  END IF;
  INSERT INTO public.gc_schedule_crew_counts (project_id, package_id, company_id, week_of, count, said_on)
  VALUES (v_project, p_package_id, p_company_id, p_week_of, p_count, public.app_today());
END;
$$;

-- A look-ahead mark from the company (tradeMarkLookAhead, G-114): its own trade's line, awarded to it, on a job being
-- built, for this week or last week (the portal's canMark), a Monday the bar runs in. Done, or not done with one of the
-- reasons. It changes until our superintendent checks it; then it stays. One mark per bar and week.
CREATE OR REPLACE FUNCTION public.gc_trade_mark_lookahead(p_company_id uuid, p_activity_id uuid, p_week_of date, p_done boolean, p_reason text)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_bar public.gc_schedule_activities%ROWTYPE;
  v_ours boolean;
  v_stage text;
  v_company uuid;
  v_monday date := public.app_today() - (extract(isodow FROM public.app_today())::integer - 1);
BEGIN
  SELECT * INTO v_bar FROM public.gc_schedule_activities WHERE id = p_activity_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'notFound' USING ERRCODE = 'P0001', DETAIL = 'No bar with that id.';
  END IF;
  SELECT k.ours, g.stage, i.company_id INTO v_ours, v_stage, v_company
  FROM public.gc_trade_packages k
  JOIN public.gc_projects g ON g.project_id = k.project_id
  LEFT JOIN public.gc_invites i ON i.id = k.awarded_invite_id
  WHERE k.id = v_bar.package_id;
  IF v_bar.kind <> 'line' OR v_ours IS DISTINCT FROM false OR v_company IS DISTINCT FROM p_company_id THEN
    RAISE EXCEPTION 'notOnTrade' USING ERRCODE = 'P0001', DETAIL = 'Only the company we awarded this trade can mark its work.';
  END IF;
  IF v_stage <> 'building' THEN
    RAISE EXCEPTION 'jobNotBuilding' USING ERRCODE = 'P0001', DETAIL = 'The look-ahead opens once we are building the job.';
  END IF;
  IF p_week_of IS NULL OR extract(isodow FROM p_week_of) <> 1 THEN
    RAISE EXCEPTION 'badRequest' USING ERRCODE = 'P0001', DETAIL = 'A week starts on a Monday.';
  END IF;
  IF p_week_of NOT IN (v_monday, v_monday - 7) THEN
    RAISE EXCEPTION 'weekClosed' USING ERRCODE = 'P0001', DETAIL = 'Mark this week or last week.';
  END IF;
  IF v_bar.start > p_week_of + 6 OR v_bar.finish < p_week_of THEN
    RAISE EXCEPTION 'badRequest' USING ERRCODE = 'P0001', DETAIL = 'That work does not run that week.';
  END IF;
  IF p_done IS NULL OR (p_done AND p_reason IS NOT NULL) THEN
    RAISE EXCEPTION 'badRequest' USING ERRCODE = 'P0001', DETAIL = 'Say done, or not done and why.';
  END IF;
  IF NOT p_done AND (p_reason IS NULL OR p_reason NOT IN ('weather', 'trade before', 'materials', 'crew', 'other')) THEN
    RAISE EXCEPTION 'pickWhy' USING ERRCODE = 'P0001', DETAIL = 'Pick why.';
  END IF;
  IF EXISTS (SELECT 1 FROM public.gc_schedule_lookahead_marks WHERE activity_id = p_activity_id AND week_of = p_week_of AND verified_on IS NOT NULL) THEN
    RAISE EXCEPTION 'alreadyChecked' USING ERRCODE = 'P0001', DETAIL = 'Our superintendent checked it already.';
  END IF;
  INSERT INTO public.gc_schedule_lookahead_marks (activity_id, week_of, done, reason, marked_on, marked_by_company_id)
  VALUES (p_activity_id, p_week_of, p_done, p_reason, public.app_today(), p_company_id)
  ON CONFLICT (activity_id, week_of) DO UPDATE
    SET done = EXCLUDED.done, reason = EXCLUDED.reason, marked_on = EXCLUDED.marked_on,
        marked_by_company_id = EXCLUDED.marked_by_company_id, marked_by = NULL
    WHERE public.gc_schedule_lookahead_marks.verified_on IS NULL;
  -- Checked between the look and the write: the check stands.
  IF NOT FOUND THEN
    RAISE EXCEPTION 'alreadyChecked' USING ERRCODE = 'P0001', DETAIL = 'Our superintendent checked it already.';
  END IF;
END;
$$;

COMMENT ON FUNCTION public.gc_trade_say_late(uuid, uuid, date, text, text) IS
  'GC mode (v2.5196): a late notice from the trade''s portal (tradeSayLate, G-117) on its own line, awarded to it, on a job being built, not finished; under way and done read as lateDoor reads them (the actual days, or the line''s percent: an open send-back''s we_see, else the newest report); a new finish under way, a new start not started; the day after the one it changes and not before today; a reason and a sentence. Returns the notice''s id. Service role only.';
COMMENT ON FUNCTION public.gc_trade_keep_day(uuid, uuid) IS
  'GC mode (v2.5196): the company keeps its day after the office pushed its notice back (tradeKeepDay): its own notice, pushed back, not kept, not taken, replaced or moved. Service role only.';
COMMENT ON FUNCTION public.gc_trade_set_crew_count(uuid, uuid, date, integer) IS
  'GC mode (v2.5196): a crew count from the trade''s portal (tradeSetCrewCount, G-142) for its own trade, this week or the next two, 0 to 50; the same as the count that stands keeps nothing. Service role only.';
COMMENT ON FUNCTION public.gc_trade_mark_lookahead(uuid, uuid, date, boolean, text) IS
  'GC mode (v2.5196): a look-ahead mark from the trade''s portal (tradeMarkLookAhead, G-114) on its own line, this week or last week, done or not done with a reason, until our superintendent checks it. Service role only.';

-- Only the service role: the portal's submit function, after it has turned a link into its company.
DO $$
DECLARE
  f text;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'public.gc_trade_say_late(uuid, uuid, date, text, text)',
    'public.gc_trade_keep_day(uuid, uuid)',
    'public.gc_trade_set_crew_count(uuid, uuid, date, integer)',
    'public.gc_trade_mark_lookahead(uuid, uuid, date, boolean, text)'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f);
  END LOOP;
END;
$$;
