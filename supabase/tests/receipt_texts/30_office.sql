-- The office's receipt items (v2.7148, punch list #299, migration *_receipt_requests_office): what the office reads to
-- chase, and Got it with its Undo. Fixtures are written as postgres; the reads and presses run as each account;
-- everything rolls back. Raises on the first failed assertion; ends with "receipt_office PASSED". See
-- scripts/pgtest-receipt-texts.sh. Never against prod.
\set ON_ERROR_STOP 1
BEGIN;

-- Tess is the office (an assistant); Rita is an assistant in training; Olga is an assistant who has left; Mo is the
-- owner; Jordan and Sam are helpers with a card each; Pat held a card and has left.
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-0000002991a1', 'tess@receipts.test'),
  ('00000000-0000-0000-0000-0000002991a2', 'rita@receipts.test'),
  ('00000000-0000-0000-0000-0000002991a3', 'olga@receipts.test'),
  ('00000000-0000-0000-0000-0000002991a4', 'mo@receipts.test'),
  ('00000000-0000-0000-0000-0000002991a5', 'jordan@receipts.test'),
  ('00000000-0000-0000-0000-0000002991a6', 'sam@receipts.test'),
  ('00000000-0000-0000-0000-0000002991a7', 'pat@receipts.test');
INSERT INTO public.users (id, email, name, role, read_only, is_digital_twin, archived_at) VALUES
  ('00000000-0000-0000-0000-0000002991a1', 'tess@receipts.test', 'Tess Office', 'assistant', false, false, NULL),
  ('00000000-0000-0000-0000-0000002991a2', 'rita@receipts.test', 'Rita Training', 'assistant', true, false, NULL),
  ('00000000-0000-0000-0000-0000002991a3', 'olga@receipts.test', 'Olga Gone', 'assistant', false, false, now() - interval '3 days'),
  ('00000000-0000-0000-0000-0000002991a4', 'mo@receipts.test', 'Mo Owner', 'master_technician', false, false, NULL),
  ('00000000-0000-0000-0000-0000002991a5', 'jordan@receipts.test', 'Jordan Helper', 'helpers', false, false, NULL),
  ('00000000-0000-0000-0000-0000002991a6', 'sam@receipts.test', 'Sam Helper', 'helpers', false, false, NULL),
  ('00000000-0000-0000-0000-0000002991a7', 'pat@receipts.test', 'Pat Left', 'helpers', false, false, now() - interval '9 days')
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name, read_only = EXCLUDED.read_only, archived_at = EXCLUDED.archived_at;

