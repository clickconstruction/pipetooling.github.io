-- A trade's four writes from its portal (v2.5196, the schedule's PR 14a): a late notice, the day kept after a push back,
-- a crew count and a look-ahead mark, each only as the service role, each checking the company's own awarded trade on a
-- job being built, and each refusal the portal's key with its words. A job of its own, made as postgres, drawn as a dev,
-- with every day read from today so the bed reads the same on any day it runs. Inside one transaction that rolls back.
-- Raises on the first failed assertion; ends with "gc_schedule trade writes PASSED". See scripts/pgtest-gc-schedule.sh.
-- Never against prod.
\set ON_ERROR_STOP 1
BEGIN;

INSERT INTO auth.users (id, email) VALUES ('00000000-0000-0000-0000-0000000008d1', 'dev@tradewrites.test');
INSERT INTO public.users (id, email, name, role) VALUES ('00000000-0000-0000-0000-0000000008d1', 'dev@tradewrites.test', 'Trade Writes Dev', 'dev')
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name;
INSERT INTO public.customers (id, name, master_user_id) VALUES ('00000000-0000-0000-0000-0000000008c1', 'Trade Writes Owner', '00000000-0000-0000-0000-0000000008d1');
INSERT INTO public.projects (id, name, customer_id) VALUES ('00000000-0000-0000-0000-0000000008a1', 'Trade writes P', '00000000-0000-0000-0000-0000000008c1');
INSERT INTO public.gc_projects (project_id, stage) VALUES ('00000000-0000-0000-0000-0000000008a1', 'buyout');
INSERT INTO public.gc_companies (id, name, trades, contact_name) VALUES
  ('00000000-0000-0000-0000-000000000881', 'Writes Electric', ARRAY['Electrical'], 'Dana Volt'),
  ('00000000-0000-0000-0000-000000000882', 'Writes Plumbing', ARRAY['Plumbing'], '');
-- Electrical (b1) awarded to Writes Electric, Plumbing (b2) to Writes Plumbing, and our own crew's Framing (b4).
INSERT INTO public.gc_trade_packages (id, project_id, trade, position, ours) VALUES
  ('00000000-0000-0000-0000-0000000008b1', '00000000-0000-0000-0000-0000000008a1', 'Electrical', 0, false),
  ('00000000-0000-0000-0000-0000000008b2', '00000000-0000-0000-0000-0000000008a1', 'Plumbing', 1, false),
  ('00000000-0000-0000-0000-0000000008b4', '00000000-0000-0000-0000-0000000008a1', 'Framing', 2, true);
INSERT INTO public.gc_invites (id, package_id, company_id) VALUES
  ('00000000-0000-0000-0000-0000000008f1', '00000000-0000-0000-0000-0000000008b1', '00000000-0000-0000-0000-000000000881'),
  ('00000000-0000-0000-0000-0000000008f2', '00000000-0000-0000-0000-0000000008b2', '00000000-0000-0000-0000-000000000882'),
  ('00000000-0000-0000-0000-0000000008f4', '00000000-0000-0000-0000-0000000008b4', '00000000-0000-0000-0000-000000000881');
UPDATE public.gc_trade_packages SET awarded_invite_id = '00000000-0000-0000-0000-0000000008f1', awarded_on = public.app_today() WHERE id = '00000000-0000-0000-0000-0000000008b1';
UPDATE public.gc_trade_packages SET awarded_invite_id = '00000000-0000-0000-0000-0000000008f2', awarded_on = public.app_today() WHERE id = '00000000-0000-0000-0000-0000000008b2';
-- Our own crew's Framing still carries an award to Writes Electric, from before we took it on: ours is what refuses it.
UPDATE public.gc_trade_packages SET awarded_invite_id = '00000000-0000-0000-0000-0000000008f4', awarded_on = public.app_today() WHERE id = '00000000-0000-0000-0000-0000000008b4';
INSERT INTO public.gc_scope_items (id, package_id, position, label) VALUES
  ('00000000-0000-0000-0000-0000000008e1', '00000000-0000-0000-0000-0000000008b1', 0, 'Rough-in'),
  ('00000000-0000-0000-0000-0000000008e2', '00000000-0000-0000-0000-0000000008b1', 1, 'Trim'),
  ('00000000-0000-0000-0000-0000000008e3', '00000000-0000-0000-0000-0000000008b2', 0, 'Rough-in'),
  ('00000000-0000-0000-0000-0000000008e6', '00000000-0000-0000-0000-0000000008b4', 0, 'Walls'),
  ('00000000-0000-0000-0000-0000000008e7', '00000000-0000-0000-0000-0000000008b1', 2, 'Fixtures'),
  ('00000000-0000-0000-0000-0000000008e8', '00000000-0000-0000-0000-0000000008b1', 3, 'Devices');

