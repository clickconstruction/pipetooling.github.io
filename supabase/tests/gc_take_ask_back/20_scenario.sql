-- Taking an ask back (v2.8440, 20261124050000; v2.8490, 20261124100000): gc_take_ask_back deletes an ask the company
-- never heard about, and closes one they did hear about as ours (declined_why 'withdrawn'), kept on their record. Who
-- may, each refusal, the ask and the office's notes gone, the row the undo leaves in gc_asks_taken_back and who reads
-- and writes it, each way of having heard closing the ask instead with its line on the company's call log, the trade's
-- own lock telling our close from its pass, the bench's Remove letting the company go afterwards by its own unchanged
-- rule, and the award guard still refusing a plain write. Presses run as a signed-in person through
-- RLS; the fixtures are made as postgres with nobody signed in; everything rolls back. Raises on the first failed
-- assertion; ends with "gc_take_ask_back PASSED". See scripts/pgtest-gc-take-ask-back.sh. Never against prod.
\set ON_ERROR_STOP 1
BEGIN;

INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-0000000a8d01', 'dev@askback.test'), ('00000000-0000-0000-0000-0000000a8d02', 'estimator@askback.test'),
  ('00000000-0000-0000-0000-0000000a8d03', 'master@askback.test'), ('00000000-0000-0000-0000-0000000a8d04', 'assistant@askback.test'),
  ('00000000-0000-0000-0000-0000000a8d05', 'controller@askback.test'), ('00000000-0000-0000-0000-0000000a8d06', 'training@askback.test'),
  ('00000000-0000-0000-0000-0000000a8d07', 'super@askback.test'), ('00000000-0000-0000-0000-0000000a8d08', 'sub@askback.test');
INSERT INTO public.users (id, email, name, role) VALUES
  ('00000000-0000-0000-0000-0000000a8d01', 'dev@askback.test', 'Askback Dev', 'dev'),
  ('00000000-0000-0000-0000-0000000a8d02', 'estimator@askback.test', 'Askback Estimator', 'estimator'),
  ('00000000-0000-0000-0000-0000000a8d03', 'master@askback.test', 'Askback Master', 'master_technician'),
  ('00000000-0000-0000-0000-0000000a8d04', 'assistant@askback.test', 'Askback Assistant', 'assistant'),
  ('00000000-0000-0000-0000-0000000a8d05', 'controller@askback.test', 'Askback Controller', 'controller'),
  ('00000000-0000-0000-0000-0000000a8d06', 'training@askback.test', 'Askback Training Estimator', 'estimator'),
  ('00000000-0000-0000-0000-0000000a8d07', 'super@askback.test', 'Askback Superintendent', 'superintendent'),
  ('00000000-0000-0000-0000-0000000a8d08', 'sub@askback.test', 'Askback Sub', 'subcontractor')
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name;
UPDATE public.users SET read_only = true WHERE id = '00000000-0000-0000-0000-0000000a8d06';

-- One job with three trades. Electrical holds the asks; Concrete is awarded; Framing holds a statement of work
-- whose award a fixture left off.
INSERT INTO public.customers (id, name, master_user_id) VALUES ('00000000-0000-0000-0000-0000000a8c01', 'Askback Test Owner', '00000000-0000-0000-0000-0000000a8d01');
INSERT INTO public.projects (id, name, customer_id) VALUES ('00000000-0000-0000-0000-0000000a8a01', 'Askback test clinic', '00000000-0000-0000-0000-0000000a8c01');
INSERT INTO public.gc_projects (project_id, stage) VALUES ('00000000-0000-0000-0000-0000000a8a01', 'bidding');
INSERT INTO public.gc_trade_packages (id, project_id, trade, position, budget, ours) VALUES
  ('00000000-0000-0000-0000-0000000a8b01', '00000000-0000-0000-0000-0000000a8a01', 'Electrical', 0, 60000, false),
  ('00000000-0000-0000-0000-0000000a8b02', '00000000-0000-0000-0000-0000000a8a01', 'Concrete', 1, 84000, false),
  ('00000000-0000-0000-0000-0000000a8b03', '00000000-0000-0000-0000-0000000a8a01', 'Framing', 2, 40000, false);
