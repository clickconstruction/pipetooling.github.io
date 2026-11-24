-- Taking an award back (v2.8434, 20261124040000): gc_take_award_back is gc_award's mirror. Who may, each refusal in
-- its words, the drafted statement of work gone with the award, the line the undo leaves on the company's own call log, and the
-- award guard still refusing a plain write of the three columns. Presses run as a signed-in person through RLS; the
-- fixtures are made as postgres with nobody signed in; everything rolls back. Raises on the first failed assertion;
-- ends with "gc_take_award_back PASSED". See scripts/pgtest-gc-take-award-back.sh. Never against prod.
\set ON_ERROR_STOP 1
BEGIN;

INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-0000000a7d01', 'dev@takeback.test'), ('00000000-0000-0000-0000-0000000a7d02', 'estimator@takeback.test'),
  ('00000000-0000-0000-0000-0000000a7d03', 'master@takeback.test'), ('00000000-0000-0000-0000-0000000a7d04', 'assistant@takeback.test'),
  ('00000000-0000-0000-0000-0000000a7d05', 'controller@takeback.test'), ('00000000-0000-0000-0000-0000000a7d06', 'training@takeback.test');
INSERT INTO public.users (id, email, name, role) VALUES
  ('00000000-0000-0000-0000-0000000a7d01', 'dev@takeback.test', 'Takeback Dev', 'dev'),
  ('00000000-0000-0000-0000-0000000a7d02', 'estimator@takeback.test', 'Takeback Estimator', 'estimator'),
  ('00000000-0000-0000-0000-0000000a7d03', 'master@takeback.test', 'Takeback Master', 'master_technician'),
  ('00000000-0000-0000-0000-0000000a7d04', 'assistant@takeback.test', 'Takeback Assistant', 'assistant'),
  ('00000000-0000-0000-0000-0000000a7d05', 'controller@takeback.test', 'Takeback Controller', 'controller'),
  ('00000000-0000-0000-0000-0000000a7d06', 'training@takeback.test', 'Takeback Training Dev', 'dev')
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name;
UPDATE public.users SET read_only = true WHERE id = '00000000-0000-0000-0000-0000000a7d06';

-- One job, bidding: Sitework (two lines) with two quotes, Concrete with one, Framing with an ask and no quote.
INSERT INTO public.customers (id, name, master_user_id) VALUES ('00000000-0000-0000-0000-0000000a7c01', 'Takeback Test Owner', '00000000-0000-0000-0000-0000000a7d01');
INSERT INTO public.projects (id, name, customer_id) VALUES ('00000000-0000-0000-0000-0000000a7a01', 'Takeback test clinic', '00000000-0000-0000-0000-0000000a7c01');
INSERT INTO public.gc_projects (project_id, stage) VALUES ('00000000-0000-0000-0000-0000000a7a01', 'bidding');
INSERT INTO public.gc_plan_sets (project_id, rev, label, issued_on) VALUES ('00000000-0000-0000-0000-0000000a7a01', 0, 'Bid set', DATE '2026-10-01');
INSERT INTO public.gc_trade_packages (id, project_id, trade, position, budget, ours) VALUES
  ('00000000-0000-0000-0000-0000000a7b01', '00000000-0000-0000-0000-0000000a7a01', 'Sitework', 0, 60000, false),
  ('00000000-0000-0000-0000-0000000a7b02', '00000000-0000-0000-0000-0000000a7a01', 'Concrete', 1, 84000, false),
  ('00000000-0000-0000-0000-0000000a7b03', '00000000-0000-0000-0000-0000000a7a01', 'Framing', 2, 40000, false);
INSERT INTO public.gc_scope_items (id, package_id, position, label) VALUES
  ('00000000-0000-0000-0000-0000000a7e01', '00000000-0000-0000-0000-0000000a7b01', 0, 'Clearing and grading'),
  ('00000000-0000-0000-0000-0000000a7e02', '00000000-0000-0000-0000-0000000a7b01', 1, 'Paving'),
  ('00000000-0000-0000-0000-0000000a7e03', '00000000-0000-0000-0000-0000000a7b02', 0, 'Foundations');
INSERT INTO public.gc_companies (id, name, trades) VALUES
  ('00000000-0000-0000-0000-0000000a7101', 'Lonestar Earthworks', '{Sitework}'),
  ('00000000-0000-0000-0000-0000000a7102', 'Hillside Excavation', '{Sitework}'),
  ('00000000-0000-0000-0000-0000000a7103', 'Capped Concrete', '{Concrete}');
