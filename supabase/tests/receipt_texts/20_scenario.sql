-- Receipt texts (v2.7142, punch list #299 PR 2, migration *_receipt_texts): the switch, the day it went on, and the
-- guard the cron reads before it calls the sweep. Fixtures are written as postgres; the presses run as each account
-- under RLS; everything rolls back. Raises on the first failed assertion; ends with "receipt_texts PASSED". See
-- scripts/pgtest-receipt-texts.sh. Never against prod, and nothing here can send a text.
\set ON_ERROR_STOP 1
BEGIN;

-- Mo is the owner; Dee is a dev; Tess is the office (an assistant); Jordan and Sam are helpers, each with a card.
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-0000002990a1', 'mo@receipts.test'),
  ('00000000-0000-0000-0000-0000002990a2', 'dee@receipts.test'),
  ('00000000-0000-0000-0000-0000002990a3', 'tess@receipts.test'),
  ('00000000-0000-0000-0000-0000002990a4', 'jordan@receipts.test'),
  ('00000000-0000-0000-0000-0000002990a5', 'sam@receipts.test');
INSERT INTO public.users (id, email, name, role, read_only, is_digital_twin, archived_at) VALUES
  ('00000000-0000-0000-0000-0000002990a1', 'mo@receipts.test', 'Mo Owner', 'master_technician', false, false, NULL),
  ('00000000-0000-0000-0000-0000002990a2', 'dee@receipts.test', 'Dee Dev', 'dev', false, false, NULL),
  ('00000000-0000-0000-0000-0000002990a3', 'tess@receipts.test', 'Tess Office', 'assistant', false, false, NULL),
  ('00000000-0000-0000-0000-0000002990a4', 'jordan@receipts.test', 'Jordan Helper', 'helpers', false, false, NULL),
  ('00000000-0000-0000-0000-0000002990a5', 'sam@receipts.test', 'Sam Helper', 'helpers', false, false, NULL)
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name, archived_at = EXCLUDED.archived_at;
INSERT INTO public.mercury_debit_card_user_links (mercury_debit_card_id, user_id) VALUES
  ('aaaaaaaa-0000-4000-8000-000000000299', '00000000-0000-0000-0000-0000002990a4'),
  ('bbbbbbbb-0000-4000-8000-000000000299', '00000000-0000-0000-0000-0000002990a5');

CREATE SCHEMA rt;
GRANT USAGE ON SCHEMA rt TO authenticated;
CREATE FUNCTION rt.same(label text, got text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF got IS DISTINCT FROM want THEN RAISE EXCEPTION E'% differs.\n--- got ---\n%\n--- want ---\n%', label, got, want; END IF;
  RAISE NOTICE 'ok: %', label;
END $$;
CREATE FUNCTION rt.sign_in(p_user uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', p_user::text, true);
END $$;
CREATE FUNCTION rt.sign_out() RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', '', true);
  PERFORM set_config('request.jwt.claim.sub', '', true);
END $$;
-- A press of the switch as the caller, under RLS: how many rows it changed, or the sqlstate it raised.
CREATE FUNCTION rt.press(p_value text) RETURNS text LANGUAGE plpgsql AS $$
DECLARE n integer;
BEGIN
  UPDATE public.app_settings SET value_text = p_value WHERE key = 'receipt_texts_v1';
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n::text;
EXCEPTION WHEN OTHERS THEN
  RETURN SQLSTATE;
END $$;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA rt TO authenticated;
-- What the row holds, as postgres. And the row written past the trigger, to stand a day in the past: the only way
-- there, since the trigger gives every write that switches it on the database's own clock.
CREATE FUNCTION rt.stored() RETURNS jsonb LANGUAGE sql AS $$ SELECT value_text::jsonb FROM public.app_settings WHERE key = 'receipt_texts_v1' $$;
CREATE FUNCTION rt.force(p_value text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  ALTER TABLE public.app_settings DISABLE TRIGGER receipt_texts_stamp;
  UPDATE public.app_settings SET value_text = p_value WHERE key = 'receipt_texts_v1';
  ALTER TABLE public.app_settings ENABLE TRIGGER receipt_texts_stamp;
END $$;
CREATE FUNCTION rt.on_since(p_since timestamptz, p_only text[] DEFAULT '{}') RETURNS void LANGUAGE sql AS $$
  SELECT rt.force(jsonb_build_object('on', true, 'since', to_char(p_since AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'), 'only', to_jsonb(p_only))::text)
$$;
CREATE FUNCTION rt.send_texts(p_on boolean) RETURNS void LANGUAGE sql AS $$
  UPDATE public.app_settings SET value_text = p_on::text WHERE key = 'messages_texts_on_v1'
$$;
CREATE FUNCTION rt.charge(p_n integer, p_card text, p_posted timestamptz, p_amount numeric DEFAULT -228.58, p_status text DEFAULT 'sent', p_kind text DEFAULT 'debitCardTransaction') RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE v_id uuid := ('00000000-0000-0000-0000-0000002990c' || p_n)::uuid;
BEGIN
  INSERT INTO public.mercury_transactions (id, mercury_id, mercury_account_id, amount, created_at, posted_at, status, kind, counterparty_name, raw)
  VALUES (v_id, ('00000000-0000-0000-0000-0000002990d' || p_n)::uuid, '00000000-0000-0000-0000-0000002990e1', p_amount, COALESCE(p_posted, now()) - interval '8 hours', p_posted, p_status, p_kind, 'Ridgeway Supply',
    jsonb_build_object('details', jsonb_build_object('debitCardInfo', jsonb_build_object('id', p_card))));
  RETURN v_id;
END $$;
CREATE FUNCTION rt.due() RETURNS text LANGUAGE sql AS $$ SELECT public.receipt_texts_due()::text $$;

-- ---------------------------------------------------------------------------------------------------------------------
-- The structure.
SELECT rt.same('the switch ships off', (SELECT value_text FROM public.app_settings WHERE key = 'receipt_texts_v1'), '{"on":false}');
SELECT rt.same('a request counts its tries and keeps why the last one failed', (
  SELECT string_agg(column_name || ' ' || data_type, ', ' ORDER BY column_name) FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'receipt_requests' AND column_name IN ('text_tries', 'text_fail_why')
), 'text_fail_why text, text_tries integer');
SELECT rt.same('one receipt-request cron row, every five minutes', (SELECT count(*)::text || ' ' || max(schedule) FROM cron.job WHERE jobname = 'receipt-request'), '1 */5 * * * *');
SELECT rt.same('the cron calls only when the guard says so', (SELECT (command LIKE '%/functions/v1/receipt-request%' AND command LIKE '%WHERE public.receipt_texts_due()%')::text FROM cron.job WHERE jobname = 'receipt-request'), 'true');
SELECT rt.same('nobody signed in, and nobody signed out, may ask the guard', (
  SELECT has_function_privilege('authenticated', 'public.receipt_texts_due()', 'EXECUTE')::text || ' ' || has_function_privilege('anon', 'public.receipt_texts_due()', 'EXECUTE')::text || ' ' || has_function_privilege('service_role', 'public.receipt_texts_due()', 'EXECUTE')::text
), 'false false true');
SELECT rt.same('the stamp runs for this row alone', (SELECT pg_get_triggerdef(oid) LIKE '%WHEN ((new.key = ''receipt_texts_v1''::text))%' FROM pg_trigger WHERE tgname = 'receipt_texts_stamp' AND tgrelid = 'public.app_settings'::regclass)::text, 'true');

-- ---------------------------------------------------------------------------------------------------------------------
-- Who may press, and what a press leaves in the row.
SET LOCAL ROLE authenticated;
SELECT rt.sign_in('00000000-0000-0000-0000-0000002990a3');
SELECT rt.same('the office reads the switch', (SELECT value_text FROM public.app_settings WHERE key = 'receipt_texts_v1'), '{"on":false}');
SELECT rt.same('the office cannot press it', rt.press('{"on":true,"since":"2026-01-01T00:00:00.000Z","only":[]}'), '0');
SELECT rt.sign_in('00000000-0000-0000-0000-0000002990a4');
SELECT rt.same('a helper cannot press it', rt.press('{"on":true,"since":"2026-01-01T00:00:00.000Z","only":[]}'), '0');
RESET ROLE;
SELECT rt.same('and it is still off', rt.stored()::text, '{"on": false}');

SET LOCAL ROLE authenticated;
SELECT rt.sign_in('00000000-0000-0000-0000-0000002990a1');
-- The owner's phone says it is New Year's Day. The row does not believe it.
SELECT rt.same('the owner presses it on', rt.press('{"on":true,"since":"2026-01-01T00:00:00.000Z","only":[]}'), '1');
RESET ROLE;
SELECT rt.same('on, for everyone', (rt.stored() ->> 'on') || ' ' || (rt.stored() -> 'only')::text, 'true []');
SELECT rt.same('the day it went on is the database''s now, not the phone''s', ((rt.stored() ->> 'since')::timestamptz = date_trunc('milliseconds', now()))::text, 'true');
SELECT rt.same('a day ahead of now is not believed either', (SELECT rt.press('{"on":true,"since":"2031-01-01T00:00:00.000Z","only":["00000000-0000-0000-0000-0000002990A4"]}') || ' ' || ((rt.stored() ->> 'since')::timestamptz <= now())::text || ' ' || (rt.stored() -> 'only')::text), '1 true ["00000000-0000-0000-0000-0000002990a4"]');

-- A day that stands: it went on an hour ago for everyone. A write that leaves it on for everyone keeps the hour;
-- a write that changes who it texts starts from now.
SELECT rt.on_since(now() - interval '1 hour');
SELECT rt.same('on for the same people keeps the day it went on', (SELECT rt.press('{"on":true,"since":"2031-01-01T00:00:00.000Z","only":[]}') || ' ' || ((rt.stored() ->> 'since')::timestamptz = date_trunc('milliseconds', now() - interval '1 hour'))::text), '1 true');
SELECT rt.same('on for other people is on from now', (SELECT rt.press('{"on":true,"only":["00000000-0000-0000-0000-0000002990a4"]}') || ' ' || ((rt.stored() ->> 'since')::timestamptz = date_trunc('milliseconds', now()))::text), '1 true');
SELECT rt.on_since(now() - interval '1 hour', ARRAY['00000000-0000-0000-0000-0000002990a4']);
SELECT rt.same('a trial widened to everyone is on from now', (SELECT rt.press('{"on":true,"since":"2026-01-01T00:00:00.000Z","only":[]}') || ' ' || ((rt.stored() ->> 'since')::timestamptz = date_trunc('milliseconds', now()))::text), '1 true');

-- A value that does not read lands as off: a doubt never sends a text.
SELECT rt.same('on for a list that names no user is off', (SELECT rt.press('{"on":true,"only":["jordan"]}') || ' ' || rt.stored()::text), '1 {"on": false}');
SELECT rt.same('on for a list that is not a list is off', (SELECT rt.press('{"on":true,"only":"everyone"}') || ' ' || rt.stored()::text), '1 {"on": false}');
SELECT rt.same('on spelled as a word is off', (SELECT rt.press('{"on":"true","only":[]}') || ' ' || rt.stored()::text), '1 {"on": false}');
SELECT rt.same('words that are not JSON are off', (SELECT rt.press('yes please') || ' ' || rt.stored()::text), '1 {"on": false}');
SELECT rt.same('nothing at all is off', (SELECT rt.press(NULL) || ' ' || rt.stored()::text), '1 {"on": false}');

SET LOCAL ROLE authenticated;
SELECT rt.sign_in('00000000-0000-0000-0000-0000002990a2');
SELECT rt.same('a dev presses it on, and off', rt.press('{"on":true,"only":[]}') || ' ' || rt.press('{"on":false}'), '1 1');
SELECT rt.same('the policy opens this row alone to a press', (SELECT count(*)::text FROM pg_policies WHERE schemaname = 'public' AND tablename = 'app_settings' AND policyname = 'master_or_dev_update_receipt_texts' AND qual LIKE '%receipt_texts_v1%' AND with_check LIKE '%receipt_texts_v1%'), '1');
RESET ROLE;
SELECT rt.sign_out();
SELECT rt.same('off again', rt.stored()::text, '{"on": false}');

-- ---------------------------------------------------------------------------------------------------------------------
-- The guard. Jordan's charge posted an hour ago.
SELECT rt.charge(1, 'aaaaaaaa-0000-4000-8000-000000000299', now() - interval '1 hour');

SELECT rt.send_texts(false);
SELECT rt.same('both switches off: nothing to do', rt.due(), 'false');
SELECT rt.on_since(now() - interval '2 hours');
SELECT rt.same('receipt texts on, Send texts off: nothing to do', rt.due(), 'false');
SELECT rt.send_texts(true);
SELECT rt.force('{"on":false}');
SELECT rt.same('Send texts on, receipt texts off: nothing to do', rt.due(), 'false');

-- Switched on by a real press, now: the charge from an hour ago is older than the switch, and is never asked about.
SET LOCAL ROLE authenticated;
SELECT rt.sign_in('00000000-0000-0000-0000-0000002990a1');
SELECT rt.same('the owner switches it on now', rt.press('{"on":true,"only":[]}'), '1');
RESET ROLE;
SELECT rt.sign_out();
SELECT rt.same('a charge that posted before the switch went on is never due', rt.due(), 'false');

SELECT rt.on_since(now() - interval '2 hours');
SELECT rt.same('a charge that posted since, with no request and no ticket, is due', rt.due(), 'true');
SELECT rt.force('{"on":true}');
SELECT rt.same('on with no day to start from is off', rt.due(), 'false');
SELECT rt.force('not json');
SELECT rt.same('a value that does not read is off', rt.due(), 'false');
SELECT rt.force('{"on":true,"since":"2026-11-01T00:00:00.000Z","only":"everyone"}');
SELECT rt.same('a list that is not a list is off', rt.due(), 'false');

-- What is never asked about: pending, money back, a duplicate, a dead charge, a check, a charge past 48 hours.
SELECT rt.on_since(now() - interval '30 days');
UPDATE public.mercury_transactions SET posted_at = NULL WHERE id = '00000000-0000-0000-0000-0000002990c1';
SELECT rt.same('a pending charge is not due', rt.due(), 'false');
UPDATE public.mercury_transactions SET posted_at = now() - interval '1 hour', amount = 41.17 WHERE id = '00000000-0000-0000-0000-0000002990c1';
SELECT rt.same('money back is not due', rt.due(), 'false');
UPDATE public.mercury_transactions SET amount = -228.58, status = 'failed' WHERE id = '00000000-0000-0000-0000-0000002990c1';
SELECT rt.same('a failed charge is not due', rt.due(), 'false');
UPDATE public.mercury_transactions SET status = 'sent', kind = 'outgoingPayment' WHERE id = '00000000-0000-0000-0000-0000002990c1';
SELECT rt.same('a payment that is not a card charge is not due', rt.due(), 'false');
UPDATE public.mercury_transactions SET kind = 'debitCardTransaction', posted_at = now() - interval '49 hours' WHERE id = '00000000-0000-0000-0000-0000002990c1';
SELECT rt.same('a charge past 48 hours is not due, however long the switch has been on', rt.due(), 'false');
UPDATE public.mercury_transactions SET posted_at = now() - interval '47 hours', status = NULL WHERE id = '00000000-0000-0000-0000-0000002990c1';
SELECT rt.same('inside 48 hours it is, and a charge with no status stands', rt.due(), 'true');
UPDATE public.mercury_transactions SET posted_at = now() - interval '1 hour', status = 'sent' WHERE id = '00000000-0000-0000-0000-0000002990c1';

-- Its ticket came from the Tally press: nothing to ask.
INSERT INTO public.counter_tickets (id, taken_by, taken_by_name, added_at, mercury_transaction_id, match_kind) VALUES
  ('00000000-0000-0000-0000-000000299111', '00000000-0000-0000-0000-0000002990a4', 'Jordan', now(), '00000000-0000-0000-0000-0000002990c1', 'minute');
SELECT rt.same('a charge with its ticket is not due', rt.due(), 'false');
UPDATE public.counter_tickets SET removed_at = now(), removed_by = '00000000-0000-0000-0000-0000002990a4' WHERE id = '00000000-0000-0000-0000-000000299111';
SELECT rt.same('a ticket that was removed does not count', rt.due(), 'true');

-- The request is made (the sweep's first step, the service role's function), and waits for its text.
SELECT rt.same('the request names the card''s holder', (SELECT holder_name || ' ' || text_tries::text FROM public.receipt_request_ensure('00000000-0000-0000-0000-0000002990c1')), 'Jordan Helper 0');
SELECT rt.same('a request that waits for its first text is due', rt.due(), 'true');
UPDATE public.counter_tickets SET removed_at = NULL, removed_by = NULL WHERE id = '00000000-0000-0000-0000-000000299111';
SELECT rt.same('but not once its ticket is on the charge', rt.due(), 'false');
UPDATE public.counter_tickets SET removed_at = now(), removed_by = '00000000-0000-0000-0000-0000002990a4' WHERE id = '00000000-0000-0000-0000-000000299111';

-- A trial counts only its people.
SELECT rt.on_since(now() - interval '30 days', ARRAY['00000000-0000-0000-0000-0000002990a5']);
SELECT rt.same('a trial for Sam leaves Jordan''s request alone', rt.due(), 'false');
SELECT rt.on_since(now() - interval '30 days', ARRAY['00000000-0000-0000-0000-0000002990a4']);
SELECT rt.same('a trial for Jordan counts it', rt.due(), 'true');
SELECT rt.on_since(now() - interval '30 days');

-- Why a request stops waiting.
UPDATE public.receipt_requests SET text_tries = 2 WHERE mercury_transaction_id = '00000000-0000-0000-0000-0000002990c1';
SELECT rt.same('a text turned away twice is tried again', rt.due(), 'true');
UPDATE public.receipt_requests SET text_tries = 3 WHERE mercury_transaction_id = '00000000-0000-0000-0000-0000002990c1';
SELECT rt.same('turned away three times, it is the office''s', rt.due(), 'false');
UPDATE public.receipt_requests SET text_tries = 0, no_text_why = 'no_cell' WHERE mercury_transaction_id = '00000000-0000-0000-0000-0000002990c1';
SELECT rt.same('a request with its reason does not wait', rt.due(), 'false');
UPDATE public.receipt_requests SET no_text_why = NULL, texted_at = now() WHERE mercury_transaction_id = '00000000-0000-0000-0000-0000002990c1';
SELECT rt.same('texted a moment ago: nothing to do', rt.due(), 'false');

-- The one reminder: due only in the company's evening, at least twelve hours after the text.
UPDATE public.receipt_requests SET texted_at = now() - interval '13 hours' WHERE mercury_transaction_id = '00000000-0000-0000-0000-0000002990c1';
SELECT rt.same('thirteen hours after the text, the reminder is due in the evening and at no other hour', rt.due(), (extract(hour FROM now() AT TIME ZONE 'America/Chicago') BETWEEN 18 AND 20)::text);
UPDATE public.receipt_requests SET texted_at = now() - interval '11 hours' WHERE mercury_transaction_id = '00000000-0000-0000-0000-0000002990c1';
SELECT rt.same('eleven hours after it, never', rt.due(), 'false');
UPDATE public.receipt_requests SET texted_at = now() - interval '13 hours', reminded_at = now() WHERE mercury_transaction_id = '00000000-0000-0000-0000-0000002990c1';
SELECT rt.same('reminded once, never again', rt.due(), 'false');

-- The bank takes the charge back: the open request is the sweep's to close, then nothing.
UPDATE public.mercury_transactions SET status = 'reversed' WHERE id = '00000000-0000-0000-0000-0000002990c1';
SELECT rt.same('an open request on a reversed charge is due, to be closed', rt.due(), 'true');
UPDATE public.receipt_requests SET closed_at = now() WHERE mercury_transaction_id = '00000000-0000-0000-0000-0000002990c1';
SELECT rt.same('closed, it is done', rt.due(), 'false');

-- Sam's charge posts on a card: due for everyone, and, with no request yet, due in a trial too (the request is how
-- the sweep learns whose it is).
SELECT rt.charge(2, 'bbbbbbbb-0000-4000-8000-000000000299', now() - interval '10 minutes');
SELECT rt.same('a second charge is due', rt.due(), 'true');
SELECT rt.send_texts(false);
SELECT rt.same('and not while Send texts is off', rt.due(), 'false');

SELECT 'receipt_texts PASSED';
ROLLBACK;