CREATE SCHEMA gtw;
CREATE FUNCTION gtw.same(label text, got text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF got IS DISTINCT FROM want THEN RAISE EXCEPTION E'% differs.\n--- got ---\n%\n--- want ---\n%', label, got, want; END IF;
  RAISE NOTICE 'ok: %', label;
END $$;
-- A statement refused with words that hold `want`; with `detail_has`, a DETAIL that holds it too.
CREATE FUNCTION gtw.refused(label text, stmt text, want text, detail_has text DEFAULT NULL) RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  v_detail text;
BEGIN
  BEGIN
    EXECUTE stmt;
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_detail = PG_EXCEPTION_DETAIL;
    IF position(want IN SQLERRM) = 0 THEN RAISE EXCEPTION '% was refused for another reason: %', label, SQLERRM; END IF;
    IF detail_has IS NOT NULL AND position(detail_has IN coalesce(v_detail, '')) = 0 THEN
      RAISE EXCEPTION '% was refused without % in its detail: %', label, detail_has, v_detail;
    END IF;
    RAISE NOTICE 'ok: %', label;
    RETURN;
  END;
  RAISE EXCEPTION '% was allowed', label;
END $$;
CREATE FUNCTION gtw.as_user(p_user uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', p_user::text, true);
END $$;
-- This Monday, the company's.
CREATE FUNCTION gtw.monday() RETURNS date LANGUAGE sql STABLE AS $$ SELECT public.app_today() - (extract(isodow FROM public.app_today())::integer - 1) $$;
CREATE FUNCTION gtw.notices(p_activity uuid) RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(string_agg(c.name || ' ' || n.started || ' ' || (n.to_start - public.app_today()) || '..' || (n.to_finish - public.app_today())
    || ' ' || n.reason || ' ' || n.sent_by || ' ' || (n.sent_on = public.app_today()), ' | ' ORDER BY n.created_at), 'none')
  FROM public.gc_schedule_late_notices n JOIN public.gc_companies c ON c.id = n.company_id WHERE n.activity_id = p_activity $$;
GRANT USAGE ON SCHEMA gtw TO authenticated, service_role, anon;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA gtw TO authenticated, service_role, anon;
-- What a press returned, for the steps after it.
CREATE TEMP TABLE ids (k text PRIMARY KEY, id uuid) ON COMMIT DROP;
GRANT ALL ON ids TO authenticated, service_role;

-- P drawn as a dev, every day from today: Electrical rough-in in ten days (e1, not started); Electrical trim under way
-- since last week, its finish two days ago (e2); Plumbing rough-in from last Monday to next Friday (e3); our crew's
-- walls (e6); and an inspection (e5). Then the job is being built.
SELECT gtw.as_user('00000000-0000-0000-0000-0000000008d1');
SET LOCAL ROLE authenticated;
SELECT gtw.same('P drawn, as version 1', public.gc_schedule_draft('00000000-0000-0000-0000-0000000008a1', NULL, 'Drew a first draft.',
  jsonb_build_object('bars', jsonb_build_array(
    jsonb_build_object('kind', 'line', 'scopeItemId', '00000000-0000-0000-0000-0000000008e1', 'packageId', '00000000-0000-0000-0000-0000000008b1', 'start', public.app_today() + 10, 'finish', public.app_today() + 20, 'after', '[]'::jsonb),
    jsonb_build_object('kind', 'line', 'scopeItemId', '00000000-0000-0000-0000-0000000008e2', 'packageId', '00000000-0000-0000-0000-0000000008b1', 'start', gtw.monday() - 7, 'finish', public.app_today() - 2, 'after', '[]'::jsonb),
    jsonb_build_object('kind', 'line', 'scopeItemId', '00000000-0000-0000-0000-0000000008e3', 'packageId', '00000000-0000-0000-0000-0000000008b2', 'start', gtw.monday() - 7, 'finish', gtw.monday() + 11, 'after', '[]'::jsonb),
    jsonb_build_object('kind', 'line', 'scopeItemId', '00000000-0000-0000-0000-0000000008e6', 'packageId', '00000000-0000-0000-0000-0000000008b4', 'start', gtw.monday(), 'finish', gtw.monday() + 4, 'after', '[]'::jsonb),
    jsonb_build_object('kind', 'line', 'scopeItemId', '00000000-0000-0000-0000-0000000008e7', 'packageId', '00000000-0000-0000-0000-0000000008b1', 'start', public.app_today() + 3, 'finish', public.app_today() + 9, 'after', '[]'::jsonb),
    jsonb_build_object('kind', 'line', 'scopeItemId', '00000000-0000-0000-0000-0000000008e8', 'packageId', '00000000-0000-0000-0000-0000000008b1', 'start', public.app_today() + 4, 'finish', public.app_today() + 8, 'after', '[]'::jsonb),
    jsonb_build_object('kind', 'inspection', 'id', '00000000-0000-0000-0000-0000000008e5', 'label', 'Rough-in inspection', 'start', gtw.monday(), 'finish', gtw.monday() + 1, 'after', '[]'::jsonb)
  )))::text, '1');
RESET ROLE;
-- The trim is under way: a trade's report sets its real start.
UPDATE public.gc_schedule_activities SET actual_start = gtw.monday() - 7 WHERE id = '00000000-0000-0000-0000-0000000008e2';
SET LOCAL ROLE service_role;

-- 1 · Only once we are building.
SELECT gtw.refused('a late notice while we buy out', format($q$SELECT public.gc_trade_say_late('00000000-0000-0000-0000-000000000881', '00000000-0000-0000-0000-0000000008e1', %L::date, 'crew', 'Our crew is on another job.')$q$, public.app_today() + 12),
  'jobNotBuilding', 'A late notice opens once we are building the job.');
SELECT gtw.refused('a crew count while we buy out', format($q$SELECT public.gc_trade_set_crew_count('00000000-0000-0000-0000-000000000882', '00000000-0000-0000-0000-0000000008b2', %L::date, 4)$q$, gtw.monday()),
  'jobNotBuilding');
SELECT gtw.refused('a look-ahead mark while we buy out', format($q$SELECT public.gc_trade_mark_lookahead('00000000-0000-0000-0000-000000000882', '00000000-0000-0000-0000-0000000008e3', %L::date, true, NULL)$q$, gtw.monday()),
  'jobNotBuilding');
RESET ROLE;
UPDATE public.gc_projects SET stage = 'building' WHERE project_id = '00000000-0000-0000-0000-0000000008a1';
SET LOCAL ROLE service_role;

-- 2 · A late notice (gc_trade_say_late).
SELECT gtw.refused('a late notice on a bar that is not there', format($q$SELECT public.gc_trade_say_late('00000000-0000-0000-0000-000000000881', '00000000-0000-0000-0000-0000000008ff', %L::date, 'crew', 'Our crew is on another job.')$q$, public.app_today() + 12),
  'notFound', 'No bar with that id.');
SELECT gtw.refused('a late notice on another company''s trade', format($q$SELECT public.gc_trade_say_late('00000000-0000-0000-0000-000000000882', '00000000-0000-0000-0000-0000000008e1', %L::date, 'crew', 'Our crew is on another job.')$q$, public.app_today() + 12),
  'notOnTrade', 'Only the company we awarded this trade can say its work will be late.');
SELECT gtw.refused('a late notice on our own crew''s work', format($q$SELECT public.gc_trade_say_late('00000000-0000-0000-0000-000000000881', '00000000-0000-0000-0000-0000000008e6', %L::date, 'crew', 'Our crew is on another job.')$q$, public.app_today() + 12),
  'notOnTrade');
SELECT gtw.refused('a late notice on an inspection', format($q$SELECT public.gc_trade_say_late('00000000-0000-0000-0000-000000000881', '00000000-0000-0000-0000-0000000008e5', %L::date, 'crew', 'Our crew is on another job.')$q$, public.app_today() + 12),
  'notOnTrade');
SELECT gtw.refused('a late notice with no day', $q$SELECT public.gc_trade_say_late('00000000-0000-0000-0000-000000000881', '00000000-0000-0000-0000-0000000008e1', NULL, 'crew', 'Our crew is on another job.')$q$,
  'badRequest', 'Pick the day.');
SELECT gtw.refused('a new start that is not after the start', format($q$SELECT public.gc_trade_say_late('00000000-0000-0000-0000-000000000881', '00000000-0000-0000-0000-0000000008e1', %L::date, 'crew', 'Our crew is on another job.')$q$, public.app_today() + 10),
  'lateLaterDay', 'Pick a day after ');
SELECT gtw.refused('a new finish after the finish but before today', format($q$SELECT public.gc_trade_say_late('00000000-0000-0000-0000-000000000881', '00000000-0000-0000-0000-0000000008e2', %L::date, 'crew', 'Our crew is on another job.')$q$, public.app_today() - 1),
  'dayPassed', 'Pick today or a later day.');
SELECT gtw.refused('a late notice with no reason', format($q$SELECT public.gc_trade_say_late('00000000-0000-0000-0000-000000000881', '00000000-0000-0000-0000-0000000008e1', %L::date, NULL, 'Our crew is on another job.')$q$, public.app_today() + 12),
  'pickWhy', 'Pick why.');
SELECT gtw.refused('a late notice with a reason the app does not know', format($q$SELECT public.gc_trade_say_late('00000000-0000-0000-0000-000000000881', '00000000-0000-0000-0000-0000000008e1', %L::date, 'Weather', 'Our crew is on another job.')$q$, public.app_today() + 12),
  'pickWhy');
SELECT gtw.refused('a late notice with no sentence', format($q$SELECT public.gc_trade_say_late('00000000-0000-0000-0000-000000000881', '00000000-0000-0000-0000-0000000008e1', %L::date, 'crew', '  Late  ')$q$, public.app_today() + 12),
  'noteNeeded', 'Say what happened, in a sentence.');
SELECT gtw.refused('a late notice with a long note', format($q$SELECT public.gc_trade_say_late('00000000-0000-0000-0000-000000000881', '00000000-0000-0000-0000-0000000008e1', %L::date, 'crew', repeat('x', 2001))$q$, public.app_today() + 12),
  'tooLong');
INSERT INTO ids SELECT 'n1', public.gc_trade_say_late('00000000-0000-0000-0000-000000000881', '00000000-0000-0000-0000-0000000008e1', public.app_today() + 12, 'crew', '  Our crew is on another job.  ');
SELECT gtw.same('not started: the bar moves whole to the new start, keeping its ten days, sent by the contact today',
  gtw.notices('00000000-0000-0000-0000-0000000008e1'), 'Writes Electric false 12..22 crew Dana Volt true');
INSERT INTO ids SELECT 'n2', public.gc_trade_say_late('00000000-0000-0000-0000-000000000881', '00000000-0000-0000-0000-0000000008e2', public.app_today() + 5, 'materials', 'The fixtures ship a week late.');
SELECT gtw.same('under way: the start stays and the finish moves',
  (SELECT (n.to_start = a.start) || ' ' || (n.to_finish - public.app_today()) || ' ' || n.started FROM public.gc_schedule_late_notices n JOIN public.gc_schedule_activities a ON a.id = n.activity_id WHERE n.id = (SELECT id FROM ids WHERE k = 'n2')),
  'true 5 true');
SELECT gtw.same('a notice keeps the dates it was sent against, trimmed words, no answer yet',
  (SELECT (n.was_start = a.start AND n.was_finish = a.finish) || ' ' || n.note || ' ' || coalesce(n.pushed_back_on::text, 'open') FROM public.gc_schedule_late_notices n JOIN public.gc_schedule_activities a ON a.id = n.activity_id WHERE n.id = (SELECT id FROM ids WHERE k = 'n1')),
  'true Our crew is on another job. open');
SELECT gtw.same('a notice is a record: the version stays',
  (SELECT version::text FROM public.gc_schedules WHERE project_id = '00000000-0000-0000-0000-0000000008a1'), '1');

-- 2b · Under way and done as the kernels read them (lineOf): a pay application's claim on the line with no real days
-- on the bar, and an open send-back's percent where we doubted the line. Electrical's statement of work, with the
-- fixtures (e7) and the devices (e8) at 30% by a pay application, and its second pay application sent back doubting
-- the devices at 0.
RESET ROLE;
INSERT INTO public.gc_sows (id, package_id, invite_id, company_id, status, price, retainage_pct, sent_on, signed_on) VALUES
  ('00000000-0000-0000-0000-000000000891', '00000000-0000-0000-0000-0000000008b1', '00000000-0000-0000-0000-0000000008f1', '00000000-0000-0000-0000-000000000881', 'signed', 10000, 10, public.app_today() - 20, public.app_today() - 19);
INSERT INTO public.gc_sow_lines (id, sow_id, position, label, amount, scope_item_id) VALUES
  ('00000000-0000-0000-0000-000000000897', '00000000-0000-0000-0000-000000000891', 0, 'Fixtures', 6000, '00000000-0000-0000-0000-0000000008e7'),
  ('00000000-0000-0000-0000-000000000898', '00000000-0000-0000-0000-000000000891', 1, 'Devices', 4000, '00000000-0000-0000-0000-0000000008e8');
INSERT INTO public.gc_sow_line_reports (sow_line_id, pct, reported_on, company_id) VALUES
  ('00000000-0000-0000-0000-000000000897', 30, public.app_today() - 1, '00000000-0000-0000-0000-000000000881'),
  ('00000000-0000-0000-0000-000000000898', 30, public.app_today() - 1, '00000000-0000-0000-0000-000000000881');
INSERT INTO public.gc_draws (id, sow_id, number, requested_on, status, gross, retainage, net, approved_on, period_to, signed_by, signed_on) VALUES
  ('00000000-0000-0000-0000-000000000851', '00000000-0000-0000-0000-000000000891', 1, public.app_today() - 9, 'approved', 1000, 100, 900, public.app_today() - 8, public.app_today() - 9, 'Dana Volt', public.app_today() - 9);
INSERT INTO public.gc_draws (id, sow_id, number, requested_on, status, gross, retainage, net, period_to, signed_by, signed_on, sent_back_on, sent_back_note) VALUES
  ('00000000-0000-0000-0000-000000000852', '00000000-0000-0000-0000-000000000891', 2, public.app_today() - 1, 'sent_back', 3000, 300, 2700, public.app_today() - 1, 'Dana Volt', public.app_today() - 1, public.app_today(), 'The devices are not in yet.');
INSERT INTO public.gc_draw_lines (draw_id, sow_line_id, to_pct, we_see) VALUES
  ('00000000-0000-0000-0000-000000000852', '00000000-0000-0000-0000-000000000897', 30, NULL),
  ('00000000-0000-0000-0000-000000000852', '00000000-0000-0000-0000-000000000898', 30, 0);
SET LOCAL ROLE service_role;
INSERT INTO ids SELECT 'n7', public.gc_trade_say_late('00000000-0000-0000-0000-000000000881', '00000000-0000-0000-0000-0000000008e7', public.app_today() + 12, 'materials', 'The fixtures ship a week late.');
SELECT gtw.same('30% by a pay application with no real days: under way, so a new finish and the start kept',
  (SELECT n.started || ' ' || (n.to_start = a.start) || ' ' || (n.to_finish - public.app_today()) FROM public.gc_schedule_late_notices n JOIN public.gc_schedule_activities a ON a.id = n.activity_id WHERE n.id = (SELECT id FROM ids WHERE k = 'n7')),
  'true true 12');
INSERT INTO ids SELECT 'n8', public.gc_trade_say_late('00000000-0000-0000-0000-000000000881', '00000000-0000-0000-0000-0000000008e8', public.app_today() + 6, 'materials', 'The devices ship a week late.');
SELECT gtw.same('an open send-back seeing 0 on the line wins over its 30%: not started, so the bar moves whole',
  (SELECT n.started || ' ' || (n.to_start - public.app_today()) || '..' || (n.to_finish - public.app_today()) FROM public.gc_schedule_late_notices n WHERE n.id = (SELECT id FROM ids WHERE k = 'n8')),
  'false 6..10');
RESET ROLE;
INSERT INTO public.gc_sow_line_reports (sow_line_id, pct, reported_on, company_id) VALUES
  ('00000000-0000-0000-0000-000000000897', 100, public.app_today(), '00000000-0000-0000-0000-000000000881');
SET LOCAL ROLE service_role;
SELECT gtw.refused('100% by a pay application with no real finish: done', format($q$SELECT public.gc_trade_say_late('00000000-0000-0000-0000-000000000881', '00000000-0000-0000-0000-0000000008e7', %L::date, 'crew', 'Our crew is on another job.')$q$, public.app_today() + 14),
  'workDone', 'That work is done.');

-- 3 · The day kept after a push back (gc_trade_keep_day).
SELECT gtw.refused('keeping a notice that is not there', $q$SELECT public.gc_trade_keep_day('00000000-0000-0000-0000-000000000881', '00000000-0000-0000-0000-0000000008ff')$q$,
  'notFound', 'No notice with that id.');
SELECT gtw.refused('keeping a notice the office has not answered', format($q$SELECT public.gc_trade_keep_day('00000000-0000-0000-0000-000000000881', '%s')$q$, (SELECT id FROM ids WHERE k = 'n1')),
  'notPushedBack', 'The office has not answered that notice yet.');
RESET ROLE;
UPDATE public.gc_schedule_late_notices SET pushed_back_on = public.app_today(), pushed_back_by = '00000000-0000-0000-0000-0000000008d1', pushed_back_note = 'The inspector is booked that day.'
  WHERE id IN (SELECT id FROM ids WHERE k IN ('n1', 'n2'));
SET LOCAL ROLE service_role;
SELECT gtw.refused('keeping another company''s notice', format($q$SELECT public.gc_trade_keep_day('00000000-0000-0000-0000-000000000882', '%s')$q$, (SELECT id FROM ids WHERE k = 'n1')),
  'notYours', 'That notice is another company''s.');
SELECT public.gc_trade_keep_day('00000000-0000-0000-0000-000000000881', (SELECT id FROM ids WHERE k = 'n1'));
SELECT gtw.same('the day kept, today', (SELECT (kept_on = public.app_today())::text FROM public.gc_schedule_late_notices WHERE id = (SELECT id FROM ids WHERE k = 'n1')), 'true');
SELECT gtw.refused('keeping it twice', format($q$SELECT public.gc_trade_keep_day('00000000-0000-0000-0000-000000000881', '%s')$q$, (SELECT id FROM ids WHERE k = 'n1')),
  'alreadyAnswered', 'You said you will make the day already.');
-- A newer notice on the same bar replaces the one pushed back. Each notice is its own request on prod; inside this one
-- transaction now() does not move, so the first is dated a minute back.
RESET ROLE;
UPDATE public.gc_schedule_late_notices SET created_at = created_at - interval '1 minute' WHERE id = (SELECT id FROM ids WHERE k = 'n2');
SET LOCAL ROLE service_role;
INSERT INTO ids SELECT 'n3', public.gc_trade_say_late('00000000-0000-0000-0000-000000000881', '00000000-0000-0000-0000-0000000008e2', public.app_today() + 8, 'materials', 'The fixtures ship later still.');
SELECT gtw.refused('keeping a notice a newer one replaced', format($q$SELECT public.gc_trade_keep_day('00000000-0000-0000-0000-000000000881', '%s')$q$, (SELECT id FROM ids WHERE k = 'n2')),
  'noticeClosed', 'That notice is closed. The schedule moved since.');
-- A notice whose bar moved since, and one a move took.
INSERT INTO ids SELECT 'n4', public.gc_trade_say_late('00000000-0000-0000-0000-000000000882', '00000000-0000-0000-0000-0000000008e3', public.app_today() + 7, 'weather', 'Rain all week on the slab.');
INSERT INTO ids SELECT 'n5', public.gc_trade_say_late('00000000-0000-0000-0000-000000000881', '00000000-0000-0000-0000-0000000008e1', public.app_today() + 14, 'crew', 'Our crew is short two people.');
RESET ROLE;
UPDATE public.gc_schedule_late_notices SET pushed_back_on = public.app_today(), pushed_back_by = '00000000-0000-0000-0000-0000000008d1', pushed_back_note = 'The inspector is booked that day.'
  WHERE id IN (SELECT id FROM ids WHERE k IN ('n4', 'n5'));
-- The bar under n4 is not where the notice found it.
UPDATE public.gc_schedule_late_notices SET was_start = was_start - 1 WHERE id = (SELECT id FROM ids WHERE k = 'n4');
-- A standing move took n5.
SELECT set_config('gc.schedule_plan_write', 'on', true);
INSERT INTO public.gc_schedule_moves (project_id, activity_id, activity_name, made_on, made_at, made_by_name, from_start, from_finish, to_start, to_finish, reason, note, finish_from, finish_to, late_notice_id, schedule_version)
  SELECT a.project_id, a.id, 'Electrical · Rough-in', public.app_today(), now(), 'Trade Writes Dev', a.start, a.finish, a.start, a.finish, 'crew', 'Took the late notice.', a.finish, a.finish, (SELECT id FROM ids WHERE k = 'n5'), 1
  FROM public.gc_schedule_activities a WHERE a.id = '00000000-0000-0000-0000-0000000008e1';
SELECT set_config('gc.schedule_plan_write', '', true);
SET LOCAL ROLE service_role;
SELECT gtw.refused('keeping a notice whose bar moved since', format($q$SELECT public.gc_trade_keep_day('00000000-0000-0000-0000-000000000882', '%s')$q$, (SELECT id FROM ids WHERE k = 'n4')),
  'noticeClosed');
SELECT gtw.refused('keeping a notice a move took', format($q$SELECT public.gc_trade_keep_day('00000000-0000-0000-0000-000000000881', '%s')$q$, (SELECT id FROM ids WHERE k = 'n5')),
  'noticeClosed');
-- Done work takes no notice.
RESET ROLE;
UPDATE public.gc_schedule_activities SET actual_finish = public.app_today() - 1 WHERE id = '00000000-0000-0000-0000-0000000008e2';
SET LOCAL ROLE service_role;
SELECT gtw.refused('a late notice on done work', format($q$SELECT public.gc_trade_say_late('00000000-0000-0000-0000-000000000881', '00000000-0000-0000-0000-0000000008e2', %L::date, 'crew', 'Our crew is on another job.')$q$, public.app_today() + 12),
  'workDone', 'That work is done.');

-- 4 · A crew count (gc_trade_set_crew_count).
SELECT gtw.refused('a count for a trade that is not there', format($q$SELECT public.gc_trade_set_crew_count('00000000-0000-0000-0000-000000000882', '00000000-0000-0000-0000-0000000008ff', %L::date, 4)$q$, gtw.monday()),
  'notFound', 'No trade with that id.');
SELECT gtw.refused('a count for another company''s trade', format($q$SELECT public.gc_trade_set_crew_count('00000000-0000-0000-0000-000000000881', '00000000-0000-0000-0000-0000000008b2', %L::date, 4)$q$, gtw.monday()),
  'notOnTrade', 'Only the company we awarded this trade can give its crew.');
SELECT gtw.refused('a count for our own crew''s trade', format($q$SELECT public.gc_trade_set_crew_count('00000000-0000-0000-0000-000000000881', '00000000-0000-0000-0000-0000000008b4', %L::date, 4)$q$, gtw.monday()),
  'notOnTrade');
SELECT gtw.refused('a count for a week that is not a Monday', format($q$SELECT public.gc_trade_set_crew_count('00000000-0000-0000-0000-000000000882', '00000000-0000-0000-0000-0000000008b2', %L::date, 4)$q$, gtw.monday() + 1),
  'badRequest', 'A week starts on a Monday.');
SELECT gtw.refused('a count for last week', format($q$SELECT public.gc_trade_set_crew_count('00000000-0000-0000-0000-000000000882', '00000000-0000-0000-0000-0000000008b2', %L::date, 4)$q$, gtw.monday() - 7),
  'weekClosed', 'Give a count for this week or the next two.');
SELECT gtw.refused('a count three weeks out', format($q$SELECT public.gc_trade_set_crew_count('00000000-0000-0000-0000-000000000882', '00000000-0000-0000-0000-0000000008b2', %L::date, 4)$q$, gtw.monday() + 21),
  'weekClosed');
SELECT gtw.refused('a count over 50', format($q$SELECT public.gc_trade_set_crew_count('00000000-0000-0000-0000-000000000882', '00000000-0000-0000-0000-0000000008b2', %L::date, 51)$q$, gtw.monday()),
  'crewWhole', 'A whole number, 0 to 50.');
SELECT gtw.refused('a count under 0', format($q$SELECT public.gc_trade_set_crew_count('00000000-0000-0000-0000-000000000882', '00000000-0000-0000-0000-0000000008b2', %L::date, -1)$q$, gtw.monday()),
  'crewWhole');
SELECT public.gc_trade_set_crew_count('00000000-0000-0000-0000-000000000882', '00000000-0000-0000-0000-0000000008b2', gtw.monday(), 4);
SELECT public.gc_trade_set_crew_count('00000000-0000-0000-0000-000000000882', '00000000-0000-0000-0000-0000000008b2', gtw.monday(), 4);
SELECT public.gc_trade_set_crew_count('00000000-0000-0000-0000-000000000882', '00000000-0000-0000-0000-0000000008b2', gtw.monday() + 14, 0);
SELECT public.gc_trade_set_crew_count('00000000-0000-0000-0000-000000000882', '00000000-0000-0000-0000-0000000008b2', gtw.monday(), 6);
SELECT gtw.same('counts kept newest last, the same count twice kept once, 0 and 50 allowed, today',
  (SELECT string_agg((c.week_of - gtw.monday()) || ':' || c.count || ':' || (c.said_on = public.app_today()), ' ' ORDER BY c.created_at)
   FROM public.gc_schedule_crew_counts c WHERE c.package_id = '00000000-0000-0000-0000-0000000008b2'),
  '0:4:true 14:0:true 0:6:true');

-- 5 · A look-ahead mark (gc_trade_mark_lookahead).
SELECT gtw.refused('a mark on a bar that is not there', format($q$SELECT public.gc_trade_mark_lookahead('00000000-0000-0000-0000-000000000882', '00000000-0000-0000-0000-0000000008ff', %L::date, true, NULL)$q$, gtw.monday()),
  'notFound', 'No bar with that id.');
SELECT gtw.refused('a mark on another company''s line', format($q$SELECT public.gc_trade_mark_lookahead('00000000-0000-0000-0000-000000000881', '00000000-0000-0000-0000-0000000008e3', %L::date, true, NULL)$q$, gtw.monday()),
  'notOnTrade', 'Only the company we awarded this trade can mark its work.');
SELECT gtw.refused('a mark on our own crew''s line', format($q$SELECT public.gc_trade_mark_lookahead('00000000-0000-0000-0000-000000000881', '00000000-0000-0000-0000-0000000008e6', %L::date, true, NULL)$q$, gtw.monday()),
  'notOnTrade');
SELECT gtw.refused('a mark for a week that is not a Monday', format($q$SELECT public.gc_trade_mark_lookahead('00000000-0000-0000-0000-000000000882', '00000000-0000-0000-0000-0000000008e3', %L::date, true, NULL)$q$, gtw.monday() + 2),
  'badRequest', 'A week starts on a Monday.');
SELECT gtw.refused('a mark for next week', format($q$SELECT public.gc_trade_mark_lookahead('00000000-0000-0000-0000-000000000882', '00000000-0000-0000-0000-0000000008e3', %L::date, true, NULL)$q$, gtw.monday() + 7),
  'weekClosed', 'Mark this week or last week.');
SELECT gtw.refused('a mark two weeks back', format($q$SELECT public.gc_trade_mark_lookahead('00000000-0000-0000-0000-000000000882', '00000000-0000-0000-0000-0000000008e3', %L::date, true, NULL)$q$, gtw.monday() - 14),
  'weekClosed');
SELECT gtw.refused('a mark on work that does not run that week', format($q$SELECT public.gc_trade_mark_lookahead('00000000-0000-0000-0000-000000000881', '00000000-0000-0000-0000-0000000008e1', %L::date, true, NULL)$q$, gtw.monday()),
  'badRequest', 'That work does not run that week.');
SELECT gtw.refused('done, with a reason', format($q$SELECT public.gc_trade_mark_lookahead('00000000-0000-0000-0000-000000000882', '00000000-0000-0000-0000-0000000008e3', %L::date, true, 'weather')$q$, gtw.monday()),
  'badRequest', 'Say done, or not done and why.');
SELECT gtw.refused('not done, with no reason', format($q$SELECT public.gc_trade_mark_lookahead('00000000-0000-0000-0000-000000000882', '00000000-0000-0000-0000-0000000008e3', %L::date, false, NULL)$q$, gtw.monday()),
  'pickWhy', 'Pick why.');
SELECT public.gc_trade_mark_lookahead('00000000-0000-0000-0000-000000000882', '00000000-0000-0000-0000-0000000008e3', gtw.monday(), true, NULL);
SELECT public.gc_trade_mark_lookahead('00000000-0000-0000-0000-000000000882', '00000000-0000-0000-0000-0000000008e3', gtw.monday(), false, 'trade before');
SELECT public.gc_trade_mark_lookahead('00000000-0000-0000-0000-000000000882', '00000000-0000-0000-0000-0000000008e3', gtw.monday() - 7, true, NULL);
SELECT gtw.same('one mark per bar and week, changed in place, the company''s, today',
  (SELECT string_agg((m.week_of - gtw.monday()) || ':' || m.done || ':' || coalesce(m.reason, '-') || ':' || (m.marked_by_company_id = '00000000-0000-0000-0000-000000000882') || ':' || (m.marked_on = public.app_today()), ' ' ORDER BY m.week_of)
   FROM public.gc_schedule_lookahead_marks m WHERE m.activity_id = '00000000-0000-0000-0000-0000000008e3'),
  '-7:true:-:true:true 0:false:trade before:true:true');
RESET ROLE;
UPDATE public.gc_schedule_lookahead_marks SET verified_on = public.app_today(), verified_by = '00000000-0000-0000-0000-0000000008d1'
  WHERE activity_id = '00000000-0000-0000-0000-0000000008e3' AND week_of = gtw.monday();
SET LOCAL ROLE service_role;
SELECT gtw.refused('a mark our superintendent checked', format($q$SELECT public.gc_trade_mark_lookahead('00000000-0000-0000-0000-000000000882', '00000000-0000-0000-0000-0000000008e3', %L::date, true, NULL)$q$, gtw.monday()),
  'alreadyChecked', 'Our superintendent checked it already.');
SELECT gtw.same('the checked mark stays as it was', (SELECT done || ':' || reason FROM public.gc_schedule_lookahead_marks WHERE activity_id = '00000000-0000-0000-0000-0000000008e3' AND week_of = gtw.monday()), 'false:trade before');

-- 6 · Who may call them: the service role alone.
SET LOCAL ROLE authenticated;
SELECT gtw.refused('a late notice from a signed-in user', format($q$SELECT public.gc_trade_say_late('00000000-0000-0000-0000-000000000881', '00000000-0000-0000-0000-0000000008e1', %L::date, 'crew', 'Our crew is on another job.')$q$, public.app_today() + 12),
  'permission denied for function gc_trade_say_late');
RESET ROLE;
SELECT gtw.same('the grants: each to the service role alone',
  (SELECT string_agg(p.proname || ':' || has_function_privilege('authenticated', p.oid, 'EXECUTE') || ':' || has_function_privilege('anon', p.oid, 'EXECUTE')
     || ':' || has_function_privilege('service_role', p.oid, 'EXECUTE') || ':' || p.prosecdef, ' ' ORDER BY p.proname)
   FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname IN ('gc_trade_say_late', 'gc_trade_keep_day', 'gc_trade_set_crew_count', 'gc_trade_mark_lookahead')),
  'gc_trade_keep_day:false:false:true:false gc_trade_mark_lookahead:false:false:true:false gc_trade_say_late:false:false:true:false gc_trade_set_crew_count:false:false:true:false');

DO $$ BEGIN RAISE NOTICE 'gc_schedule trade writes PASSED'; END $$;
ROLLBACK;
