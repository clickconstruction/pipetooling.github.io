-- Punch list #129, the leftovers (migration *_write_down_payment): the mark a payment word leaves on its line.
-- `write_down_payment` refuses no sign-in, a training account, a digital twin and anyone off the office team in words, a
-- line that is not there, and any line that is not a customer's own; for the office it makes the line's promise as a
-- payment with its day, writes a new day over an earlier one, over an offered day and over just talk, refuses a day
-- already written as another kind, and with no day takes a payment mark back off as just talk while leaving every
-- other line as it is. The fixture is made as postgres; each press runs as its user through RLS; everything rolls
-- back. Raises on the first failed assertion; ends with "messages_payment_word PASSED". See
-- scripts/pgtest-messages-follow-up.sh. Never against prod.
\set ON_ERROR_STOP 1
BEGIN;

-- Rosa (assistant) and Robert (estimator) are the office; Wendi is a superintendent outside it; a trainee and a twin.
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-000000000ad1', 'dev@payword.test'),
  ('00000000-0000-0000-0000-000000000ad3', 'rosa@payword.test'),
  ('00000000-0000-0000-0000-000000000ad2', 'robert@payword.test'),
  ('00000000-0000-0000-0000-000000000ad4', 'wendi@payword.test'),
  ('00000000-0000-0000-0000-000000000ad6', 'training@payword.test'),
  ('00000000-0000-0000-0000-000000000ad7', 'twin@payword.test');
INSERT INTO public.users (id, email, name, role, read_only, is_digital_twin, archived_at) VALUES
  ('00000000-0000-0000-0000-000000000ad1', 'dev@payword.test', 'Word Dev', 'dev', false, false, NULL),
  ('00000000-0000-0000-0000-000000000ad3', 'rosa@payword.test', 'Rosa', 'assistant', false, false, NULL),
  ('00000000-0000-0000-0000-000000000ad2', 'robert@payword.test', 'Robert', 'estimator', false, false, NULL),
  ('00000000-0000-0000-0000-000000000ad4', 'wendi@payword.test', 'Wendi', 'superintendent', false, false, NULL),
  ('00000000-0000-0000-0000-000000000ad6', 'training@payword.test', 'Trainee', 'estimator', true, false, NULL),
  ('00000000-0000-0000-0000-000000000ad7', 'twin@payword.test', 'Twin', 'assistant', false, true, NULL)
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name, read_only = EXCLUDED.read_only,
    is_digital_twin = EXCLUDED.is_digital_twin, archived_at = EXCLUDED.archived_at;

-- A customer and the person at it, and a number nobody has named.
INSERT INTO public.customers (id, name, master_user_id, contact_info) VALUES
  ('00000000-0000-0000-0000-000000000ac1', 'Pay Word Dental', '00000000-0000-0000-0000-000000000ad1', NULL);
INSERT INTO public.customer_contact_persons (id, customer_id, name, phone, email) VALUES
  ('00000000-0000-0000-0000-000000000ae1', '00000000-0000-0000-0000-000000000ac1', 'Dana Whitfield', '(210) 555-0146', 'dana@payword.example');
INSERT INTO public.contacts (id, kind, customer_contact_person_id) VALUES
  ('00000000-0000-0000-0000-00000000a101', 'customer', '00000000-0000-0000-0000-000000000ae1');
INSERT INTO public.contacts (id, kind) VALUES ('00000000-0000-0000-0000-00000000a102', 'unknown');
INSERT INTO public.contact_channels (contact_id, kind, value) VALUES
  ('00000000-0000-0000-0000-00000000a101', 'phone', '(210) 555-0146'),
  ('00000000-0000-0000-0000-00000000a102', 'phone', '(830) 555-0174');