-- The companies, one per case. The first is the walk's: asked, with no page made and nothing sent.
INSERT INTO public.gc_companies (id, name, trades) VALUES
  ('00000000-0000-0000-0000-0000000a8101', 'ZZ Test trade no page, delete me', '{Electrical}'),
  ('00000000-0000-0000-0000-0000000a8102', 'Quoted Electric', '{Electrical}'),
  ('00000000-0000-0000-0000-0000000a8103', 'Awarded Concrete', '{Concrete}'),
  ('00000000-0000-0000-0000-0000000a8104', 'Passed Electric', '{Electrical}'),
  ('00000000-0000-0000-0000-0000000a8105', 'Looking Electric', '{Electrical}'),
  ('00000000-0000-0000-0000-0000000a8106', 'Emailed Electric', '{Electrical}'),
  ('00000000-0000-0000-0000-0000000a8107', 'Called Electric', '{Electrical}'),
  ('00000000-0000-0000-0000-0000000a8108', 'Signed Framing', '{Framing}'),
  ('00000000-0000-0000-0000-0000000a8109', 'Seen Electric', '{Electrical}');
INSERT INTO public.gc_invites (id, package_id, company_id, status, seen_rev, invited_on, invited_by) VALUES
  ('00000000-0000-0000-0000-0000000a8201', '00000000-0000-0000-0000-0000000a8b01', '00000000-0000-0000-0000-0000000a8101', 'invited', NULL, DATE '2026-11-20', '00000000-0000-0000-0000-0000000a8d01'),
  ('00000000-0000-0000-0000-0000000a8202', '00000000-0000-0000-0000-0000000a8b01', '00000000-0000-0000-0000-0000000a8102', 'bid', 0, DATE '2026-11-20', '00000000-0000-0000-0000-0000000a8d01'),
  ('00000000-0000-0000-0000-0000000a8203', '00000000-0000-0000-0000-0000000a8b02', '00000000-0000-0000-0000-0000000a8103', 'bid', 0, DATE '2026-11-20', '00000000-0000-0000-0000-0000000a8d01'),
  ('00000000-0000-0000-0000-0000000a8204', '00000000-0000-0000-0000-0000000a8b01', '00000000-0000-0000-0000-0000000a8104', 'declined', NULL, DATE '2026-11-20', '00000000-0000-0000-0000-0000000a8d01'),
  ('00000000-0000-0000-0000-0000000a8205', '00000000-0000-0000-0000-0000000a8b01', '00000000-0000-0000-0000-0000000a8105', 'opened', NULL, DATE '2026-11-20', '00000000-0000-0000-0000-0000000a8d01'),
  ('00000000-0000-0000-0000-0000000a8206', '00000000-0000-0000-0000-0000000a8b01', '00000000-0000-0000-0000-0000000a8106', 'invited', NULL, DATE '2026-11-20', '00000000-0000-0000-0000-0000000a8d01'),
  ('00000000-0000-0000-0000-0000000a8207', '00000000-0000-0000-0000-0000000a8b01', '00000000-0000-0000-0000-0000000a8107', 'invited', NULL, DATE '2026-11-20', '00000000-0000-0000-0000-0000000a8d01'),
  ('00000000-0000-0000-0000-0000000a8208', '00000000-0000-0000-0000-0000000a8b03', '00000000-0000-0000-0000-0000000a8108', 'invited', NULL, DATE '2026-11-20', '00000000-0000-0000-0000-0000000a8d01'),
  ('00000000-0000-0000-0000-0000000a8209', '00000000-0000-0000-0000-0000000a8b01', '00000000-0000-0000-0000-0000000a8109', 'invited', 0, DATE '2026-11-20', '00000000-0000-0000-0000-0000000a8d01');
INSERT INTO public.gc_quotes (invite_id, amount, based_on_rev, source) VALUES
  ('00000000-0000-0000-0000-0000000a8202', 58000, 0, 'office'), ('00000000-0000-0000-0000-0000000a8203', 80000, 0, 'office');
