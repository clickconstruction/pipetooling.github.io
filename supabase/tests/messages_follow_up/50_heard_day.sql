-- Punch list #421 (migration *_heard_day_write): a heard day said in one press, and a payment mark's job.
-- `write_down_heard` refuses no sign-in, a training account, a digital twin and anyone off the office team in words, no
-- day, a line that is not there, our own line, a call or an email, a person who is not a customer, a trade partner or an
-- architect, a payment, and a kind the person does not make; for the office it writes the line's day with its kind,
-- writes over an offered day and over just talk, takes a new day for the same kind, refuses another kind over a written
-- day, keeps just talk with its day, and writes a double kind's first unless told the other. `write_down_payment` takes
-- the job a mark is for, refuses a job that is not there, and still runs when called the old way. The fixture is made
-- as postgres; each press runs as its user through RLS; everything rolls back. Raises on the first failed assertion;
-- ends with "messages_heard_day PASSED". See scripts/pgtest-messages-follow-up.sh. Never against prod.
\set ON_ERROR_STOP 1
BEGIN;

-- Rosa (assistant) and Robert (estimator) are the office; Wendi is a superintendent outside it; a trainee and a twin.
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-000000000bd1', 'dev@heardday.test'),
  ('00000000-0000-0000-0000-000000000bd3', 'rosa@heardday.test'),
  ('00000000-0000-0000-0000-000000000bd2', 'robert@heardday.test'),
  ('00000000-0000-0000-0000-000000000bd4', 'wendi@heardday.test'),
  ('00000000-0000-0000-0000-000000000bd6', 'training@heardday.test'),
  ('00000000-0000-0000-0000-000000000bd7', 'twin@heardday.test');
INSERT INTO public.users (id, email, name, role, read_only, is_digital_twin, archived_at) VALUES
  ('00000000-0000-0000-0000-000000000bd1', 'dev@heardday.test', 'Heard Dev', 'dev', false, false, NULL),
  ('00000000-0000-0000-0000-000000000bd3', 'rosa@heardday.test', 'Rosa', 'assistant', false, false, NULL),
  ('00000000-0000-0000-0000-000000000bd2', 'robert@heardday.test', 'Robert', 'estimator', false, false, NULL),
  ('00000000-0000-0000-0000-000000000bd4', 'wendi@heardday.test', 'Wendi', 'superintendent', false, false, NULL),
  ('00000000-0000-0000-0000-000000000bd6', 'training@heardday.test', 'Trainee', 'estimator', true, false, NULL),
  ('00000000-0000-0000-0000-000000000bd7', 'twin@heardday.test', 'Twin', 'assistant', false, true, NULL)
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name, read_only = EXCLUDED.read_only,
    is_digital_twin = EXCLUDED.is_digital_twin, archived_at = EXCLUDED.archived_at;

-- A customer with two jobs, a trade partner, an architect, and a lead.
INSERT INTO public.customers (id, name, master_user_id, contact_info) VALUES
  ('00000000-0000-0000-0000-000000000bc1', 'Heard Day Dental', '00000000-0000-0000-0000-000000000bd1', NULL);
INSERT INTO public.service_types (id, name) VALUES ('00000000-0000-0000-0000-000000000bf9', 'Heard Day Bed Work');
INSERT INTO public.jobs_ledger (id, master_user_id, service_type_id, job_name, customer_id) VALUES
  ('00000000-0000-0000-0000-000000000bb1', '00000000-0000-0000-0000-000000000bd1', '00000000-0000-0000-0000-000000000bf9', 'Front office repipe', '00000000-0000-0000-0000-000000000bc1'),
  ('00000000-0000-0000-0000-000000000bb2', '00000000-0000-0000-0000-000000000bd1', '00000000-0000-0000-0000-000000000bf9', 'Back office water heater', '00000000-0000-0000-0000-000000000bc1');
INSERT INTO public.contacts (id, kind, customer_id) VALUES
  ('00000000-0000-0000-0000-00000000b101', 'customer', '00000000-0000-0000-0000-000000000bc1');
