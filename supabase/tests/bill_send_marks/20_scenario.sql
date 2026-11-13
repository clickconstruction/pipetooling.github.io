-- Whether each send of a bill arrived (Bills sent, punch list #327, PR 3, migration *_bill_send_marks): bill_send_marks
-- reads each sent copy's last delivery event and its type off email_send_log by its resend id, and, for a copy of a paid
-- bill, the newest payment's day and how. The office reads them; anyone else reads no rows. The copies, the log, the
-- bills and the payments are written as postgres, standing in for the email functions; reads run as each user;
-- everything rolls back. Raises on the first failed assertion; ends with "bill_send_marks PASSED". See
-- scripts/pgtest-bill-send-marks.sh. Never against prod. Every name here is made up.
\set ON_ERROR_STOP 1
BEGIN;

-- The owner, whose job the bills are on; the office (the controller, who reads no bill row of the log by its policies);
-- and an estimator outside it.
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-00000000b5d1', 'owner@marks.test'),
  ('00000000-0000-0000-0000-00000000b5d2', 'controller@marks.test'),
  ('00000000-0000-0000-0000-00000000b5d3', 'estimator@marks.test');
INSERT INTO public.users (id, email, name, role, read_only, is_digital_twin) VALUES
  ('00000000-0000-0000-0000-00000000b5d1', 'owner@marks.test', 'Marks Owner', 'master_technician', false, false),
  ('00000000-0000-0000-0000-00000000b5d2', 'controller@marks.test', 'Marks Controller', 'controller', false, false),
  ('00000000-0000-0000-0000-00000000b5d3', 'estimator@marks.test', 'Marks Estimator', 'estimator', false, false)
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name, read_only = EXCLUDED.read_only, is_digital_twin = EXCLUDED.is_digital_twin;

CREATE SCHEMA bsm;
CREATE FUNCTION bsm.same(label text, got text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF got IS DISTINCT FROM want THEN RAISE EXCEPTION E'% differs.\n--- got ---\n%\n--- want ---\n%', label, got, want; END IF;
  RAISE NOTICE 'ok: %', label;
END $$;
CREATE FUNCTION bsm.as_user(p_user uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', p_user::text, true);
END $$;
-- One read as words, one copy a line by its id's last digit: "m1 delivered 11-03 22:41 stripe_bill 2026-11-09 card", "-" for null.
CREATE FUNCTION bsm.read(p_ids uuid[]) RETURNS text LANGUAGE sql AS $$
  SELECT coalesce(string_agg(
    concat_ws(' ', 'm' || right(id::text, 1), coalesce(last_event, '-'),
      coalesce(to_char(last_event_at AT TIME ZONE 'UTC', 'MM-DD HH24:MI'), '-'), coalesce(email_type, '-'), coalesce(paid_on::text, '-'), coalesce(paid_how, '-')),
    E'\n' ORDER BY id), '')
  FROM public.bill_send_marks(p_ids)
$$;
GRANT USAGE ON SCHEMA bsm TO anon, authenticated, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA bsm TO anon, authenticated, service_role;

-- One job of the owner's: bill A paid by card on Nov 9, bill B billed and not paid.
INSERT INTO public.service_types (id, name) VALUES ('00000000-0000-0000-0000-00000000b501', 'Marks Bed Work');
INSERT INTO public.jobs_ledger (id, master_user_id, service_type_id, job_name, billing_only) VALUES
  ('00000000-0000-0000-0000-00000000b5a1', '00000000-0000-0000-0000-00000000b5d1', '00000000-0000-0000-0000-00000000b501', 'Juniper Bend repipe', true);
INSERT INTO public.jobs_ledger_invoices (id, job_id, sequence_order, status, amount) VALUES
  ('00000000-0000-0000-0000-00000000b5b1', '00000000-0000-0000-0000-00000000b5a1', 0, 'paid', 4860),
  ('00000000-0000-0000-0000-00000000b5b2', '00000000-0000-0000-0000-00000000b5a1', 1, 'billed', 2965);
INSERT INTO public.jobs_ledger_payments (id, job_id, invoice_id, amount, paid_on, payment_type, created_at) VALUES
  ('00000000-0000-0000-0000-00000000b5f1', '00000000-0000-0000-0000-00000000b5a1', '00000000-0000-0000-0000-00000000b5b1', 4860, '2026-11-09', 'card', TIMESTAMPTZ '2026-11-09 16:00:00+00');

-- The copies: 1 bill A, delivered then paid; 2 bill B, bounced; 3 bill B sent again, opened; 4 a statement that went on
-- the schedule; 5 a printed pay sheet, no email and no log; 6 bill B a third time, its log row not written yet.
INSERT INTO public.sent_documents (id, kind, title, how, recipient_emails, subject, source_table, source_id, resend_email_id, sent_at) VALUES
  ('00000000-0000-0000-0000-00000000b5e1', 'bill', 'Invoice 1412-1', 'email', '{hal@example.test}', 'Invoice 1412-1', 'jobs_ledger_invoices', '00000000-0000-0000-0000-00000000b5b1', 're_marks_1', TIMESTAMPTZ '2026-11-03 22:41:00+00'),
  ('00000000-0000-0000-0000-00000000b5e2', 'bill', 'Invoice 1412-2', 'email', '{ines@example.test}', 'Invoice 1412-2', 'jobs_ledger_invoices', '00000000-0000-0000-0000-00000000b5b2', 're_marks_2', TIMESTAMPTZ '2026-11-11 22:47:00+00'),
  ('00000000-0000-0000-0000-00000000b5e3', 'bill', 'Invoice 1412-2', 'email', '{ines@example.test}', 'Invoice 1412-2', 'jobs_ledger_invoices', '00000000-0000-0000-0000-00000000b5b2', 're_marks_3', TIMESTAMPTZ '2026-11-12 15:28:00+00'),
  ('00000000-0000-0000-0000-00000000b5e4', 'gc_statement', 'Statement for Ridgeway Builders', 'email', '{billing@example.test}', 'Statement', '', NULL, 're_marks_4', TIMESTAMPTZ '2026-11-12 13:00:00+00'),
  ('00000000-0000-0000-0000-00000000b5e5', 'bill_pay_code', 'Pay code', 'print', '{}', '', 'jobs_ledger_invoices', '00000000-0000-0000-0000-00000000b5b2', NULL, TIMESTAMPTZ '2026-11-12 15:05:00+00'),
  ('00000000-0000-0000-0000-00000000b5e6', 'bill', 'Invoice 1412-2', 'email', '{ines@example.test}', 'Invoice 1412-2', 'jobs_ledger_invoices', '00000000-0000-0000-0000-00000000b5b2', 're_marks_6', TIMESTAMPTZ '2026-11-12 20:00:00+00');
INSERT INTO public.email_send_log (resend_email_id, from_email, to_emails, subject, last_event, last_event_at, sent_at, email_type) VALUES
  ('re_marks_1', 'office@marks.test', '{hal@example.test}', 'Invoice 1412-1', 'delivered', TIMESTAMPTZ '2026-11-03 22:41:00+00', TIMESTAMPTZ '2026-11-03 22:41:00+00', 'stripe_bill'),
  ('re_marks_2', 'office@marks.test', '{ines@example.test}', 'Invoice 1412-2', 'bounced', TIMESTAMPTZ '2026-11-11 22:47:00+00', TIMESTAMPTZ '2026-11-11 22:47:00+00', 'stripe_bill'),
  ('re_marks_3', 'office@marks.test', '{ines@example.test}', 'Invoice 1412-2', 'opened', TIMESTAMPTZ '2026-11-12 15:41:00+00', TIMESTAMPTZ '2026-11-12 15:28:00+00', 'stripe_bill'),
  ('re_marks_4', 'office@marks.test', '{billing@example.test}', 'Statement', 'delivered', TIMESTAMPTZ '2026-11-12 13:00:00+00', TIMESTAMPTZ '2026-11-12 13:00:00+00', 'gc_statement_scheduled');

-- 1 · The office reads each copy it asks for, a copy with nothing to say included. The controller reads no bill row of
-- the log by the log's own policies, and reads the marks here.
SELECT bsm.as_user('00000000-0000-0000-0000-00000000b5d2');
SET LOCAL ROLE authenticated;
SELECT bsm.same('the controller cannot read a bill row of the log itself',
  (SELECT count(*)::text FROM public.email_send_log WHERE resend_email_id IN ('re_marks_1', 're_marks_2', 're_marks_3')), '0');
SELECT bsm.same('the last event, its type and the paid day for each copy asked for',
  bsm.read(ARRAY[
    '00000000-0000-0000-0000-00000000b5e1', '00000000-0000-0000-0000-00000000b5e2', '00000000-0000-0000-0000-00000000b5e3',
    '00000000-0000-0000-0000-00000000b5e4', '00000000-0000-0000-0000-00000000b5e5', '00000000-0000-0000-0000-00000000b5e6']::uuid[]),
  concat_ws(E'\n',
    -- Bill A: delivered, and paid since.
    'm1 delivered 11-03 22:41 stripe_bill 2026-11-09 card',
    -- Bill B: the first send bounced, and the bill is not paid.
    'm2 bounced 11-11 22:47 stripe_bill - -',
    -- Bill B sent again: opened is the last word, at the time it was opened.
    'm3 opened 11-12 15:41 stripe_bill - -',
    -- The statement: it went on the schedule, and names no bill.
    'm4 delivered 11-12 13:00 gc_statement_scheduled - -',
    -- The printed pay sheet: no email, so nothing to say, and still a row.
    'm5 - - - - -',
    -- Bill B a third time: no log row yet, so not known.
    'm6 - - - - -'));
SELECT bsm.same('only the copies asked for, and none for an id no copy has',
  bsm.read(ARRAY['00000000-0000-0000-0000-00000000b5e2', '00000000-0000-0000-0000-00000000b4ff']::uuid[]),
  'm2 bounced 11-11 22:47 stripe_bill - -');
SELECT bsm.same('an empty ask reads nothing', bsm.read(ARRAY[]::uuid[]), '');
RESET ROLE;

-- 2 · The owner reads the same marks.
SELECT bsm.as_user('00000000-0000-0000-0000-00000000b5d1');
SET LOCAL ROLE authenticated;
SELECT bsm.same('the owner reads a bounce',
  bsm.read(ARRAY['00000000-0000-0000-0000-00000000b5e2']::uuid[]), 'm2 bounced 11-11 22:47 stripe_bill - -');
RESET ROLE;

-- 3 · Anyone who may not read sent_documents reads no rows.
SELECT bsm.as_user('00000000-0000-0000-0000-00000000b5d3');
SET LOCAL ROLE authenticated;
SELECT bsm.same('an estimator reads no marks',
  bsm.read(ARRAY['00000000-0000-0000-0000-00000000b5e1', '00000000-0000-0000-0000-00000000b5e2']::uuid[]), '');
RESET ROLE;

-- 4 · As shipped: anon cannot run it, the office can, and it reads as its definer.
SELECT bsm.same('who runs it', (
  SELECT has_function_privilege('anon', 'public.bill_send_marks(uuid[])', 'EXECUTE')::text || '/'
    || has_function_privilege('authenticated', 'public.bill_send_marks(uuid[])', 'EXECUTE')::text || '/'
    || (SELECT prosecdef::text FROM pg_proc WHERE oid = 'public.bill_send_marks(uuid[])'::regprocedure)),
  'false/true/true');

DO $$ BEGIN RAISE NOTICE 'bill_send_marks PASSED'; END $$;
ROLLBACK;