CREATE SCHEMA ro;
GRANT USAGE ON SCHEMA ro TO authenticated;
CREATE FUNCTION ro.same(label text, got text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF got IS DISTINCT FROM want THEN RAISE EXCEPTION E'% differs.\n--- got ---\n%\n--- want ---\n%', label, got, want; END IF;
  RAISE NOTICE 'ok: %', label;
END $$;
CREATE FUNCTION ro.sign_in(p_user uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', p_user::text, true);
  -- auth.role() reads this one, and app_settings' read policy reads auth.role().
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
END $$;
CREATE FUNCTION ro.sign_out() RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', '', true);
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claim.role', '', true);
END $$;
-- A press's outcome as a word: how many rows it changed, or the sqlstate it raised. Runs as the caller.
CREATE FUNCTION ro.done(p_ids uuid[], p_done boolean DEFAULT true) RETURNS text LANGUAGE plpgsql AS $$
BEGIN
  RETURN public.receipt_requests_set_done(p_ids, p_done)::text;
EXCEPTION WHEN OTHERS THEN
  RETURN SQLSTATE;
END $$;
-- What the caller's list holds, as "why store amount" lines in the order the function gives them.
CREATE FUNCTION ro.list() RETURNS text LANGUAGE sql AS $$
  SELECT COALESCE(string_agg(c.why || ' ' || COALESCE(c.store, '-') || ' ' || round(c.amount, 2)::text, ' | '), '') FROM public.receipt_requests_to_chase() c
$$;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA ro TO authenticated;

-- One charge and one request per case. n is 1 to 9 then a to f; the charge posts n minutes ago so the list's order is n.
CREATE FUNCTION ro.seed(p_n text, p_store text, p_holder uuid, p_set text DEFAULT NULL, p_status text DEFAULT 'sent') RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE
  v_charge uuid := ('00000000-0000-0000-0000-0000002991c' || p_n)::uuid;
  v_request uuid := ('00000000-0000-0000-0000-0000002991d' || p_n)::uuid;
BEGIN
  INSERT INTO public.mercury_transactions (id, mercury_id, mercury_account_id, amount, created_at, posted_at, status, kind, counterparty_name, raw)
  VALUES (v_charge, ('00000000-0000-0000-0000-0000002991e' || p_n)::uuid, '00000000-0000-0000-0000-0000002991f1', -10.00 - ('x' || p_n)::bit(4)::int, now() - interval '9 hours',
    now() - make_interval(mins => ('x' || p_n)::bit(4)::int), p_status, 'debitCardTransaction', p_store, '{}'::jsonb);
  INSERT INTO public.receipt_requests (id, mercury_transaction_id, holder_user_id, holder_name)
  VALUES (v_request, v_charge, p_holder, COALESCE((SELECT name FROM public.users WHERE id = p_holder), ''));
  IF p_set IS NOT NULL THEN
    EXECUTE format('UPDATE public.receipt_requests SET %s WHERE id = %L', p_set, v_request);
  END IF;
  RETURN v_request;
END $$;

SELECT ro.sign_out();
-- The six that belong on the list.
SELECT ro.seed('1', 'No Cell Supply', '00000000-0000-0000-0000-0000002991a5', $$no_text_why = 'no_cell'$$);
SELECT ro.seed('2', 'No One Hardware', NULL, $$no_text_why = 'no_person'$$);
SELECT ro.seed('3', 'Left Lumber', '00000000-0000-0000-0000-0000002991a7', $$no_text_why = 'archived'$$);
SELECT ro.seed('4', 'Stop Fuel', '00000000-0000-0000-0000-0000002991a6', $$no_text_why = 'opted_out'$$);
SELECT ro.seed('5', 'Failed Depot', '00000000-0000-0000-0000-0000002991a5', $$text_tries = 3, text_fail_why = 'Quo answered 500.'$$);
SELECT ro.seed('6', 'Twice Supply', '00000000-0000-0000-0000-0000002991a5', $$texted_at = now() - interval '30 hours', reminded_at = now() - interval '13 hours', cell = '+15125550100'$$);
-- The nine that do not.
SELECT ro.seed('7', 'Just Texted', '00000000-0000-0000-0000-0000002991a5', $$texted_at = now() - interval '2 hours'$$);
SELECT ro.seed('8', 'Reminded Tonight', '00000000-0000-0000-0000-0000002991a5', $$texted_at = now() - interval '20 hours', reminded_at = now() - interval '1 hour'$$);
SELECT ro.seed('9', 'By Hand', '00000000-0000-0000-0000-0000002991a5');
SELECT ro.seed('a', 'Two Tries', '00000000-0000-0000-0000-0000002991a5', $$text_tries = 2$$);
SELECT ro.seed('b', 'Answered', '00000000-0000-0000-0000-0000002991a5', $$no_text_why = 'no_cell', answered_at = now()$$);
SELECT ro.seed('c', 'Closed', '00000000-0000-0000-0000-0000002991a5', $$no_text_why = 'no_cell', closed_at = now()$$);
SELECT ro.seed('d', 'Past Its Day', '00000000-0000-0000-0000-0000002991a5', $$no_text_why = 'no_cell', closes_at = now() - interval '1 hour'$$);
SELECT ro.seed('e', 'Taken Back', '00000000-0000-0000-0000-0000002991a5', $$no_text_why = 'no_cell'$$, 'reversed');
SELECT ro.seed('f', 'Has Its Ticket', '00000000-0000-0000-0000-0000002991a5', $$no_text_why = 'no_cell'$$);
INSERT INTO public.counter_tickets (id, taken_by, taken_by_name, added_at, mercury_transaction_id, match_kind) VALUES
  ('00000000-0000-0000-0000-000000299191', '00000000-0000-0000-0000-0000002991a5', 'Jordan', now(), '00000000-0000-0000-0000-0000002991cf', 'minute');

-- The structure.
SELECT ro.same('a request carries the office''s Got it', (
  SELECT string_agg(column_name || ' ' || data_type, ', ' ORDER BY column_name) FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'receipt_requests' AND column_name IN ('office_done_at', 'office_done_by')
), 'office_done_at timestamp with time zone, office_done_by uuid');
SELECT ro.same('nobody signed out may ask either function', (
  SELECT has_function_privilege('anon', 'public.receipt_requests_to_chase()', 'EXECUTE')::text || ' ' || has_function_privilege('anon', 'public.receipt_requests_set_done(uuid[], boolean)', 'EXECUTE')::text
), 'false false');

-- The office reads the six, the newest charge first, each with its reason, its store and its amount as a size.
SET LOCAL ROLE authenticated;
SELECT ro.sign_in('00000000-0000-0000-0000-0000002991a1');
SELECT ro.same('the office reads the six that wait, and none of the nine that do not', ro.list(),
  'no_cell No Cell Supply 11.00 | no_person No One Hardware 12.00 | archived Left Lumber 13.00 | opted_out Stop Fuel 14.00 | failed Failed Depot 15.00 | no_answer Twice Supply 16.00');
SELECT ro.same('each row carries whose card it is and when it was texted', (
  SELECT COALESCE(c.holder_name, '') || ' ' || (c.texted_at IS NOT NULL)::text || ' ' || (c.reminded_at IS NOT NULL)::text || ' ' || (c.closes_at > now())::text
  FROM public.receipt_requests_to_chase() c WHERE c.why = 'no_answer'
), 'Jordan Helper true true true');

-- Got it, and its Undo.
SELECT ro.same('the office marks one done', ro.done(ARRAY['00000000-0000-0000-0000-0000002991d1']::uuid[]), '1');
SELECT ro.same('it leaves the list', (SELECT count(*)::text FROM public.receipt_requests_to_chase()), '5');
SELECT ro.same('a second press changes nothing', ro.done(ARRAY['00000000-0000-0000-0000-0000002991d1']::uuid[]), '0');
RESET ROLE;
SELECT ro.same('the mark names who pressed, and the reason stands', (
  SELECT (office_done_at IS NOT NULL)::text || ' ' || office_done_by::text || ' ' || no_text_why FROM public.receipt_requests WHERE id = '00000000-0000-0000-0000-0000002991d1'
), 'true 00000000-0000-0000-0000-0000002991a1 no_cell');
SET LOCAL ROLE authenticated;
SELECT ro.same('Undo takes the mark back', ro.done(ARRAY['00000000-0000-0000-0000-0000002991d1']::uuid[], false), '1');
SELECT ro.same('and the row is back', (SELECT count(*)::text FROM public.receipt_requests_to_chase()), '6');
SELECT ro.same('several at once', ro.done(ARRAY['00000000-0000-0000-0000-0000002991d4', '00000000-0000-0000-0000-0000002991d6', '00000000-0000-0000-0000-000000000000']::uuid[]), '2');
SELECT ro.same('no ids is no change', ro.done('{}'::uuid[]) || ' ' || ro.done(NULL), '0 0');
SELECT ro.same('more than 200 at once is refused', ro.done(ARRAY(SELECT gen_random_uuid() FROM generate_series(1, 201))), '22023');

-- The owner reads the same list.
SELECT ro.sign_in('00000000-0000-0000-0000-0000002991a4');
SELECT ro.same('the owner reads what is left', (SELECT count(*)::text FROM public.receipt_requests_to_chase()), '4');

-- Who may not.
SELECT ro.sign_in('00000000-0000-0000-0000-0000002991a5');
SELECT ro.same('a helper reads none, the charges on their own card included', (SELECT count(*)::text FROM public.receipt_requests_to_chase()), '0');
SELECT ro.same('a helper marks none', ro.done(ARRAY['00000000-0000-0000-0000-0000002991d2']::uuid[]), '42501');
SELECT ro.sign_in('00000000-0000-0000-0000-0000002991a2');
SELECT ro.same('an assistant in training reads the list', (SELECT count(*)::text FROM public.receipt_requests_to_chase()), '4');
SELECT ro.same('and changes nothing', ro.done(ARRAY['00000000-0000-0000-0000-0000002991d2']::uuid[]), '42501');
SELECT ro.sign_in('00000000-0000-0000-0000-0000002991a3');
SELECT ro.same('an assistant who has left reads none', (SELECT count(*)::text FROM public.receipt_requests_to_chase()), '0');
SELECT ro.same('and marks none', ro.done(ARRAY['00000000-0000-0000-0000-0000002991d2']::uuid[]), '42501');
RESET ROLE;
SELECT ro.sign_out();
SELECT ro.same('nobody signed in marks none', ro.done(ARRAY['00000000-0000-0000-0000-0000002991d2']::uuid[]), '42501');
SELECT ro.same('and the refused presses left the request as it was', (SELECT (office_done_at IS NULL)::text FROM public.receipt_requests WHERE id = '00000000-0000-0000-0000-0000002991d2'), 'true');

SELECT 'receipt_office PASSED';
ROLLBACK;
