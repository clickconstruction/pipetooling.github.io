-- Back-charges and a trade's change requests (P4a, the Portal lane): the office's three verbs as a dev
-- through RLS, the trade's two as the service role, each refusal by its key and words, each CHECK, the
-- client's column grants, and the sweep of an awarded project. The fixture is made as postgres;
-- everything rolls back. Raises on the first failed assertion; ends with "gc_back_charges PASSED".
-- See scripts/pgtest-gc-back-charges.sh. Never against prod.
\set ON_ERROR_STOP 1
BEGIN;

INSERT INTO auth.users (id, email) VALUES ('00000000-0000-0000-0000-000000000bd1', 'dev@backcharge.test'), ('00000000-0000-0000-0000-000000000bd2', 'estimator@backcharge.test');
INSERT INTO public.users (id, email, name, role) VALUES
  ('00000000-0000-0000-0000-000000000bd1', 'dev@backcharge.test', 'Back-charge Dev', 'dev'),
  ('00000000-0000-0000-0000-000000000bd2', 'estimator@backcharge.test', 'Back-charge Estimator', 'estimator')
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name;

-- The clinic, building: Drywall awarded to Iron Horse and signed, Paint awarded to Brushstroke with its
-- statement of work still a draft, and Plumbing, which is ours. A second project, still bidding, with
-- Concrete awarded to Iron Horse and signed.
INSERT INTO public.customers (id, name, master_user_id) VALUES ('00000000-0000-0000-0000-000000000bc1', 'Back-charge Test Owner', '00000000-0000-0000-0000-000000000bd1');
INSERT INTO public.projects (id, name, customer_id) VALUES
  ('00000000-0000-0000-0000-000000000ba1', 'Back-charge test clinic', '00000000-0000-0000-0000-000000000bc1'),
  ('00000000-0000-0000-0000-000000000ba2', 'Back-charge test bid', '00000000-0000-0000-0000-000000000bc1');
INSERT INTO public.gc_projects (project_id, stage) VALUES
  ('00000000-0000-0000-0000-000000000ba1', 'building'),
  ('00000000-0000-0000-0000-000000000ba2', 'bidding');
INSERT INTO public.gc_trade_packages (id, project_id, trade, position, budget, ours) VALUES
  ('00000000-0000-0000-0000-000000000bb1', '00000000-0000-0000-0000-000000000ba1', 'Drywall', 0, 50000, false),
  ('00000000-0000-0000-0000-000000000bb2', '00000000-0000-0000-0000-000000000ba1', 'Paint', 1, 15000, false),
  ('00000000-0000-0000-0000-000000000bb3', '00000000-0000-0000-0000-000000000ba1', 'Plumbing', 2, 30000, true),
  ('00000000-0000-0000-0000-000000000bb4', '00000000-0000-0000-0000-000000000ba2', 'Concrete', 0, 25000, false);
INSERT INTO public.gc_companies (id, name, trades) VALUES
  ('00000000-0000-0000-0000-000000000b11', 'Iron Horse Drywall', '{Drywall,Concrete}'),
  ('00000000-0000-0000-0000-000000000b12', 'Brushstroke Paint', '{Paint}'),
  ('00000000-0000-0000-0000-000000000b13', 'Level Line Drywall', '{Drywall}');
INSERT INTO public.gc_invites (id, package_id, company_id, status) VALUES
  ('00000000-0000-0000-0000-000000000b21', '00000000-0000-0000-0000-000000000bb1', '00000000-0000-0000-0000-000000000b11', 'bid'),
  ('00000000-0000-0000-0000-000000000b22', '00000000-0000-0000-0000-000000000bb2', '00000000-0000-0000-0000-000000000b12', 'bid'),
  ('00000000-0000-0000-0000-000000000b23', '00000000-0000-0000-0000-000000000bb1', '00000000-0000-0000-0000-000000000b13', 'bid'),
  ('00000000-0000-0000-0000-000000000b24', '00000000-0000-0000-0000-000000000bb4', '00000000-0000-0000-0000-000000000b11', 'bid');
-- The awards and their statements of work, as gc_award writes them together.
UPDATE public.gc_trade_packages SET awarded_invite_id = '00000000-0000-0000-0000-000000000b21', awarded_on = DATE '2026-10-01' WHERE id = '00000000-0000-0000-0000-000000000bb1';
UPDATE public.gc_trade_packages SET awarded_invite_id = '00000000-0000-0000-0000-000000000b22', awarded_on = DATE '2026-10-01' WHERE id = '00000000-0000-0000-0000-000000000bb2';
UPDATE public.gc_trade_packages SET awarded_invite_id = '00000000-0000-0000-0000-000000000b24', awarded_on = DATE '2026-10-01' WHERE id = '00000000-0000-0000-0000-000000000bb4';
INSERT INTO public.gc_sows (id, package_id, invite_id, company_id, status, price, sent_on, signed_on) VALUES
  ('00000000-0000-0000-0000-000000000b31', '00000000-0000-0000-0000-000000000bb1', '00000000-0000-0000-0000-000000000b21', '00000000-0000-0000-0000-000000000b11', 'signed', 48000, DATE '2026-10-01', DATE '2026-10-02'),
  ('00000000-0000-0000-0000-000000000b32', '00000000-0000-0000-0000-000000000bb2', '00000000-0000-0000-0000-000000000b22', '00000000-0000-0000-0000-000000000b12', 'draft', 12000, NULL, NULL),
  ('00000000-0000-0000-0000-000000000b34', '00000000-0000-0000-0000-000000000bb4', '00000000-0000-0000-0000-000000000b24', '00000000-0000-0000-0000-000000000b11', 'signed', 20000, DATE '2026-10-01', DATE '2026-10-02');