INSERT INTO public.gc_invites (id, package_id, company_id, status) VALUES
  ('00000000-0000-0000-0000-0000000a7201', '00000000-0000-0000-0000-0000000a7b01', '00000000-0000-0000-0000-0000000a7101', 'bid'),
  ('00000000-0000-0000-0000-0000000a7202', '00000000-0000-0000-0000-0000000a7b01', '00000000-0000-0000-0000-0000000a7102', 'bid'),
  ('00000000-0000-0000-0000-0000000a7203', '00000000-0000-0000-0000-0000000a7b02', '00000000-0000-0000-0000-0000000a7103', 'bid'),
  ('00000000-0000-0000-0000-0000000a7204', '00000000-0000-0000-0000-0000000a7b03', '00000000-0000-0000-0000-0000000a7101', 'invited');
INSERT INTO public.gc_quotes (invite_id, amount, based_on_rev, includes, source) VALUES
  ('00000000-0000-0000-0000-0000000a7201', 66500, 0, '{"00000000-0000-0000-0000-0000000a7e01": "yes", "00000000-0000-0000-0000-0000000a7e02": "yes"}', 'trade'),
  ('00000000-0000-0000-0000-0000000a7202', 70000, 0, '{"00000000-0000-0000-0000-0000000a7e01": "yes", "00000000-0000-0000-0000-0000000a7e02": "yes"}', 'trade'),
  ('00000000-0000-0000-0000-0000000a7203', 61200, 0, '{"00000000-0000-0000-0000-0000000a7e03": "yes"}', 'office');
-- Sitework carries Hillside's number while we bid: the award never touches what the trade carries.
UPDATE public.gc_trade_packages SET carried_invite_id = '00000000-0000-0000-0000-0000000a7202' WHERE id = '00000000-0000-0000-0000-0000000a7b01';
-- A change order on the job, for the fixtures that need one.
INSERT INTO public.gc_change_orders (id, project_id, number, description, reason, package_id, cost, price)
VALUES ('00000000-0000-0000-0000-0000000a7f01', '00000000-0000-0000-0000-0000000a7a01', 1, 'Rock under the lot', 'field', '00000000-0000-0000-0000-0000000a7b01', 4000, 4400);