INSERT INTO public.contacts (id, kind) VALUES
  ('00000000-0000-0000-0000-00000000b102', 'trade'),
  ('00000000-0000-0000-0000-00000000b103', 'arch'),
  ('00000000-0000-0000-0000-00000000b104', 'lead');
INSERT INTO public.contact_channels (contact_id, kind, value) VALUES
  ('00000000-0000-0000-0000-00000000b101', 'phone', '(210) 555-0147'),
  ('00000000-0000-0000-0000-00000000b102', 'phone', '(210) 555-0148'),
  ('00000000-0000-0000-0000-00000000b103', 'phone', '(210) 555-0149'),
  ('00000000-0000-0000-0000-00000000b104', 'phone', '(830) 555-0175');

CREATE SCHEMA mhd;
CREATE FUNCTION mhd.same(label text, got text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF got IS DISTINCT FROM want THEN RAISE EXCEPTION E'% differs.\n--- got ---\n%\n--- want ---\n%', label, got, want; END IF;
  RAISE NOTICE 'ok: %', label;
END $$;
CREATE FUNCTION mhd.refused(label text, stmt text, want text) RETURNS void LANGUAGE plpgsql AS $$
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
CREATE FUNCTION mhd.as_user(p_user uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', p_user::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
END $$;
CREATE FUNCTION mhd.signed_out() RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', '', true);
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claim.role', '', true);
END $$;
-- The day on a line: kind|state|+days|writes|who|job, or none. SECURITY DEFINER, so a refusal's leftovers are seen.
CREATE FUNCTION mhd.promise(p_id uuid) RETURNS text LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce((
    SELECT concat_ws('|', coalesce(kind, '-'), state,
      CASE WHEN day IS NULL THEN '-' ELSE '+' || (day - current_date)::text END,
      coalesce(writes, '-'),
      CASE WHEN decided_by IS NULL THEN '-' ELSE public.follow_up_user_name(decided_by) END,
      CASE job_id WHEN '00000000-0000-0000-0000-000000000bb1' THEN 'front' WHEN '00000000-0000-0000-0000-000000000bb2' THEN 'back' ELSE '-' END)
    FROM public.message_promises WHERE message_id = p_id AND coalesce(kind, '') <> 'question'), 'none')
$$;

GRANT USAGE ON SCHEMA mhd TO authenticated, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA mhd TO authenticated, service_role;

CREATE TEMP TABLE lines (name text PRIMARY KEY, id uuid NOT NULL);
INSERT INTO public.messages (id, contact_id, channel, direction, at, body) VALUES
  ('00000000-0000-0000-0000-0000000b1001', '00000000-0000-0000-0000-00000000b102', 'text', 'in', now() - interval '9 hours', 'We can get you the quote by Wednesday.'),
  ('00000000-0000-0000-0000-0000000b1002', '00000000-0000-0000-0000-00000000b102', 'voicemail', 'in', now() - interval '8 hours', '"Crew can start Monday."'),
  ('00000000-0000-0000-0000-0000000b1003', '00000000-0000-0000-0000-00000000b102', 'text', 'in', now() - interval '7 hours', 'Insurance papers by Friday.'),
  ('00000000-0000-0000-0000-0000000b1004', '00000000-0000-0000-0000-00000000b102', 'text', 'out', now() - interval '6 hours', 'Thanks.'),
  ('00000000-0000-0000-0000-0000000b1005', '00000000-0000-0000-0000-00000000b102', 'email', 'in', now() - interval '6 hours', 'Quote by the 12th.'),
  ('00000000-0000-0000-0000-0000000b1006', '00000000-0000-0000-0000-00000000b102', 'call', 'in', now() - interval '6 hours', 'They will start Monday.'),
  ('00000000-0000-0000-0000-0000000b1007', '00000000-0000-0000-0000-00000000b101', 'text', 'in', now() - interval '5 hours', 'We will let you know Friday.'),
  ('00000000-0000-0000-0000-0000000b1008', '00000000-0000-0000-0000-00000000b101', 'text', 'in', now() - interval '5 hours', 'I can pay Friday.'),
  ('00000000-0000-0000-0000-0000000b1009', '00000000-0000-0000-0000-00000000b103', 'voicemail', 'in', now() - interval '4 hours', '"Our answer by Thursday."'),
  ('00000000-0000-0000-0000-0000000b1010', '00000000-0000-0000-0000-00000000b104', 'text', 'in', now() - interval '3 hours', 'I will decide Friday.'),
  ('00000000-0000-0000-0000-0000000b1011', '00000000-0000-0000-0000-00000000b102', 'text', 'in', now() - interval '2 hours', 'Maybe Tuesday.'),
  ('00000000-0000-0000-0000-0000000b1012', '00000000-0000-0000-0000-00000000b101', 'text', 'in', now() - interval '1 hours', 'And I can pay the rest on the 9th.');
INSERT INTO lines (name, id) VALUES
  ('quote_text', '00000000-0000-0000-0000-0000000b1001'),
  ('start_vm', '00000000-0000-0000-0000-0000000b1002'),
  ('papers_text', '00000000-0000-0000-0000-0000000b1003'),
  ('our_text', '00000000-0000-0000-0000-0000000b1004'),
  ('trade_mail', '00000000-0000-0000-0000-0000000b1005'),
  ('trade_call', '00000000-0000-0000-0000-0000000b1006'),
  ('decide_text', '00000000-0000-0000-0000-0000000b1007'),
  ('pay_text', '00000000-0000-0000-0000-0000000b1008'),
  ('arch_vm', '00000000-0000-0000-0000-0000000b1009'),
  ('lead_text', '00000000-0000-0000-0000-0000000b1010'),
  ('offered_text', '00000000-0000-0000-0000-0000000b1011'),
  ('pay_rest', '00000000-0000-0000-0000-0000000b1012');
GRANT SELECT ON lines TO authenticated, service_role;
CREATE FUNCTION mhd.line(p_name text) RETURNS uuid LANGUAGE sql AS $$ SELECT id FROM lines WHERE name = p_name $$;
GRANT EXECUTE ON FUNCTION mhd.line(text) TO authenticated, service_role;

-- One line carries a day still offered, as a reader on the server would leave it.
INSERT INTO public.message_promises (message_id, day) VALUES (mhd.line('offered_text'), current_date + 4);
SET ROLE authenticated;

-- 1 · Who may say what a day is, in words.
SELECT mhd.signed_out();
SELECT mhd.refused('no sign-in', $q$SELECT public.write_down_heard(mhd.line('quote_text'), 'quote', current_date + 2)$q$, 'Sign in to write down a promise.');
SELECT mhd.as_user('00000000-0000-0000-0000-000000000bd6');
SELECT mhd.refused('a training account', $q$SELECT public.write_down_heard(mhd.line('quote_text'), 'quote', current_date + 2)$q$, 'A training account cannot write down a promise.');
SELECT mhd.as_user('00000000-0000-0000-0000-000000000bd7');
SELECT mhd.refused('a digital twin', $q$SELECT public.write_down_heard(mhd.line('quote_text'), 'quote', current_date + 2)$q$, 'A digital twin cannot write down a promise.');
SELECT mhd.as_user('00000000-0000-0000-0000-000000000bd4');
SELECT mhd.refused('a superintendent', $q$SELECT public.write_down_heard(mhd.line('quote_text'), 'quote', current_date + 2)$q$, 'Only the office team can write down a promise.');

-- 2 · Which lines and which kinds, in words, and nothing written by a refusal.
SELECT mhd.as_user('00000000-0000-0000-0000-000000000bd3');
SELECT mhd.refused('no day', $q$SELECT public.write_down_heard(mhd.line('quote_text'), 'quote', NULL)$q$, 'Say which day first.');
SELECT mhd.refused('a line that is not there', $q$SELECT public.write_down_heard('00000000-0000-0000-0000-0000000b1999', 'quote', current_date + 2)$q$, 'That line is not there.');
SELECT mhd.refused('our own text', $q$SELECT public.write_down_heard(mhd.line('our_text'), 'quote', current_date + 2)$q$, 'A day is written on their own text or voicemail.');
SELECT mhd.refused('their email', $q$SELECT public.write_down_heard(mhd.line('trade_mail'), 'quote', current_date + 2)$q$, 'A day is written on their own text or voicemail.');
SELECT mhd.refused('their call', $q$SELECT public.write_down_heard(mhd.line('trade_call'), 'start', current_date + 2)$q$, 'A day is written on their own text or voicemail.');
SELECT mhd.refused('a lead', $q$SELECT public.write_down_heard(mhd.line('lead_text'), 'decision', current_date + 2)$q$, 'Only a customer, a trade partner or an architect makes a promise here.');
SELECT mhd.refused('a payment goes through the sheet', $q$SELECT public.write_down_heard(mhd.line('pay_text'), 'payment', current_date + 2)$q$, 'A payment is written on the job.');
SELECT mhd.refused('a trade partner makes no answer on our bid', $q$SELECT public.write_down_heard(mhd.line('quote_text'), 'decision', current_date + 2)$q$, 'That is not a promise a trade partner makes.');
SELECT mhd.refused('a customer gives no quote', $q$SELECT public.write_down_heard(mhd.line('decide_text'), 'quote', current_date + 2)$q$, 'That is not a promise a customer makes.');
SELECT mhd.refused('an architect gives no start', $q$SELECT public.write_down_heard(mhd.line('arch_vm'), 'start', current_date + 2)$q$, 'That is not a promise an architect makes.');
SELECT mhd.refused('a start writes no W-9', $q$SELECT public.write_down_heard(mhd.line('start_vm'), 'start', current_date + 2, 'w9')$q$, 'A start or delivery writes a start or a delivery');
SELECT mhd.same('nothing was written by a refusal',
  concat_ws(' / ', mhd.promise(mhd.line('quote_text')), mhd.promise(mhd.line('our_text')), mhd.promise(mhd.line('lead_text')), mhd.promise(mhd.line('pay_text'))),
  'none / none / none / none');

-- 3 · Each person's kinds, written in one press with the day and Rosa's name; a double kind writes its first.
SELECT public.write_down_heard(mhd.line('quote_text'), 'quote', current_date + 2);
SELECT mhd.same('a trade partner''s quote', mhd.promise(mhd.line('quote_text')), 'quote|written|+2|-|Rosa|-');
SELECT public.write_down_heard(mhd.line('start_vm'), 'start', current_date + 7);
SELECT mhd.same('a start or delivery writes a start', mhd.promise(mhd.line('start_vm')), 'start|written|+7|start|Rosa|-');
SELECT public.write_down_heard(mhd.line('papers_text'), 'papers', current_date + 4, 'w9');
SELECT mhd.same('insurance or a W-9, told the W-9', mhd.promise(mhd.line('papers_text')), 'papers|written|+4|w9|Rosa|-');
SELECT public.write_down_heard(mhd.line('decide_text'), 'decision', current_date + 4);
SELECT mhd.same('a customer''s answer on our bid', mhd.promise(mhd.line('decide_text')), 'decision|written|+4|-|Rosa|-');
SELECT mhd.as_user('00000000-0000-0000-0000-000000000bd2');
SELECT public.write_down_heard(mhd.line('arch_vm'), 'cert', current_date + 3);
SELECT mhd.same('an architect''s certificate, by an estimator', mhd.promise(mhd.line('arch_vm')), 'cert|written|+3|-|Robert|-');

-- 4 · The same kind takes a new day; another kind over a written day is refused and leaves it.
SELECT public.write_down_heard(mhd.line('quote_text'), 'quote', current_date + 5);
SELECT mhd.same('a new day for the same quote', mhd.promise(mhd.line('quote_text')), 'quote|written|+5|-|Robert|-');
SELECT mhd.refused('another kind over a written day', $q$SELECT public.write_down_heard(mhd.line('quote_text'), 'start', current_date + 5)$q$, 'Someone has said what that day is already.');
SELECT mhd.refused('just talk over a written day', $q$SELECT public.write_down_heard(mhd.line('quote_text'), NULL, current_date + 5)$q$, 'Someone has said what that day is already.');
SELECT mhd.same('the quote stands', mhd.promise(mhd.line('quote_text')), 'quote|written|+5|-|Robert|-');

-- 5 · Over an offered day; just talk keeps its day; just talk can still be written as a kind after.
SELECT public.write_down_heard(mhd.line('offered_text'), 'quote', current_date + 6);
SELECT mhd.same('an offered day is written on the day picked', mhd.promise(mhd.line('offered_text')), 'quote|written|+6|-|Robert|-');
SELECT public.write_down_heard(mhd.line('papers_text'), 'papers', current_date + 4, 'w9');
SELECT mhd.refused('the payment line refuses a kind from the trade list', $q$SELECT public.write_down_heard(mhd.line('pay_text'), 'start', current_date + 2)$q$, 'That is not a promise a customer makes.');
SELECT public.write_down_heard(mhd.line('pay_text'), NULL, current_date + 4);
SELECT mhd.same('just talk keeps its day and no kind', mhd.promise(mhd.line('pay_text')), '-|no|+4|-|Robert|-');
SELECT public.write_down_heard(mhd.line('pay_text'), 'access', current_date + 4);
SELECT mhd.same('just talk can be written as a kind after', mhd.promise(mhd.line('pay_text')), 'access|written|+4|-|Robert|-');

-- 6 · A payment mark carries its job; a job that is not there is refused; called the old way it still runs.
SELECT mhd.as_user('00000000-0000-0000-0000-000000000bd3');
SELECT mhd.refused('a job that is not there', $q$SELECT public.write_down_payment(mhd.line('pay_rest'), current_date + 9, '00000000-0000-0000-0000-000000000b99')$q$, 'That job is not there.');
SELECT public.write_down_payment(mhd.line('pay_rest'), current_date + 9, '00000000-0000-0000-0000-000000000bb2');
SELECT mhd.same('the mark names its job', mhd.promise(mhd.line('pay_rest')), 'payment|written|+9|-|Rosa|back');
SELECT public.write_down_payment(mhd.line('pay_rest'), current_date + 10, '00000000-0000-0000-0000-000000000bb1');
SELECT mhd.same('a new word moves the mark to its job', mhd.promise(mhd.line('pay_rest')), 'payment|written|+10|-|Rosa|front');
SELECT public.write_down_payment(mhd.line('pay_rest'), current_date + 10);
SELECT mhd.same('called the old way, a mark names no job', mhd.promise(mhd.line('pay_rest')), 'payment|written|+10|-|Rosa|-');
SELECT public.write_down_payment(mhd.line('pay_rest'), current_date + 10, '00000000-0000-0000-0000-000000000bb1');
SELECT public.write_down_payment(mhd.line('pay_rest'));
SELECT mhd.same('a voided mark loses its job', mhd.promise(mhd.line('pay_rest')), '-|no|+10|-|Rosa|-');
SELECT mhd.refused('a payment mark over a quote is still refused', $q$SELECT public.write_down_payment(mhd.line('decide_text'), current_date + 3, '00000000-0000-0000-0000-000000000bb1')$q$, 'Someone has said what that day is already.');

RESET ROLE;
SELECT mhd.same('the written days the move line reads, one row a line',
  (SELECT count(*)::text FROM public.message_promises p JOIN public.messages m ON m.id = p.message_id
   WHERE m.contact_id = '00000000-0000-0000-0000-00000000b102' AND p.state = 'written' AND p.day >= current_date), '4');
DO $$ BEGIN RAISE NOTICE 'messages_heard_day PASSED'; END $$;
ROLLBACK;