-- The office's own note on the walk's ask (what the Ask window writes when no email goes), a call on another, and the
-- invitation emailed on a third.
INSERT INTO public.gc_company_contacts (company_id, invite_id, contacted_on, by_name, how, note) VALUES
  ('00000000-0000-0000-0000-0000000a8101', '00000000-0000-0000-0000-0000000a8201', DATE '2026-11-20', 'Askback Dev', 'note', 'Asked to quote. The invitation was not emailed.'),
  ('00000000-0000-0000-0000-0000000a8107', '00000000-0000-0000-0000-0000000a8207', DATE '2026-11-21', 'Askback Dev', 'call', 'Left a voicemail.');
INSERT INTO public.gc_trade_messages (company_id, project_id, kind, mail_group, msg_key, subject, sent_on) VALUES
  ('00000000-0000-0000-0000-0000000a8106', '00000000-0000-0000-0000-0000000a8a01', 'invite', 'quotes', '00000000-0000-0000-0000-0000000a8206:invite', 'Quote the electrical', DATE '2026-11-20');
-- Concrete's award and its draft, and a statement of work on Framing with no award beside it.
UPDATE public.gc_trade_packages SET awarded_invite_id = '00000000-0000-0000-0000-0000000a8203', awarded_on = DATE '2026-11-21' WHERE id = '00000000-0000-0000-0000-0000000a8b02';
INSERT INTO public.gc_sows (package_id, invite_id, company_id, price) VALUES
  ('00000000-0000-0000-0000-0000000a8b02', '00000000-0000-0000-0000-0000000a8203', '00000000-0000-0000-0000-0000000a8103', 80000),
  ('00000000-0000-0000-0000-0000000a8b03', '00000000-0000-0000-0000-0000000a8208', '00000000-0000-0000-0000-0000000a8108', 40000);

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
-- A statement the database itself refuses, by its SQLSTATE.
CREATE FUNCTION tab.refused_code(label text, stmt text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN
    EXECUTE stmt;
  EXCEPTION WHEN OTHERS THEN
    IF NOT (SQLSTATE = ANY (string_to_array(want, ','))) THEN RAISE EXCEPTION '% was refused as % (%), not %', label, SQLSTATE, SQLERRM, want; END IF;
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
-- The walk's ask taken back by one person, then put back as it was (a subtransaction): did the press go through?
-- Called as postgres.
CREATE FUNCTION tab.goes(label text, p_user uuid) RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  got text;
BEGIN
  BEGIN
    PERFORM tab.as_user(p_user);
    SET LOCAL ROLE authenticated;
    PERFORM public.gc_take_ask_back('00000000-0000-0000-0000-0000000a8201');
    RESET ROLE;
    got := (SELECT count(*)::text FROM public.gc_invites WHERE id = '00000000-0000-0000-0000-0000000a8201');
    RAISE EXCEPTION USING ERRCODE = 'ZZ001', MESSAGE = got;
  EXCEPTION WHEN SQLSTATE 'ZZ001' THEN
    got := SQLERRM;
  END;
  IF got IS DISTINCT FROM '0' THEN RAISE EXCEPTION '% did not take the ask back: %', label, got; END IF;
  RAISE NOTICE 'ok: %', label;
END $$;
GRANT USAGE ON SCHEMA tab TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA tab TO authenticated;

-- 0 · The new table carries the four fences, and no policy lets a signed-in person write it.
SELECT tab.same('the fences on gc_asks_taken_back', (
  SELECT string_agg(policyname || ' ' || cmd || ' ' || permissive, ', ' ORDER BY policyname) FROM pg_policies WHERE schemaname = 'public' AND tablename = 'gc_asks_taken_back')
  || ' + ' || (SELECT count(*) FROM pg_trigger g WHERE g.tgrelid = 'public.gc_asks_taken_back'::regclass AND g.tgname = 'read_only_block_stmt'),
  'archived_fence ALL RESTRICTIVE, digital_twin_write_fence_delete DELETE RESTRICTIVE, digital_twin_write_fence_insert INSERT RESTRICTIVE, digital_twin_write_fence_update UPDATE RESTRICTIVE, gc_asks_taken_back_office_read SELECT PERMISSIVE, read_only_users_cannot_delete DELETE RESTRICTIVE, read_only_users_cannot_insert INSERT RESTRICTIVE, read_only_users_cannot_update UPDATE RESTRICTIVE + 1');

-- 1 · Who may take an ask back: whoever may ask, the office team. Everyone else is refused in words before any write.
SELECT tab.as_nobody();
SET LOCAL ROLE authenticated;
SELECT tab.refused('nobody signed in', $q$SELECT public.gc_take_ask_back('00000000-0000-0000-0000-0000000a8201')$q$, 'Sign in to take an ask back.');
RESET ROLE;
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN SELECT * FROM (VALUES
    ('a superintendent', '00000000-0000-0000-0000-0000000a8d07'::uuid, 'Only the office takes an ask back.'),
    ('a sub', '00000000-0000-0000-0000-0000000a8d08'::uuid, 'Only the office takes an ask back.'),
    ('a training account', '00000000-0000-0000-0000-0000000a8d06'::uuid, 'A training account cannot take an ask back.')) AS t(who, id, want)
  LOOP
    PERFORM tab.as_user(r.id);
    SET LOCAL ROLE authenticated;
    PERFORM tab.refused(r.who, $q$SELECT public.gc_take_ask_back('00000000-0000-0000-0000-0000000a8201')$q$, r.want);
    RESET ROLE;
  END LOOP;
  FOR r IN SELECT * FROM (VALUES
    ('a dev', '00000000-0000-0000-0000-0000000a8d01'::uuid), ('an estimator', '00000000-0000-0000-0000-0000000a8d02'::uuid),
    ('a master', '00000000-0000-0000-0000-0000000a8d03'::uuid), ('an assistant', '00000000-0000-0000-0000-0000000a8d04'::uuid),
    ('a controller', '00000000-0000-0000-0000-0000000a8d05'::uuid)) AS t(who, id)
  LOOP
    PERFORM tab.goes(r.who || ' takes an ask back', r.id);
  END LOOP;
END $$;
SELECT tab.same('every try left the asks as they were', (SELECT count(*)::text FROM public.gc_invites WHERE package_id IN ('00000000-0000-0000-0000-0000000a8b01', '00000000-0000-0000-0000-0000000a8b02', '00000000-0000-0000-0000-0000000a8b03')), '9');

-- 2 · Each refusal, in its words: what stands on the ask, and the company's own answer.
SELECT tab.as_user('00000000-0000-0000-0000-0000000a8d02');
SET LOCAL ROLE authenticated;
SELECT tab.refused('no ask with that id', $q$SELECT public.gc_take_ask_back('00000000-0000-0000-0000-0000000a82ff')$q$, 'That ask is not on a GC trade.');
SELECT tab.refused('the ask the trade is awarded to', $q$SELECT public.gc_take_ask_back('00000000-0000-0000-0000-0000000a8203')$q$,
  'Awarded Concrete stays asked on Concrete, since the trade is awarded to them. Take the award back first, in Compare quotes.');
SELECT tab.refused('an ask a statement of work names', $q$SELECT public.gc_take_ask_back('00000000-0000-0000-0000-0000000a8208')$q$,
  'Signed Framing stays asked on Framing, since a statement of work names this ask.');
SELECT tab.refused('an ask with a quote', $q$SELECT public.gc_take_ask_back('00000000-0000-0000-0000-0000000a8202')$q$,
  'Quoted Electric stays asked on Electrical, since they sent a quote. A quote stays on their record.');
SELECT tab.refused('an ask the company passed on', $q$SELECT public.gc_take_ask_back('00000000-0000-0000-0000-0000000a8204')$q$,
  'Passed Electric stays asked on Electrical, since they already passed on it. Their answer stays on their record.');
-- The ledger is the function's alone: the office reads it and cannot write it.
SELECT tab.refused_code('the office cannot write the ledger by hand', $q$INSERT INTO public.gc_asks_taken_back (package_id, company_name, asked_on)
  VALUES ('00000000-0000-0000-0000-0000000a8b01', 'x', public.app_today())$q$, '42501');
SELECT tab.same('nothing taken back by a refusal', (SELECT (SELECT count(*) FROM public.gc_invites WHERE package_id = '00000000-0000-0000-0000-0000000a8b01') || ' ' || (SELECT count(*) FROM public.gc_asks_taken_back)), '7 0');

-- 3 · The estimator takes the walk's ask back: the ask and the office's note on it go, and the ledger says who asked
-- and when, and who took it back and when.
SELECT public.gc_take_ask_back('00000000-0000-0000-0000-0000000a8201');
SELECT tab.same('the ask and its note are gone', (
  SELECT (SELECT count(*) FROM public.gc_invites WHERE id = '00000000-0000-0000-0000-0000000a8201') || ' '
      || (SELECT count(*) FROM public.gc_company_contacts WHERE company_id = '00000000-0000-0000-0000-0000000a8101')), '0 0');
SELECT tab.same('the ledger holds the take-back, with who and when', (
  SELECT t.package_id || ' ' || t.company_id || ' ' || t.company_name || ' asked ' || t.asked_on || ' by ' || t.asked_by
      || ' back ' || (t.taken_back_on = public.app_today()) || ' by ' || t.taken_back_by || ' ' || t.by_name
  FROM public.gc_asks_taken_back t),
  '00000000-0000-0000-0000-0000000a8b01 00000000-0000-0000-0000-0000000a8101 ZZ Test trade no page, delete me asked 2026-11-20 by 00000000-0000-0000-0000-0000000a8d01 back true by 00000000-0000-0000-0000-0000000a8d02 Askback Estimator');
SELECT tab.refused('an ask taken back twice', $q$SELECT public.gc_take_ask_back('00000000-0000-0000-0000-0000000a8201')$q$, 'That ask is not on a GC trade.');
-- The company can be asked again on the same trade.
SELECT tab.same('asked again', cardinality(public.gc_invite_companies('00000000-0000-0000-0000-0000000a8b01', ARRAY['00000000-0000-0000-0000-0000000a8101'::uuid]))::text, '1');
SELECT public.gc_take_ask_back(i.id) FROM public.gc_invites i WHERE i.package_id = '00000000-0000-0000-0000-0000000a8b01' AND i.company_id = '00000000-0000-0000-0000-0000000a8101';

-- 3b · An ask the company heard about is kept and closed as ours (v2.8490): each way of having heard. Nothing is
-- deleted, the ledger of deleted asks gains no row, and the company's own call log says who took it back and what
-- they had heard.
SELECT public.gc_take_ask_back(t.id) FROM (VALUES
  ('00000000-0000-0000-0000-0000000a8205'::uuid), ('00000000-0000-0000-0000-0000000a8209'::uuid),
  ('00000000-0000-0000-0000-0000000a8206'::uuid), ('00000000-0000-0000-0000-0000000a8207'::uuid)) AS t(id);
SELECT tab.same('each ask they heard about is kept and closed as ours', (
  SELECT string_agg(c.name || ' ' || i.status || ' ' || i.declined_why || ' ' || (i.declined_on = public.app_today()) || ' ' || coalesce(i.decline_reason, 'no reason') || ' [' || i.decline_note || ']', ' | ' ORDER BY c.name)
  FROM public.gc_invites i JOIN public.gc_companies c ON c.id = i.company_id
  WHERE i.id IN ('00000000-0000-0000-0000-0000000a8205', '00000000-0000-0000-0000-0000000a8209', '00000000-0000-0000-0000-0000000a8206', '00000000-0000-0000-0000-0000000a8207')),
  'Called Electric declined withdrawn true no reason [] | Emailed Electric declined withdrawn true no reason [] | Looking Electric declined withdrawn true no reason [] | Seen Electric declined withdrawn true no reason []');
SELECT tab.same('the company''s call log says who took it back and what they had heard', (
  SELECT string_agg(c.name || ': ' || x.by_name || ', ' || x.how || ', ' || (x.contacted_on = public.app_today()) || ', ' || x.note, ' | ' ORDER BY c.name)
  FROM public.gc_company_contacts x JOIN public.gc_companies c ON c.id = x.company_id
  WHERE x.invite_id IS NULL AND x.note LIKE 'Ask taken back%'),
  'Called Electric: Askback Estimator, note, true, Ask taken back on Electrical, Askback test clinic. Asked Nov 20 by Askback Dev. A contact with them was logged on it.'
  || ' | Emailed Electric: Askback Estimator, note, true, Ask taken back on Electrical, Askback test clinic. Asked Nov 20 by Askback Dev. We had emailed them about it.'
  || ' | Looking Electric: Askback Estimator, note, true, Ask taken back on Electrical, Askback test clinic. Asked Nov 20 by Askback Dev. They had opened it in their portal.'
  || ' | Seen Electric: Askback Estimator, note, true, Ask taken back on Electrical, Askback test clinic. Asked Nov 20 by Askback Dev. They had opened it in their portal.');
SELECT tab.same('the call logged on the ask stays, and the ledger of deleted asks gained no row', (
  SELECT (SELECT count(*) FROM public.gc_company_contacts WHERE invite_id = '00000000-0000-0000-0000-0000000a8207') || ' ' || (SELECT count(*) FROM public.gc_asks_taken_back)), '1 2');
SELECT tab.refused('an ask taken back twice says so', $q$SELECT public.gc_take_ask_back('00000000-0000-0000-0000-0000000a8205')$q$,
  'The ask to Looking Electric on Electrical is already taken back.');

-- 4 · The bench's Remove, unchanged: it lets go of the company whose only history was that ask, and still keeps one
-- that was emailed. The ledger keeps the company's name once its row is gone.
SELECT tab.refused('a company we emailed stays on the bench', $q$SELECT public.gc_remove_bench_company('00000000-0000-0000-0000-0000000a8106')$q$,
  'Emailed Electric stays on the bench, since they were asked to quote.');
SELECT public.gc_remove_bench_company('00000000-0000-0000-0000-0000000a8101');
SELECT tab.same('the company left the bench, and the ledger kept its name', (
  SELECT (SELECT count(*) FROM public.gc_companies WHERE id = '00000000-0000-0000-0000-0000000a8101') || ' '
      || (SELECT string_agg(coalesce(t.company_id::text, 'gone') || ' ' || t.company_name, ' | ' ORDER BY t.created_at, t.id) FROM public.gc_asks_taken_back t)),
  '0 gone ZZ Test trade no page, delete me | gone ZZ Test trade no page, delete me');
RESET ROLE;
-- Who reads the ledger: the office team, and nobody else.
SELECT tab.as_user('00000000-0000-0000-0000-0000000a8d07');
SET LOCAL ROLE authenticated;
SELECT tab.same('a superintendent reads no take-back', (SELECT count(*)::text FROM public.gc_asks_taken_back), '0');
RESET ROLE;

-- 5 · The award guard is untouched: a plain write of the three award columns is still refused.
SELECT tab.as_user('00000000-0000-0000-0000-0000000a8d02');
SET LOCAL ROLE authenticated;
SELECT tab.refused('an estimator clears an award by hand', $q$UPDATE public.gc_trade_packages SET awarded_invite_id = NULL, awarded_by = NULL, awarded_on = NULL
  WHERE id = '00000000-0000-0000-0000-0000000a8b02'$q$,
  'A trade''s award changes only through Award and draft the statement of work in Compare quotes.');
RESET ROLE;

-- 6 · The trade's own lock tells the two closes apart (gc_trade_ask, the service role's): our close raises tookBack,
-- the company's pass still raises youPassed. And the ask takes no answer the CHECK does not know.
SELECT tab.refused('the trade writes on an ask we took back', $q$SELECT public.gc_trade_ask('00000000-0000-0000-0000-0000000a8105', '00000000-0000-0000-0000-0000000a8205')$q$, 'tookBack');
SELECT tab.refused('the trade writes on an ask it passed on', $q$SELECT public.gc_trade_ask('00000000-0000-0000-0000-0000000a8104', '00000000-0000-0000-0000-0000000a8204')$q$, 'youPassed');
SELECT tab.refused_code('an answer the ask does not know', $q$UPDATE public.gc_invites SET declined_why = 'gone' WHERE id = '00000000-0000-0000-0000-0000000a8204'$q$, '23514');

DO $$ BEGIN RAISE NOTICE 'gc_take_ask_back PASSED'; END $$;
ROLLBACK;