CREATE SCHEMA mwp;
CREATE FUNCTION mwp.same(label text, got text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF got IS DISTINCT FROM want THEN RAISE EXCEPTION E'% differs.\n--- got ---\n%\n--- want ---\n%', label, got, want; END IF;
  RAISE NOTICE 'ok: %', label;
END $$;
CREATE FUNCTION mwp.refused(label text, stmt text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN
    EXECUTE stmt;
  EXCEPTION WHEN OTHERS THEN
    IF position(want IN SQLERRM) = 0 THEN RAISE EXCEPTION E'% was refused for another reason.\n--- got ---\n%\n--- want it to hold ---\n%', label, SQLERRM, want; END IF;
    RAISE NOTICE 'ok: % (%)', label, SQLERRM;
    RETURN;
  END;
  RAISE EXCEPTION '% was allowed', label;
END $$;
CREATE FUNCTION mwp.as_user(p_user uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', p_user::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
END $$;
CREATE FUNCTION mwp.signed_out() RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', '', true);
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claim.role', '', true);
END $$;
-- The promise on a line: its kind, its state, its day in days from today, its words, and who decided it. SECURITY
-- DEFINER, so a reader off the office team still sees what a refusal left.
CREATE FUNCTION mwp.promise(p_id uuid) RETURNS text LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce((SELECT concat_ws('|', coalesce(kind, '-'), state, coalesce('+' || (day - current_date)::text, '-'), coalesce(day_words, '-'),
      CASE WHEN decided_by IS NULL THEN '-' ELSE public.follow_up_user_name(decided_by) END)
    FROM public.message_promises WHERE message_id = p_id), 'none')
$$;

GRANT USAGE ON SCHEMA mwp TO authenticated, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA mwp TO authenticated, service_role;

-- Dana's lines, and ours; a stranger's text. Made one a statement so each has its own time.
CREATE TEMP TABLE lines (name text PRIMARY KEY, id uuid NOT NULL);
INSERT INTO public.messages (id, contact_id, channel, direction, at, body) VALUES
  ('00000000-0000-0000-0000-0000000a1001', '00000000-0000-0000-0000-00000000a101', 'text', 'in', now() - interval '9 hours', 'I can pay Friday.'),
  ('00000000-0000-0000-0000-0000000a1002', '00000000-0000-0000-0000-00000000a101', 'text', 'out', now() - interval '8 hours', 'Thank you, Dana.'),
  ('00000000-0000-0000-0000-0000000a1003', '00000000-0000-0000-0000-00000000a101', 'voicemail', 'in', now() - interval '7 hours', '"The check goes out the 9th."'),
  ('00000000-0000-0000-0000-0000000a1004', '00000000-0000-0000-0000-00000000a101', 'text', 'in', now() - interval '6 hours', 'Maybe next week, maybe not.'),
  ('00000000-0000-0000-0000-0000000a1005', '00000000-0000-0000-0000-00000000a101', 'email', 'in', now() - interval '5 hours', 'We will decide by the 12th.'),
  ('00000000-0000-0000-0000-0000000a1006', '00000000-0000-0000-0000-00000000a101', 'missed', 'in', now() - interval '4 hours', 'Missed call.'),
  ('00000000-0000-0000-0000-0000000a1007', '00000000-0000-0000-0000-00000000a102', 'text', 'in', now() - interval '3 hours', 'I can pay Friday.');
INSERT INTO lines (name, id) VALUES
  ('pay_text', '00000000-0000-0000-0000-0000000a1001'),
  ('our_text', '00000000-0000-0000-0000-0000000a1002'),
  ('offered_vm', '00000000-0000-0000-0000-0000000a1003'),
  ('talk_text', '00000000-0000-0000-0000-0000000a1004'),
  ('decision_mail', '00000000-0000-0000-0000-0000000a1005'),
  ('missed_call', '00000000-0000-0000-0000-0000000a1006'),
  ('stranger_text', '00000000-0000-0000-0000-0000000a1007');
GRANT SELECT ON lines TO authenticated, service_role;
CREATE FUNCTION mwp.line(p_name text) RETURNS uuid LANGUAGE sql AS $$ SELECT id FROM lines WHERE name = p_name $$;
GRANT EXECUTE ON FUNCTION mwp.line(text) TO authenticated, service_role;

-- Three of Dana's lines already carry a day: one offered, one called just talk, one written as her answer on our bid.
INSERT INTO public.message_promises (message_id, day, day_words) VALUES
  (mwp.line('offered_vm'), current_date + 9, NULL),
  (mwp.line('talk_text'), NULL, 'next week'),
  (mwp.line('decision_mail'), current_date + 12, NULL);
SET ROLE authenticated;
SELECT mwp.as_user('00000000-0000-0000-0000-000000000ad3');
SELECT public.write_down(mwp.line('talk_text'), NULL);
SELECT public.write_down(mwp.line('decision_mail'), 'decision');
SELECT mwp.same('the fixture: an offered day, just talk, an answer on our bid',
  concat_ws(' / ', mwp.promise(mwp.line('offered_vm')), mwp.promise(mwp.line('talk_text')), mwp.promise(mwp.line('decision_mail'))),
  '-|offered|+9|-|- / -|no|-|next week|Rosa / decision|written|+12|-|Rosa');

-- 1 · Who may mark a line, in words, and which lines take a mark.
SELECT mwp.signed_out();
SELECT mwp.refused('no sign-in', $q$SELECT public.write_down_payment(mwp.line('pay_text'), current_date + 3)$q$, 'Sign in to write down a promise.');
SELECT mwp.as_user('00000000-0000-0000-0000-000000000ad6');
SELECT mwp.refused('a training account', $q$SELECT public.write_down_payment(mwp.line('pay_text'), current_date + 3)$q$, 'A training account cannot write down a promise.');
SELECT mwp.as_user('00000000-0000-0000-0000-000000000ad7');
SELECT mwp.refused('a digital twin', $q$SELECT public.write_down_payment(mwp.line('pay_text'), current_date + 3)$q$, 'A digital twin cannot write down a promise.');
SELECT mwp.as_user('00000000-0000-0000-0000-000000000ad4');
SELECT mwp.refused('a superintendent', $q$SELECT public.write_down_payment(mwp.line('pay_text'), current_date + 3)$q$, 'Only the office team can write down a promise.');
SELECT mwp.refused('a superintendent takes no mark off either', $q$SELECT public.write_down_payment(mwp.line('pay_text'))$q$, 'Only the office team can write down a promise.');
SELECT mwp.as_user('00000000-0000-0000-0000-000000000ad3');
SELECT mwp.refused('a line that is not there', $q$SELECT public.write_down_payment('00000000-0000-0000-0000-0000000a1999', current_date + 3)$q$, 'That line is not there.');
SELECT mwp.refused('our own text', $q$SELECT public.write_down_payment(mwp.line('our_text'), current_date + 3)$q$, 'A payment promise is written on a customer''s own line.');
SELECT mwp.refused('a text from a number nobody has named', $q$SELECT public.write_down_payment(mwp.line('stranger_text'), current_date + 3)$q$, 'A payment promise is written on a customer''s own line.');
SELECT mwp.same('nothing was written by a refusal',
  concat_ws(' / ', mwp.promise(mwp.line('pay_text')), mwp.promise(mwp.line('our_text')), mwp.promise(mwp.line('stranger_text'))), 'none / none / none');

-- 2 · Rosa marks a line that carried no day: the row is made, a payment, written, with the day and her name.
SELECT public.write_down_payment(mwp.line('pay_text'), current_date + 3);
SELECT mwp.same('a line with no day takes the mark', mwp.promise(mwp.line('pay_text')), 'payment|written|+3|-|Rosa');
-- The same press again changes nothing, and a new day they named replaces the earlier one. An estimator may too.
SELECT public.write_down_payment(mwp.line('pay_text'), current_date + 3);
SELECT mwp.same('the same press twice is one mark', mwp.promise(mwp.line('pay_text')), 'payment|written|+3|-|Rosa');
SELECT mwp.as_user('00000000-0000-0000-0000-000000000ad2');
SELECT public.write_down_payment(mwp.line('pay_text'), current_date + 5);
SELECT mwp.same('a new day replaces the earlier one, by whoever wrote it', mwp.promise(mwp.line('pay_text')), 'payment|written|+5|-|Robert');
SELECT mwp.same('the estimator reads the mark through RLS, one row a line',
  (SELECT count(*)::text FROM public.message_promises WHERE message_id = mwp.line('pay_text') AND kind = 'payment' AND state = 'written'), '1');
SELECT mwp.as_user('00000000-0000-0000-0000-000000000ad3');

-- 3 · Over an offered day, and over a day called just talk, with the day from the sheet in place of the one heard.
SELECT public.write_down_payment(mwp.line('offered_vm'), current_date + 10);
SELECT mwp.same('an offered day is written as a payment, on the sheet''s day', mwp.promise(mwp.line('offered_vm')), 'payment|written|+10|-|Rosa');
SELECT public.write_down_payment(mwp.line('talk_text'), current_date + 7);
SELECT mwp.same('just talk becomes a payment, a date in place of the words', mwp.promise(mwp.line('talk_text')), 'payment|written|+7|-|Rosa');
SELECT public.write_down_payment(mwp.line('missed_call'), current_date + 2);
SELECT mwp.same('a missed call takes the word they gave when we called back', mwp.promise(mwp.line('missed_call')), 'payment|written|+2|-|Rosa');

-- 4 · A day already written as another kind is somebody's answer: refused, and left as it is.
SELECT mwp.refused('a day written as their answer on our bid', $q$SELECT public.write_down_payment(mwp.line('decision_mail'), current_date + 3)$q$, 'Someone has said what that day is already.');
SELECT mwp.same('the answer stands', mwp.promise(mwp.line('decision_mail')), 'decision|written|+12|-|Rosa');

-- 5 · No day takes a payment mark back off, as just talk with its day kept; any other line is left as it is.
SELECT public.write_down_payment(mwp.line('pay_text'));
SELECT mwp.same('the mark comes off as just talk', mwp.promise(mwp.line('pay_text')), '-|no|+5|-|Rosa');
SELECT public.write_down_payment(mwp.line('pay_text'));
SELECT mwp.same('taking it off twice changes nothing', mwp.promise(mwp.line('pay_text')), '-|no|+5|-|Rosa');
SELECT public.write_down_payment(mwp.line('decision_mail'));
SELECT mwp.same('no day leaves another kind alone', mwp.promise(mwp.line('decision_mail')), 'decision|written|+12|-|Rosa');
SELECT mwp.refused('no day on our own line is still refused', $q$SELECT public.write_down_payment(mwp.line('our_text'))$q$, 'A payment promise is written on a customer''s own line.');
-- A word written again on the line marks it again.
SELECT public.write_down_payment(mwp.line('pay_text'), current_date + 6);
SELECT mwp.same('a line taken off takes a mark again', mwp.promise(mwp.line('pay_text')), 'payment|written|+6|-|Rosa');

RESET ROLE;
SELECT mwp.same('the written payment days the move line and the job''s summary read',
  (SELECT count(*)::text FROM public.message_promises p JOIN public.messages m ON m.id = p.message_id
   WHERE m.contact_id = '00000000-0000-0000-0000-00000000a101' AND p.state = 'written' AND p.kind = 'payment' AND p.day >= current_date), '4');
DO $$ BEGIN RAISE NOTICE 'messages_payment_word PASSED'; END $$;
ROLLBACK;