CREATE SCHEMA tab;
CREATE FUNCTION tab.same(label text, got text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF got IS DISTINCT FROM want THEN RAISE EXCEPTION E'% differs.\n--- got ---\n%\n--- want ---\n%', label, got, want; END IF;
  RAISE NOTICE 'ok: %', label;
END $$;
-- A statement refused with exactly these words; its writes go with the refusal (a subtransaction).
CREATE FUNCTION tab.refused(label text, stmt text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN
    EXECUTE stmt;
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM IS DISTINCT FROM want THEN RAISE EXCEPTION E'% was refused with other words.\n--- got ---\n%\n--- want ---\n%', label, SQLERRM, want; END IF;
    RAISE NOTICE 'ok: %', label;
    RETURN;
  END;
  RAISE EXCEPTION '% was allowed', label;
END $$;
CREATE FUNCTION tab.as_user(p_user uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', p_user::text, true);
END $$;
CREATE FUNCTION tab.as_nobody() RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', '', true);
  PERFORM set_config('request.jwt.claim.sub', '', true);
END $$;
-- Sitework's statement of work.
CREATE FUNCTION tab.sow() RETURNS uuid LANGUAGE sql AS $$ SELECT id FROM public.gc_sows WHERE package_id = '00000000-0000-0000-0000-0000000a7b01' $$;
-- One thing put in the way of Sitework's take-back, as server code with nobody signed in, then the dev's press. The
-- fixture and whatever the press did go with the subtransaction, so each case starts from the same award. Called as
-- postgres. `want` null: the press goes through.
CREATE FUNCTION tab.held(label text, fixture text, want text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  got text;
BEGIN
  BEGIN
    PERFORM tab.as_nobody();
    EXECUTE fixture;
    PERFORM tab.as_user('00000000-0000-0000-0000-0000000a7d01');
    SET LOCAL ROLE authenticated;
    BEGIN
      PERFORM public.gc_take_award_back('00000000-0000-0000-0000-0000000a7b01');
      got := NULL;
    EXCEPTION WHEN OTHERS THEN
      got := SQLERRM;
    END;
    RAISE EXCEPTION USING ERRCODE = 'ZZ001', MESSAGE = coalesce(got, '(went through)');
  EXCEPTION WHEN SQLSTATE 'ZZ001' THEN
    got := SQLERRM;
  END;
  IF got IS DISTINCT FROM coalesce(want, '(went through)') THEN
    RAISE EXCEPTION E'% differs.\n--- got ---\n%\n--- want ---\n%', label, got, coalesce(want, '(went through)');
  END IF;
  RAISE NOTICE 'ok: %', label;
END $$;
GRANT USAGE ON SCHEMA tab TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA tab TO authenticated;

-- 0 · The dev awards Sitework to Lonestar: the award and its drafted statement of work, two lines.
SELECT tab.as_user('00000000-0000-0000-0000-0000000a7d01');
SET LOCAL ROLE authenticated;
SELECT public.gc_award('00000000-0000-0000-0000-0000000a7201', '00000000-0000-0000-0000-0000000a7d01') IS NOT NULL AS awarded;
SELECT tab.same('the award and its draft', (
  SELECT k.awarded_invite_id || ' ' || s.status || ' ' || s.price || ' lines ' || (SELECT count(*) FROM public.gc_sow_lines l WHERE l.sow_id = s.id)
  FROM public.gc_trade_packages k JOIN public.gc_sows s ON s.package_id = k.id WHERE k.id = '00000000-0000-0000-0000-0000000a7b01'),
  '00000000-0000-0000-0000-0000000a7201 draft 66500 lines 2');

-- 1 · Who may take it back: whoever may award. Every other role is refused in words before any write.
SELECT tab.refused('no trade with that id', $q$SELECT public.gc_take_award_back('00000000-0000-0000-0000-0000000a7bff')$q$, 'No trade with that id.');
SELECT tab.refused('a trade that is not awarded', $q$SELECT public.gc_take_award_back('00000000-0000-0000-0000-0000000a7b03')$q$, 'Framing is not awarded.');
RESET ROLE;
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN SELECT * FROM (VALUES
    ('an estimator', '00000000-0000-0000-0000-0000000a7d02'::uuid), ('a master', '00000000-0000-0000-0000-0000000a7d03'::uuid),
    ('an assistant', '00000000-0000-0000-0000-0000000a7d04'::uuid), ('a controller', '00000000-0000-0000-0000-0000000a7d05'::uuid)) AS t(who, id)
  LOOP
    PERFORM tab.as_user(r.id);
    SET LOCAL ROLE authenticated;
    PERFORM tab.refused(r.who || ', until call W', $q$SELECT public.gc_take_award_back('00000000-0000-0000-0000-0000000a7b01')$q$,
      'Only a dev takes an award back while GC mode is built.');
    RESET ROLE;
  END LOOP;
END $$;
-- Nobody signed in, under the signed-in role.
SELECT tab.as_nobody();
SET LOCAL ROLE authenticated;
SELECT tab.refused('nobody signed in', $q$SELECT public.gc_take_award_back('00000000-0000-0000-0000-0000000a7b01')$q$,
  'Only a dev takes an award back while GC mode is built.');
RESET ROLE;
-- A training account that is a dev is refused in its own words (the read-only fence would hide the trade from the
-- function's row lock, and the refusal would read "No trade with that id.").
SELECT tab.as_user('00000000-0000-0000-0000-0000000a7d06');
SET LOCAL ROLE authenticated;
SELECT tab.refused('a training dev', $q$SELECT public.gc_take_award_back('00000000-0000-0000-0000-0000000a7b01')$q$, 'A training account cannot take an award back.');
RESET ROLE;
SELECT tab.same('nothing taken back by a refusal', (
  SELECT (SELECT count(*) FROM public.gc_trade_packages WHERE awarded_invite_id IS NOT NULL) || ' ' || (SELECT count(*) FROM public.gc_sows)), '1 1');

-- 2 · The statement of work's own step. Sent or signed, it is never deleted here.
SELECT tab.held('a statement of work sent to sign', $f$UPDATE public.gc_sows SET status = 'sent', sent_on = DATE '2026-10-09' WHERE id = tab.sow()$f$,
  'Sitework stays awarded to Lonestar Earthworks, since the statement of work went to them to sign on Oct 9. Nothing takes a sent statement of work back yet.');
SELECT tab.held('a signed statement of work', $f$UPDATE public.gc_sows SET status = 'signed', sent_on = DATE '2026-10-09', signed_on = DATE '2026-10-12' WHERE id = tab.sow()$f$,
  'Sitework stays awarded to Lonestar Earthworks, since they signed the statement of work on Oct 12. A signed statement of work changes through Change orders on the job''s card.');
SELECT tab.held('a cancelled statement of work', $f$UPDATE public.gc_sows SET status = 'cancelled' WHERE id = tab.sow()$f$,
  'Sitework stays awarded to Lonestar Earthworks, since its statement of work is not a draft any more.');

-- 3 · What can stand on a statement of work, each held even on a draft.
SELECT tab.held('a pay application', $f$INSERT INTO public.gc_draws (sow_id, number, requested_on, status, gross, retainage, net, period_to, signed_by, signed_on)
  VALUES (tab.sow(), 1, public.app_today(), 'requested', 1000, 100, 900, public.app_today(), 'Pat Ridgeway', public.app_today())$f$,
  'Sitework stays awarded to Lonestar Earthworks, since they sent a pay application on it. Open Draws on the job''s card.');
SELECT tab.held('a back charge', $f$INSERT INTO public.gc_back_charges (project_id, package_id, company_id, sow_id, amount, reason, sent_on)
  VALUES ('00000000-0000-0000-0000-0000000a7a01', '00000000-0000-0000-0000-0000000a7b01', '00000000-0000-0000-0000-0000000a7101', tab.sow(), 250, 'Broken curb', public.app_today())$f$,
  'Sitework stays awarded to Lonestar Earthworks, since a back charge is on it. Open Draws on the job''s card.');
SELECT tab.held('a change the trade asked for', $f$INSERT INTO public.gc_trade_change_requests (project_id, package_id, company_id, sow_id, asked_on, description, reason, amount)
  VALUES ('00000000-0000-0000-0000-0000000a7a01', '00000000-0000-0000-0000-0000000a7b01', '00000000-0000-0000-0000-0000000a7101', tab.sow(), public.app_today(), 'Rock', 'field', 4000)$f$,
  'Sitework stays awarded to Lonestar Earthworks, since they asked for a change on it. Open Change orders on the job''s card.');
SELECT tab.held('a change order sent to the trade', $f$INSERT INTO public.gc_change_order_trade_sends (change_order_id, sow_id, sent_on)
  VALUES ('00000000-0000-0000-0000-0000000a7f01', tab.sow(), public.app_today())$f$,
  'Sitework stays awarded to Lonestar Earthworks, since a change order went to them on it. Open Change orders on the job''s card.');
SELECT tab.held('a change order signed into a line', $f$INSERT INTO public.gc_sow_lines (sow_id, position, label, amount, change_order_id)
  VALUES (tab.sow(), 2, 'Rock under the lot', 4000, '00000000-0000-0000-0000-0000000a7f01')$f$,
  'Sitework stays awarded to Lonestar Earthworks, since a change order went to them on it. Open Change orders on the job''s card.');
SELECT tab.held('their report of work in place', $f$INSERT INTO public.gc_sow_line_reports (sow_line_id, pct, reported_on, company_id)
  SELECT l.id, 20, public.app_today(), '00000000-0000-0000-0000-0000000a7101' FROM public.gc_sow_lines l WHERE l.sow_id = tab.sow() ORDER BY l.position LIMIT 1$f$,
  'Sitework stays awarded to Lonestar Earthworks, since they reported work in place on it. Open Draws on the job''s card.');
SELECT tab.held('a bill day answer', $f$INSERT INTO public.gc_bill_day_nothing (sow_id, period_to, said_by) VALUES (tab.sow(), DATE '2026-10-25', 'Luis Ortega')$f$,
  'Sitework stays awarded to Lonestar Earthworks, since they answered a bill day on it. Open Bill day on the job''s card.');

-- 4 · What can stand on the award itself: it names the company on the trade.
SELECT tab.held('a paper sent for the trade', $f$INSERT INTO public.gc_paper_sends (company_id, paper, project_id, package_id, due_on)
  VALUES ('00000000-0000-0000-0000-0000000a7101', 'sow', '00000000-0000-0000-0000-0000000a7a01', '00000000-0000-0000-0000-0000000a7b01', public.app_today() + 5)$f$,
  'Sitework stays awarded to Lonestar Earthworks, since a paper for this trade went to them. Open the company on Trade partners.');
SELECT tab.held('a submittal on the trade', $f$INSERT INTO public.gc_submittals (project_id, package_id, number, title, kind, asked_on)
  VALUES ('00000000-0000-0000-0000-0000000a7a01', '00000000-0000-0000-0000-0000000a7b01', '31 00 00-01', 'Base rock', 'product data', public.app_today())$f$,
  'Sitework stays awarded to Lonestar Earthworks, since the trade has submittals. Open Submittals on the job''s card.');
SELECT tab.held('an RFI the company asked', $f$INSERT INTO public.gc_rfis (project_id, number, question, package_id, asked_by_company_id, asked_on)
  VALUES ('00000000-0000-0000-0000-0000000a7a01', 1, 'Where does the lot drain?', '00000000-0000-0000-0000-0000000a7b01', '00000000-0000-0000-0000-0000000a7101', public.app_today())$f$,
  'Sitework stays awarded to Lonestar Earthworks, since they asked an RFI on it. Open RFIs on the job''s card.');
SELECT tab.held('a day the company gave us', $f$INSERT INTO public.gc_trade_promises (company_id, kind, project_id, package_id, what, due_on, source)
  VALUES ('00000000-0000-0000-0000-0000000a7101', 'start', '00000000-0000-0000-0000-0000000a7a01', '00000000-0000-0000-0000-0000000a7b01', 'the start', public.app_today() + 7, 'office')$f$,
  'Sitework stays awarded to Lonestar Earthworks, since they gave us a day for this trade. Open the company on Trade partners.');
-- None of these is the award's: our own RFI on the trade, the company's paper for itself, its promise on another
-- trade, another company's paper on this trade.
SELECT tab.held('records that are not the award''s do not hold it', $f$
  INSERT INTO public.gc_rfis (project_id, number, question, package_id, asked_on)
    VALUES ('00000000-0000-0000-0000-0000000a7a01', 2, 'Our own question', '00000000-0000-0000-0000-0000000a7b01', public.app_today());
  INSERT INTO public.gc_paper_sends (company_id, paper, due_on) VALUES ('00000000-0000-0000-0000-0000000a7101', 'w9', public.app_today() + 5);
  INSERT INTO public.gc_trade_promises (company_id, kind, project_id, package_id, what, due_on, source)
    VALUES ('00000000-0000-0000-0000-0000000a7101', 'start', '00000000-0000-0000-0000-0000000a7a01', '00000000-0000-0000-0000-0000000a7b03', 'the start', public.app_today() + 7, 'office');
  INSERT INTO public.gc_paper_sends (company_id, paper, project_id, package_id, due_on)
    VALUES ('00000000-0000-0000-0000-0000000a7102', 'sow', '00000000-0000-0000-0000-0000000a7a01', '00000000-0000-0000-0000-0000000a7b01', public.app_today() + 5)$f$,
  NULL);
SELECT tab.same('every case left the award as it was', (
  SELECT k.awarded_invite_id || ' ' || s.status || ' lines ' || (SELECT count(*) FROM public.gc_sow_lines l WHERE l.sow_id = s.id)
  FROM public.gc_trade_packages k JOIN public.gc_sows s ON s.package_id = k.id WHERE k.id = '00000000-0000-0000-0000-0000000a7b01'),
  '00000000-0000-0000-0000-0000000a7201 draft lines 2');

-- 5 · The dev takes Sitework's award back: the three columns clear, the draft and its lines go, the flag is off
-- again, what the trade carried stays, and the company's own call log holds the undo with who and when.
SELECT tab.as_user('00000000-0000-0000-0000-0000000a7d01');
SET LOCAL ROLE authenticated;
SELECT public.gc_take_award_back('00000000-0000-0000-0000-0000000a7b01');
SELECT tab.same('the award is clear', (
  SELECT coalesce(awarded_invite_id::text, 'null') || ' ' || coalesce(awarded_by::text, 'null') || ' ' || coalesce(awarded_on::text, 'null') || ' carries ' || carried_invite_id
  FROM public.gc_trade_packages WHERE id = '00000000-0000-0000-0000-0000000a7b01'), 'null null null carries 00000000-0000-0000-0000-0000000a7202');
SELECT tab.same('the draft and its lines went with it', (SELECT (SELECT count(*) FROM public.gc_sows) || ' ' || (SELECT count(*) FROM public.gc_sow_lines)), '0 0');
SELECT tab.same('the flag is off once it returns', coalesce(current_setting('gc.award_write', true), ''), '');
SELECT tab.same('the undo is on the company''s own call log, with who and when', (
  SELECT coalesce(c.invite_id::text, 'no ask') || ' ' || c.by_user_id || ' ' || c.by_name || ' ' || c.how || ' ' || (c.contacted_on = public.app_today()) || ' ' || c.note
  FROM public.gc_company_contacts c WHERE c.company_id = '00000000-0000-0000-0000-0000000a7101'),
  'no ask 00000000-0000-0000-0000-0000000a7d01 Takeback Dev note true Award taken back on Sitework, Takeback test clinic. Awarded '
    || to_char(public.app_today(), 'Mon FMDD') || ' by Takeback Dev for $66,500. The drafted statement of work went with it.');
SELECT tab.same('the ask and its quote are as they were', (
  SELECT i.status || ' ' || (SELECT count(*) FROM public.gc_quotes q WHERE q.invite_id = i.id) FROM public.gc_invites i WHERE i.id = '00000000-0000-0000-0000-0000000a7201'), 'bid 1');
SELECT tab.refused('a trade taken back twice', $q$SELECT public.gc_take_award_back('00000000-0000-0000-0000-0000000a7b01')$q$, 'Sitework is not awarded.');

-- 6 · The award guard holds as before: a plain write of the three columns is refused, a dev's too, and the trade is
-- awarded again only through gc_award, which drafts a new statement of work.
SELECT tab.refused('a dev sets an award by hand after a take-back', $q$UPDATE public.gc_trade_packages
  SET awarded_invite_id = '00000000-0000-0000-0000-0000000a7201', awarded_by = '00000000-0000-0000-0000-0000000a7d01', awarded_on = public.app_today()
  WHERE id = '00000000-0000-0000-0000-0000000a7b01'$q$,
  'A trade''s award changes only through Award and draft the statement of work in Compare quotes.');
SELECT public.gc_award('00000000-0000-0000-0000-0000000a7202', '00000000-0000-0000-0000-0000000a7d01') IS NOT NULL AS awarded_again;
SELECT tab.same('awarded again, to the other company, with a new draft', (
  SELECT k.awarded_invite_id || ' ' || s.status || ' ' || s.price FROM public.gc_trade_packages k JOIN public.gc_sows s ON s.package_id = k.id
  WHERE k.id = '00000000-0000-0000-0000-0000000a7b01'), '00000000-0000-0000-0000-0000000a7202 draft 70000');
SELECT tab.refused('a dev clears an award by hand', $q$UPDATE public.gc_trade_packages SET awarded_invite_id = NULL, awarded_by = NULL, awarded_on = NULL
  WHERE id = '00000000-0000-0000-0000-0000000a7b01'$q$,
  'A trade''s award changes only through Award and draft the statement of work in Compare quotes.');
RESET ROLE;
SELECT tab.as_user('00000000-0000-0000-0000-0000000a7d02');
SET LOCAL ROLE authenticated;
SELECT tab.refused('an estimator clears an award by hand', $q$UPDATE public.gc_trade_packages SET awarded_invite_id = NULL, awarded_by = NULL, awarded_on = NULL
  WHERE id = '00000000-0000-0000-0000-0000000a7b01'$q$,
  'A trade''s award changes only through Award and draft the statement of work in Compare quotes.');
RESET ROLE;

-- 7 · An award with no statement of work (one a fixture or server code wrote, with nobody named as awarding) still
-- comes back, and its line says only what it knows.
SELECT tab.as_nobody();
UPDATE public.gc_trade_packages SET awarded_invite_id = '00000000-0000-0000-0000-0000000a7203', awarded_on = DATE '2026-10-01' WHERE id = '00000000-0000-0000-0000-0000000a7b02';
SELECT tab.as_user('00000000-0000-0000-0000-0000000a7d01');
SET LOCAL ROLE authenticated;
SELECT public.gc_take_award_back('00000000-0000-0000-0000-0000000a7b02');
SELECT tab.same('an award with no statement of work', (
  SELECT coalesce(k.awarded_invite_id::text, 'null') || ' ' || (SELECT c.note FROM public.gc_company_contacts c WHERE c.company_id = '00000000-0000-0000-0000-0000000a7103')
  FROM public.gc_trade_packages k WHERE k.id = '00000000-0000-0000-0000-0000000a7b02'), 'null Award taken back on Concrete, Takeback test clinic. Awarded Oct 1.');
RESET ROLE;

DO $$ BEGIN RAISE NOTICE 'gc_take_award_back PASSED'; END $$;
ROLLBACK;