CREATE SCHEMA gbc;
CREATE FUNCTION gbc.same(label text, got text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF got IS DISTINCT FROM want THEN RAISE EXCEPTION E'% differs.\n--- got ---\n%\n--- want ---\n%', label, got, want; END IF;
  RAISE NOTICE 'ok: %', label;
END $$;
-- A verb's refusal: P0001 with the key as its message and the words as its DETAIL (decision 11). Its
-- writes go with the refusal (a subtransaction).
CREATE FUNCTION gbc.refused(label text, stmt text, want_key text, want_words text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  v_state text;
  v_words text;
BEGIN
  BEGIN
    EXECUTE stmt;
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_state = RETURNED_SQLSTATE, v_words = PG_EXCEPTION_DETAIL;
    IF v_state IS DISTINCT FROM 'P0001' OR SQLERRM IS DISTINCT FROM want_key OR v_words IS DISTINCT FROM want_words THEN
      RAISE EXCEPTION E'% was refused another way.\n--- got ---\n% % / %\n--- want ---\nP0001 % / %', label, v_state, SQLERRM, v_words, want_key, want_words;
    END IF;
    RAISE NOTICE 'ok: %', label;
    RETURN;
  END;
  RAISE EXCEPTION '% was allowed', label;
END $$;
-- A statement the database itself refuses, by its SQLSTATE. `want` may list more than one, comma
-- separated, when two rules can each refuse it first.
CREATE FUNCTION gbc.refused_code(label text, stmt text, want text) RETURNS void LANGUAGE plpgsql AS $$
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
CREATE FUNCTION gbc.as_user(p_user uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', p_user::text, true);
END $$;
-- The submit function's call: the service role's key, no user.
CREATE FUNCTION gbc.as_service() RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, true);
  PERFORM set_config('request.jwt.claim.sub', '', true);
END $$;
-- Ids made inside the scenario, kept by name for the steps after.
CREATE FUNCTION gbc.id(p_name text) RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT current_setting('gbc.' || p_name)::uuid $$;
GRANT USAGE ON SCHEMA gbc TO anon, authenticated, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA gbc TO anon, authenticated, service_role;

-- 0 · Who may call what. The office's three are for whoever the tables' policy lets in; the trade's two
-- are the service role's alone.
SELECT gbc.same('the office verbs are open to signed-in users, not to anon', (
  SELECT string_agg(has_function_privilege('authenticated', f, 'EXECUTE')::text || '/' || has_function_privilege('anon', f, 'EXECUTE')::text, ' ' ORDER BY f)
  FROM unnest(ARRAY['public.gc_back_charge(uuid, numeric, text, text)', 'public.gc_keep_back_charge(uuid, text)', 'public.gc_drop_back_charge(uuid, text)']) f),
  'true/false true/false true/false');
SELECT gbc.same('the trade verbs are the service role''s alone', (
  SELECT string_agg(has_function_privilege('service_role', f, 'EXECUTE')::text || '/' || has_function_privilege('authenticated', f, 'EXECUTE')::text || '/' || has_function_privilege('anon', f, 'EXECUTE')::text, ' ' ORDER BY f)
  FROM unnest(ARRAY['public.gc_trade_answer_back_charge(uuid, uuid, boolean, text)', 'public.gc_trade_ask_change(uuid, uuid, text, text, numeric, integer)']) f),
  'true/false/false true/false/false');
SELECT gbc.same('anon reads neither table', (
  SELECT has_table_privilege('anon', 'public.gc_back_charges', 'SELECT')::text || ' ' || has_table_privilege('anon', 'public.gc_trade_change_requests', 'SELECT')::text), 'false false');
SELECT gbc.same('the client writes a charge''s typed columns and its settled columns only', (
  SELECT string_agg(c || ':' || has_column_privilege('authenticated', 'public.gc_back_charges', c, 'INSERT')::text || '/' || has_column_privilege('authenticated', 'public.gc_back_charges', c, 'UPDATE')::text, ' ' ORDER BY c)
  FROM unnest(ARRAY['amount', 'answered_on', 'reason', 'settled_note', 'status', 'taken_on']) c),
  'amount:true/false answered_on:false/false reason:true/false settled_note:false/true status:false/true taken_on:false/false');
SELECT gbc.same('the client answers a request in its two answers only, and never makes one', (
  SELECT string_agg(c || ':' || has_column_privilege('authenticated', 'public.gc_trade_change_requests', c, 'INSERT')::text || '/' || has_column_privilege('authenticated', 'public.gc_trade_change_requests', c, 'UPDATE')::text, ' ' ORDER BY c)
  FROM unnest(ARRAY['amount', 'change_order_id', 'description', 'turned_down_note', 'turned_down_on']) c),
  'amount:false/false change_order_id:false/true description:false/false turned_down_note:false/true turned_down_on:false/true');
SELECT gbc.same('neither table can be deleted from or emptied by the client', (
  SELECT string_agg(has_table_privilege('authenticated', t, 'DELETE')::text || '/' || has_table_privilege('authenticated', t, 'TRUNCATE')::text, ' ' ORDER BY t)
  FROM unnest(ARRAY['public.gc_back_charges', 'public.gc_trade_change_requests']) t), 'false/false false/false');
SELECT gbc.same('training mode and the twin fence cover both tables', (
  SELECT string_agg(t || ':' || (SELECT count(*) FROM pg_policies p WHERE p.schemaname = 'public' AND p.tablename = t
      AND p.policyname IN ('read_only_users_cannot_insert', 'read_only_users_cannot_update', 'read_only_users_cannot_delete',
                           'digital_twin_write_fence_insert', 'digital_twin_write_fence_update', 'digital_twin_write_fence_delete'))
    || '+' || (SELECT count(*) FROM pg_trigger g WHERE g.tgrelid = ('public.' || t)::regclass AND g.tgname = 'read_only_block_stmt'), ' ' ORDER BY t)
  FROM unnest(ARRAY['gc_back_charges', 'gc_trade_change_requests']) t), 'gc_back_charges:6+1 gc_trade_change_requests:6+1');

-- 1 · An estimator reads the trades since door 2, so the office's three refuse anyone but a dev first, in
-- words, before any other check or write, as gc_award does.
SELECT gbc.as_user('00000000-0000-0000-0000-000000000bd2');
SET LOCAL ROLE authenticated;
SELECT gbc.refused('an estimator cannot charge a trade while GC mode is built', $q$SELECT public.gc_back_charge('00000000-0000-0000-0000-000000000bb1', 100, 'Cleanup')$q$,
  'devOnly', 'Only a dev charges a trade while GC mode is built.');
SELECT gbc.refused('an estimator cannot keep a charge', $q$SELECT public.gc_keep_back_charge('00000000-0000-0000-0000-000000000999', 'x')$q$,
  'devOnly', 'Only a dev keeps a charge while GC mode is built.');
SELECT gbc.refused('an estimator cannot drop a charge', $q$SELECT public.gc_drop_back_charge('00000000-0000-0000-0000-000000000999', 'x')$q$,
  'devOnly', 'Only a dev drops a charge while GC mode is built.');
RESET ROLE;

-- 2 · The office charges a trade, as a dev.
SELECT gbc.as_user('00000000-0000-0000-0000-000000000bd1');
SET LOCAL ROLE authenticated;
SELECT gbc.refused('a trade that is not there', $q$SELECT public.gc_back_charge('00000000-0000-0000-0000-000000000999', 100, 'Cleanup')$q$, 'notFound', 'No trade with that id.');
SELECT gbc.refused('work not signed yet', $q$SELECT public.gc_back_charge('00000000-0000-0000-0000-000000000bb2', 100, 'Cleanup')$q$,
  'sowNotSigned', 'A charge goes on signed work. This trade''s statement of work is not signed.');
SELECT gbc.refused('our own trade, with no statement of work', $q$SELECT public.gc_back_charge('00000000-0000-0000-0000-000000000bb3', 100, 'Cleanup')$q$,
  'sowNotSigned', 'A charge goes on signed work. This trade''s statement of work is not signed.');
SELECT gbc.refused('an amount of zero', $q$SELECT public.gc_back_charge('00000000-0000-0000-0000-000000000bb1', 0, 'Cleanup')$q$, 'amountNeeded', 'Type the charge''s amount.');
SELECT gbc.refused('no amount', $q$SELECT public.gc_back_charge('00000000-0000-0000-0000-000000000bb1', NULL, 'Cleanup')$q$, 'amountNeeded', 'Type the charge''s amount.');
SELECT gbc.refused('a blank reason', $q$SELECT public.gc_back_charge('00000000-0000-0000-0000-000000000bb1', 100, '   ')$q$, 'descriptionNeeded', 'Say what the charge is for.');
SELECT gbc.refused('a reason past 2,000 characters', $q$SELECT public.gc_back_charge('00000000-0000-0000-0000-000000000bb1', 100, repeat('x', 2001))$q$, 'tooLong', 'Keep the reason under 2,000 characters.');

-- Iron Horse's $1,250 for cleanup, with a photo; three more for the steps below.
SELECT set_config('gbc.c1', public.gc_back_charge('00000000-0000-0000-0000-000000000bb1', 1250, '  Cleanup after drywall: mud and scraps left in units 4 and 5.  ', ' https://drive.google.com/file/d/test-photo ')::text, true);
SELECT set_config('gbc.c2', public.gc_back_charge('00000000-0000-0000-0000-000000000bb1', 300, 'Patch the hallway wall we had to redo.', '')::text, true);
SELECT set_config('gbc.c3', public.gc_back_charge('00000000-0000-0000-0000-000000000bb1', 500.50, 'Haul-off of their dumpster overflow.')::text, true);
SELECT set_config('gbc.c4', public.gc_back_charge('00000000-0000-0000-0000-000000000bb1', 200, 'Damaged door frame at unit 2.')::text, true);
SELECT set_config('gbc.c5', public.gc_back_charge('00000000-0000-0000-0000-000000000bb1', 150, 'Lost key to the site box.')::text, true);
SELECT gbc.same('the charge, on the work Iron Horse signed for', (
  SELECT project_id || ' ' || package_id || ' ' || company_id || ' ' || sow_id || ' ' || amount || ' ' || status || ' ' || (sent_on = public.app_today()) || ' '
      || (answer_by = public.app_today() + 5) || ' ' || coalesce(photo_url, 'none') || ' ' || created_by || ' [' || reason || ']'
  FROM public.gc_back_charges WHERE id = gbc.id('c1')),
  '00000000-0000-0000-0000-000000000ba1 00000000-0000-0000-0000-000000000bb1 00000000-0000-0000-0000-000000000b11 00000000-0000-0000-0000-000000000b31 1250 open true true https://drive.google.com/file/d/test-photo 00000000-0000-0000-0000-000000000bd1 [Cleanup after drywall: mud and scraps left in units 4 and 5.]');
SELECT gbc.same('an empty photo link is none', (SELECT coalesce(photo_url, 'none') FROM public.gc_back_charges WHERE id = gbc.id('c2')), 'none');
SELECT gbc.same('cents are kept', (SELECT amount::text FROM public.gc_back_charges WHERE id = gbc.id('c3')), '500.50');

-- The client writes only through the verbs.
SELECT gbc.refused_code('the client cannot write the company''s answer', $q$UPDATE public.gc_back_charges SET answered_on = public.app_today() WHERE id = gbc.id('c1')$q$, '42501');
SELECT gbc.refused_code('the client cannot delete a charge', $q$DELETE FROM public.gc_back_charges WHERE id = gbc.id('c1')$q$, '42501');
SELECT gbc.refused_code('the client cannot make a charge that is kept already', $q$INSERT INTO public.gc_back_charges (project_id, package_id, company_id, sow_id, amount, reason, sent_on, status)
  VALUES ('00000000-0000-0000-0000-000000000ba1', '00000000-0000-0000-0000-000000000bb1', '00000000-0000-0000-0000-000000000b11', '00000000-0000-0000-0000-000000000b31', 10, 'x', public.app_today(), 'kept')$q$, '42501');
SELECT gbc.refused('an open charge before its answer day is not kept', format($q$SELECT public.gc_keep_back_charge(%L, 'It stands.')$q$, gbc.id('c1')),
  'stillOpen', format('The company has until %s to answer it.', to_char(public.app_today() + 5, 'Mon FMDD')));
RESET ROLE;

-- Two charges sent a week ago, so their answer day went by: c3 never answered, c5 answered late.
UPDATE public.gc_back_charges SET sent_on = public.app_today() - 7 WHERE id IN (gbc.id('c3'), gbc.id('c5'));
SELECT gbc.same('the answer day follows the day it was sent', (SELECT (answer_by = public.app_today() - 2)::text FROM public.gc_back_charges WHERE id = gbc.id('c3')), 'true');

-- 3 · The company answers from its portal, through the submit function.
SELECT gbc.as_service();
SET LOCAL ROLE service_role;
SELECT gbc.refused('another company''s charge', format($q$SELECT public.gc_trade_answer_back_charge('00000000-0000-0000-0000-000000000b13', %L, true, '')$q$, gbc.id('c1')),
  'notYours', 'That charge is another company''s.');
SELECT gbc.refused('a charge that is not there', $q$SELECT public.gc_trade_answer_back_charge('00000000-0000-0000-0000-000000000b11', '00000000-0000-0000-0000-000000000999', true, '')$q$,
  'notFound', 'No charge with that id.');
SELECT gbc.refused('neither agree nor dispute', format($q$SELECT public.gc_trade_answer_back_charge('00000000-0000-0000-0000-000000000b11', %L, NULL, 'x')$q$, gbc.id('c1')),
  'badRequest', 'Say whether the company agrees.');
SELECT gbc.refused('a dispute with no reason', format($q$SELECT public.gc_trade_answer_back_charge('00000000-0000-0000-0000-000000000b11', %L, false, '  ')$q$, gbc.id('c1')),
  'noteNeeded', 'Say why the company disputes it.');
SELECT gbc.refused('a note past 2,000 characters', format($q$SELECT public.gc_trade_answer_back_charge('00000000-0000-0000-0000-000000000b11', %L, false, repeat('x', 2001))$q$, gbc.id('c1')),
  'tooLong', 'Keep the note under 2,000 characters.');
SELECT public.gc_trade_answer_back_charge('00000000-0000-0000-0000-000000000b11', gbc.id('c1'), false, ' We cleaned up before we left. Photos sent Tuesday. ');
SELECT public.gc_trade_answer_back_charge('00000000-0000-0000-0000-000000000b11', gbc.id('c2'), true, NULL);
SELECT public.gc_trade_answer_back_charge('00000000-0000-0000-0000-000000000b11', gbc.id('c5'), true, 'Sorry, found it late.');
SELECT gbc.same('a dispute keeps its day and its reason', (
  SELECT status || ' ' || (answered_on = public.app_today()) || ' [' || answer_note || ']' FROM public.gc_back_charges WHERE id = gbc.id('c1')),
  'disputed true [We cleaned up before we left. Photos sent Tuesday.]');
SELECT gbc.same('an agreement needs no note', (SELECT status || ' [' || answer_note || ']' FROM public.gc_back_charges WHERE id = gbc.id('c2')), 'agreed []');
SELECT gbc.same('an open charge can be answered after its answer day', (SELECT status FROM public.gc_back_charges WHERE id = gbc.id('c5')), 'agreed');
SELECT gbc.refused('a charge answered twice', format($q$SELECT public.gc_trade_answer_back_charge('00000000-0000-0000-0000-000000000b11', %L, true, '')$q$, gbc.id('c1')),
  'alreadyAnswered', 'That charge has its answer already.');
RESET ROLE;

SELECT gbc.as_user('00000000-0000-0000-0000-000000000bd1');
SET LOCAL ROLE authenticated;
SELECT gbc.refused_code('a signed-in user cannot answer for the trade', format($q$SELECT public.gc_trade_answer_back_charge('00000000-0000-0000-0000-000000000b11', %L, true, '')$q$, gbc.id('c4')), '42501');
RESET ROLE;
SET LOCAL ROLE anon;
SELECT gbc.refused_code('anon cannot answer for the trade', format($q$SELECT public.gc_trade_answer_back_charge('00000000-0000-0000-0000-000000000b11', %L, true, '')$q$, gbc.id('c4')), '42501');
RESET ROLE;

-- 4 · The office keeps or drops a charge, as a dev.
SELECT gbc.as_user('00000000-0000-0000-0000-000000000bd1');
SET LOCAL ROLE authenticated;
SELECT gbc.refused('a keep with no note', format($q$SELECT public.gc_keep_back_charge(%L, ' ')$q$, gbc.id('c1')), 'noteNeeded', 'Say why the charge stands.');
SELECT public.gc_keep_back_charge(gbc.id('c1'), ' Our photos show the mud in units 4 and 5. ');
SELECT gbc.same('kept after the dispute, with the day, the note and who', (
  SELECT status || ' ' || (settled_on = public.app_today()) || ' ' || settled_by || ' [' || settled_note || '] [' || answer_note || ']' FROM public.gc_back_charges WHERE id = gbc.id('c1')),
  'kept true 00000000-0000-0000-0000-000000000bd1 [Our photos show the mud in units 4 and 5.] [We cleaned up before we left. Photos sent Tuesday.]');
SELECT gbc.refused('a charge kept twice', format($q$SELECT public.gc_keep_back_charge(%L, 'Again.')$q$, gbc.id('c1')), 'alreadyAnswered', 'That charge is kept already.');
SELECT gbc.refused('a drop with no note', format($q$SELECT public.gc_drop_back_charge(%L, '')$q$, gbc.id('c1')), 'noteNeeded', 'Say why the charge is dropped.');
SELECT public.gc_drop_back_charge(gbc.id('c1'), 'Settled on the phone: they clean unit 5 again.');
SELECT gbc.same('a kept charge can still be dropped', (SELECT status || ' [' || settled_note || ']' FROM public.gc_back_charges WHERE id = gbc.id('c1')),
  'dropped [Settled on the phone: they clean unit 5 again.]');
SELECT gbc.refused('a charge dropped twice', format($q$SELECT public.gc_drop_back_charge(%L, 'Again.')$q$, gbc.id('c1')), 'alreadyAnswered', 'That charge is dropped already.');
SELECT gbc.refused('an agreed charge is not kept', format($q$SELECT public.gc_keep_back_charge(%L, 'It stands.')$q$, gbc.id('c2')), 'alreadyAnswered', 'The company agreed to that charge already.');
SELECT public.gc_drop_back_charge(gbc.id('c2'), 'We fixed the wall ourselves in the end.');
SELECT gbc.same('an agreed charge can be dropped', (SELECT status FROM public.gc_back_charges WHERE id = gbc.id('c2')), 'dropped');
SELECT public.gc_keep_back_charge(gbc.id('c3'), 'No answer came by its day.');
SELECT gbc.same('kept when no answer came by its day', (SELECT status || ' ' || (answered_on IS NULL) FROM public.gc_back_charges WHERE id = gbc.id('c3')), 'kept true');
SELECT gbc.refused('keeping a charge that is not there', $q$SELECT public.gc_keep_back_charge('00000000-0000-0000-0000-000000000999', 'x')$q$, 'notFound', 'No charge with that id.');
SELECT gbc.refused('dropping a charge that is not there', $q$SELECT public.gc_drop_back_charge('00000000-0000-0000-0000-000000000999', 'x')$q$, 'notFound', 'No charge with that id.');
RESET ROLE;

-- A charge taken off a draw (U6 writes these two): no keep, no drop and no answer after it.
UPDATE public.gc_back_charges SET taken_draw_id = '00000000-0000-0000-0000-000000000d01', taken_on = public.app_today() WHERE id = gbc.id('c4');
SELECT gbc.as_user('00000000-0000-0000-0000-000000000bd1');
SET LOCAL ROLE authenticated;
SELECT gbc.refused('a taken charge is not kept', format($q$SELECT public.gc_keep_back_charge(%L, 'x')$q$, gbc.id('c4')), 'alreadyAnswered', 'That charge came off a draw already.');
SELECT gbc.refused('a taken charge is not dropped', format($q$SELECT public.gc_drop_back_charge(%L, 'x')$q$, gbc.id('c4')), 'alreadyAnswered', 'That charge came off a draw already.');
RESET ROLE;
SELECT gbc.as_service();
SET LOCAL ROLE service_role;
SELECT gbc.refused('a taken charge is not answered', format($q$SELECT public.gc_trade_answer_back_charge('00000000-0000-0000-0000-000000000b11', %L, true, '')$q$, gbc.id('c4')),
  'alreadyAnswered', 'That charge has its answer already.');
RESET ROLE;

-- 5 · The table holds its own rules, whoever writes.
SELECT gbc.refused_code('a charge of zero', $q$INSERT INTO public.gc_back_charges (project_id, package_id, company_id, sow_id, amount, reason, sent_on)
  VALUES ('00000000-0000-0000-0000-000000000ba1', '00000000-0000-0000-0000-000000000bb1', '00000000-0000-0000-0000-000000000b11', '00000000-0000-0000-0000-000000000b31', 0, 'x', public.app_today())$q$, '23514');
SELECT gbc.refused_code('a charge with no reason', $q$INSERT INTO public.gc_back_charges (project_id, package_id, company_id, sow_id, amount, reason, sent_on)
  VALUES ('00000000-0000-0000-0000-000000000ba1', '00000000-0000-0000-0000-000000000bb1', '00000000-0000-0000-0000-000000000b11', '00000000-0000-0000-0000-000000000b31', 10, ' ', public.app_today())$q$, '23514');
SELECT gbc.refused_code('a status the kernels do not know', format($q$UPDATE public.gc_back_charges SET status = 'waived' WHERE id = %L$q$, gbc.id('c5')), '23514');
SELECT gbc.refused_code('an answer needs its day', format($q$UPDATE public.gc_back_charges SET answered_on = NULL WHERE id = %L$q$, gbc.id('c5')), '23514');
SELECT gbc.refused_code('a dispute needs its reason', format($q$UPDATE public.gc_back_charges SET status = 'disputed', answer_note = '' WHERE id = %L$q$, gbc.id('c5')), '23514');
SELECT gbc.refused_code('a kept charge needs its note', format($q$UPDATE public.gc_back_charges SET settled_note = ' ' WHERE id = %L$q$, gbc.id('c3')), '23514');
SELECT gbc.refused_code('a dropped charge needs its day', format($q$UPDATE public.gc_back_charges SET settled_on = NULL WHERE id = %L$q$, gbc.id('c2')), '23514');
SELECT gbc.refused_code('a taken charge needs its day', format($q$UPDATE public.gc_back_charges SET taken_on = NULL WHERE id = %L$q$, gbc.id('c4')), '23514');
SELECT gbc.refused_code('the answer day is never written', format($q$UPDATE public.gc_back_charges SET answer_by = public.app_today() + 30 WHERE id = %L$q$, gbc.id('c5')), '428C9');
SELECT gbc.refused_code('a statement of work with charges on it stays', $q$DELETE FROM public.gc_sows WHERE id = '00000000-0000-0000-0000-000000000b31'$q$, '23503');

-- 6 · The company asks for a change from its portal.
SELECT gbc.as_service();
SET LOCAL ROLE service_role;
SELECT gbc.refused('a company not awarded the trade', $q$SELECT public.gc_trade_ask_change('00000000-0000-0000-0000-000000000b13', '00000000-0000-0000-0000-000000000bb1', 'Hidden rot', 'field', 100, 0)$q$,
  'notAwarded', 'A change is asked on work the company signed for, on a job that is ours.');
SELECT gbc.refused('work not signed yet', $q$SELECT public.gc_trade_ask_change('00000000-0000-0000-0000-000000000b12', '00000000-0000-0000-0000-000000000bb2', 'More coats', 'owner', 100, 0)$q$,
  'notAwarded', 'A change is asked on work the company signed for, on a job that is ours.');
SELECT gbc.refused('our own trade', $q$SELECT public.gc_trade_ask_change('00000000-0000-0000-0000-000000000b11', '00000000-0000-0000-0000-000000000bb3', 'Reroute', 'field', 100, 0)$q$,
  'notAwarded', 'A change is asked on work the company signed for, on a job that is ours.');
SELECT gbc.refused('a job still bidding', $q$SELECT public.gc_trade_ask_change('00000000-0000-0000-0000-000000000b11', '00000000-0000-0000-0000-000000000bb4', 'Deeper footings', 'plans', 100, 0)$q$,
  'notAwarded', 'A change is asked on work the company signed for, on a job that is ours.');
SELECT gbc.refused('a trade that is not there', $q$SELECT public.gc_trade_ask_change('00000000-0000-0000-0000-000000000b11', '00000000-0000-0000-0000-000000000999', 'x', 'field', 100, 0)$q$,
  'notFound', 'No trade with that id.');
SELECT gbc.refused('no words', $q$SELECT public.gc_trade_ask_change('00000000-0000-0000-0000-000000000b11', '00000000-0000-0000-0000-000000000bb1', '  ', 'field', 100, 0)$q$,
  'descriptionNeeded', 'Say what changed.');
SELECT gbc.refused('words past 2,000 characters', $q$SELECT public.gc_trade_ask_change('00000000-0000-0000-0000-000000000b11', '00000000-0000-0000-0000-000000000bb1', repeat('x', 2001), 'field', 100, 0)$q$,
  'tooLong', 'Keep it under 2,000 characters.');
SELECT gbc.refused('a fourth reason', $q$SELECT public.gc_trade_ask_change('00000000-0000-0000-0000-000000000b11', '00000000-0000-0000-0000-000000000bb1', 'Rain', 'weather', 100, 0)$q$,
  'badRequest', 'The reason is the customer, the field or the plans.');
SELECT gbc.refused('an amount of zero', $q$SELECT public.gc_trade_ask_change('00000000-0000-0000-0000-000000000b11', '00000000-0000-0000-0000-000000000bb1', 'Hidden rot', 'field', 0, 0)$q$,
  'amountNeeded', 'Type what the company asks for the work.');
SELECT gbc.refused('days below zero', $q$SELECT public.gc_trade_ask_change('00000000-0000-0000-0000-000000000b11', '00000000-0000-0000-0000-000000000bb1', 'Hidden rot', 'field', 100, -1)$q$,
  'badRequest', 'The working days it adds are 0 or more.');
SELECT gbc.refused('no days', $q$SELECT public.gc_trade_ask_change('00000000-0000-0000-0000-000000000b11', '00000000-0000-0000-0000-000000000bb1', 'Hidden rot', 'field', 100, NULL)$q$,
  'badRequest', 'The working days it adds are 0 or more.');
SELECT set_config('gbc.r1', public.gc_trade_ask_change('00000000-0000-0000-0000-000000000b11', '00000000-0000-0000-0000-000000000bb1',
  ' Hidden rot behind the east wall of unit 3. Two sheets and blocking to replace. ', 'field', 14820, 2)::text, true);
SELECT set_config('gbc.r2', public.gc_trade_ask_change('00000000-0000-0000-0000-000000000b11', '00000000-0000-0000-0000-000000000bb1',
  'The customer asked for a level 5 finish in the lobby.', 'owner', 3200, 0)::text, true);
SELECT gbc.same('the request, on the work Iron Horse signed for', (
  SELECT project_id || ' ' || package_id || ' ' || company_id || ' ' || sow_id || ' ' || (asked_on = public.app_today()) || ' ' || reason || ' ' || amount || ' ' || days
      || ' ' || coalesce(file_url, 'none') || ' ' || coalesce(change_order_id::text, 'none') || ' [' || description || ']'
  FROM public.gc_trade_change_requests WHERE id = gbc.id('r1')),
  '00000000-0000-0000-0000-000000000ba1 00000000-0000-0000-0000-000000000bb1 00000000-0000-0000-0000-000000000b11 00000000-0000-0000-0000-000000000b31 true field 14820 2 none none [Hidden rot behind the east wall of unit 3. Two sheets and blocking to replace.]');
RESET ROLE;

SELECT gbc.as_user('00000000-0000-0000-0000-000000000bd1');
SET LOCAL ROLE authenticated;
SELECT gbc.refused_code('a signed-in user cannot ask for the trade', $q$SELECT public.gc_trade_ask_change('00000000-0000-0000-0000-000000000b11', '00000000-0000-0000-0000-000000000bb1', 'x', 'field', 100, 0)$q$, '42501');
SELECT gbc.refused_code('the client never makes a request', $q$INSERT INTO public.gc_trade_change_requests (project_id, package_id, company_id, sow_id, asked_on, description, reason, amount)
  VALUES ('00000000-0000-0000-0000-000000000ba1', '00000000-0000-0000-0000-000000000bb1', '00000000-0000-0000-0000-000000000b11', '00000000-0000-0000-0000-000000000b31', public.app_today(), 'x', 'field', 1)$q$, '42501');
SELECT gbc.refused_code('the client never rewrites the trade''s words', format($q$UPDATE public.gc_trade_change_requests SET description = 'Cheaper' WHERE id = %L$q$, gbc.id('r1')), '42501');
SELECT gbc.refused_code('the client never deletes a request', format($q$DELETE FROM public.gc_trade_change_requests WHERE id = %L$q$, gbc.id('r1')), '42501');
-- Owner Billing's turn-down writes its two columns under the policy (gc_turn_down_change_request, O3b).
UPDATE public.gc_trade_change_requests SET turned_down_on = public.app_today(), turned_down_note = 'The lobby finish was in the bid: sheet A-201.' WHERE id = gbc.id('r2');
SELECT gbc.same('a dev turns a request down in its two columns', (
  SELECT (turned_down_on = public.app_today()) || ' [' || turned_down_note || ']' FROM public.gc_trade_change_requests WHERE id = gbc.id('r2')),
  'true [The lobby finish was in the bid: sheet A-201.]');
RESET ROLE;

-- An estimator sees neither record while they are dev only.
SELECT gbc.as_user('00000000-0000-0000-0000-000000000bd2');
SET LOCAL ROLE authenticated;
SELECT gbc.refused('an estimator cannot keep a charge that is there', format($q$SELECT public.gc_keep_back_charge(%L, 'x')$q$, gbc.id('c5')),
  'devOnly', 'Only a dev keeps a charge while GC mode is built.');
SELECT gbc.same('an estimator reads no charge and no request', (
  SELECT (SELECT count(*) FROM public.gc_back_charges) || ' ' || (SELECT count(*) FROM public.gc_trade_change_requests)), '0 0');
UPDATE public.gc_trade_change_requests SET turned_down_on = public.app_today(), turned_down_note = 'No.' WHERE id = gbc.id('r1');
RESET ROLE;
SELECT gbc.same('an estimator''s turn-down reaches no row', (SELECT coalesce(turned_down_note, 'none') FROM public.gc_trade_change_requests WHERE id = gbc.id('r1')), 'none');

-- 7 · A request's rules, whoever writes. A draft change order made of r1, then deleted, frees it.
INSERT INTO public.gc_change_orders (id, project_id, number, description, reason, package_id, cost, price)
VALUES ('00000000-0000-0000-0000-000000000c01', '00000000-0000-0000-0000-000000000ba1', 1, 'Rot repair, unit 3', 'field', '00000000-0000-0000-0000-000000000bb1', 14820, 16302);
UPDATE public.gc_trade_change_requests SET change_order_id = '00000000-0000-0000-0000-000000000c01' WHERE id = gbc.id('r1');
SELECT gbc.refused_code('a request is never both drafted and turned down', format($q$UPDATE public.gc_trade_change_requests SET change_order_id = '00000000-0000-0000-0000-000000000c01' WHERE id = %L$q$, gbc.id('r2')), '23514');
SELECT gbc.refused_code('a turn-down needs its reason', format($q$UPDATE public.gc_trade_change_requests SET turned_down_note = '  ' WHERE id = %L$q$, gbc.id('r2')), '23514');
SELECT gbc.refused_code('a turn-down needs its day', format($q$UPDATE public.gc_trade_change_requests SET turned_down_on = NULL WHERE id = %L$q$, gbc.id('r2')), '23514');
SELECT gbc.refused_code('a request asks for something', format($q$UPDATE public.gc_trade_change_requests SET amount = 0 WHERE id = %L$q$, gbc.id('r1')), '23514');
SELECT gbc.refused_code('a request''s days are never below zero', format($q$UPDATE public.gc_trade_change_requests SET days = -1 WHERE id = %L$q$, gbc.id('r1')), '23514');
SELECT gbc.refused_code('a request''s reason is one of three', format($q$UPDATE public.gc_trade_change_requests SET reason = 'weather' WHERE id = %L$q$, gbc.id('r1')), '23514');
DELETE FROM public.gc_change_orders WHERE id = '00000000-0000-0000-0000-000000000c01';
SELECT gbc.same('deleting the draft frees the request to be drafted again', (SELECT coalesce(change_order_id::text, 'none') FROM public.gc_trade_change_requests WHERE id = gbc.id('r1')), 'none');
SELECT gbc.refused_code('a company with charges on record stays', $q$DELETE FROM public.gc_companies WHERE id = '00000000-0000-0000-0000-000000000b11'$q$, '23503');

-- 8 · A trade's own delete takes its charge, its award and its statement of work in one statement. Then
-- the sweep of the test rows (call 4) deletes an awarded project the same way: its charges and requests
-- go with its trades and its statements of work, and no key refuses it.
SELECT gbc.as_user('00000000-0000-0000-0000-000000000bd1');
SET LOCAL ROLE authenticated;
SELECT set_config('gbc.c6', public.gc_back_charge('00000000-0000-0000-0000-000000000bb4', 75, 'Washout left on the slab.')::text, true);
RESET ROLE;
DELETE FROM public.gc_trade_packages WHERE id = '00000000-0000-0000-0000-000000000bb4';
SELECT gbc.same('a trade with a charge on it deletes whole', (
  SELECT (SELECT count(*) FROM public.gc_back_charges WHERE id = gbc.id('c6')) || ' ' || (SELECT count(*) FROM public.gc_sows WHERE id = '00000000-0000-0000-0000-000000000b34')
      || ' ' || (SELECT count(*) FROM public.gc_invites WHERE id = '00000000-0000-0000-0000-000000000b24')), '0 0 0');
DELETE FROM public.projects WHERE id = '00000000-0000-0000-0000-000000000ba1';
SELECT gbc.same('a project with charges and requests deletes whole', (
  SELECT (SELECT count(*) FROM public.gc_back_charges) || ' ' || (SELECT count(*) FROM public.gc_trade_change_requests) || ' '
      || (SELECT count(*) FROM public.gc_sows WHERE id IN ('00000000-0000-0000-0000-000000000b31', '00000000-0000-0000-0000-000000000b32'))), '0 0 0');

DO $$ BEGIN RAISE NOTICE 'gc_back_charges PASSED'; END $$;
ROLLBACK;
