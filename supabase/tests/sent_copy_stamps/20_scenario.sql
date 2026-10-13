-- The small print under the app's own emails in a thread (Messages, residential R8 · 1, migration *_sent_copy_stamps):
-- sent_copy_stamps reads each sent copy's from and opened off email_send_log by its resend id, and, for a copy of a paid
-- bill, the newest payment's day and how. The office reads them; anyone else reads no rows. The copies, the log, the
-- bills and the payments are written as postgres, standing in for the email functions; reads run as each user;
-- everything rolls back. Raises on the first failed assertion; ends with "sent_copy_stamps PASSED". See
-- scripts/pgtest-sent-copy-stamps.sh. Never against prod.
\set ON_ERROR_STOP 1
BEGIN;

-- The owner, whose job the bills are on; the office (an assistant); and an estimator outside it.
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-000000005ad1', 'owner@stamps.test'),
  ('00000000-0000-0000-0000-000000005ad2', 'assistant@stamps.test'),
  ('00000000-0000-0000-0000-000000005ad3', 'estimator@stamps.test');
INSERT INTO public.users (id, email, name, role, read_only, is_digital_twin) VALUES
  ('00000000-0000-0000-0000-000000005ad1', 'owner@stamps.test', 'Stamps Owner', 'master_technician', false, false),
  ('00000000-0000-0000-0000-000000005ad2', 'assistant@stamps.test', 'Rosa', 'assistant', false, false),
  ('00000000-0000-0000-0000-000000005ad3', 'estimator@stamps.test', 'Stamps Estimator', 'estimator', false, false)
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name, read_only = EXCLUDED.read_only, is_digital_twin = EXCLUDED.is_digital_twin;

CREATE SCHEMA scs;
CREATE FUNCTION scs.same(label text, got text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF got IS DISTINCT FROM want THEN RAISE EXCEPTION E'% differs.\n--- got ---\n%\n--- want ---\n%', label, got, want; END IF;
  RAISE NOTICE 'ok: %', label;
END $$;
CREATE FUNCTION scs.as_user(p_user uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', p_user::text, true);
END $$;
-- One read as words, one copy a line by its id's last two digits: "s1 office@… 10-10 23:12 2026-10-11 card", "-" for null.
CREATE FUNCTION scs.read(p_ids uuid[]) RETURNS text LANGUAGE sql AS $$
  SELECT coalesce(string_agg(
    concat_ws(' ', 's' || right(id::text, 1), coalesce(from_email, '-'),
      coalesce(to_char(opened_at AT TIME ZONE 'UTC', 'MM-DD HH24:MI'), '-'), coalesce(paid_on::text, '-'), coalesce(paid_how, '-')),
    E'\n' ORDER BY id), '')
  FROM public.sent_copy_stamps(p_ids)
$$;
GRANT USAGE ON SCHEMA scs TO anon, authenticated, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA scs TO anon, authenticated, service_role;

-- One job of the owner's, carrying no customer, as the billing beds' jobs do: bill A paid with two payments, bill B
-- billed and not paid, bill C paid with a payment typed with no paid day, entered Oct 12 at 03:30 UTC, which is Oct 11
-- in Chicago.
INSERT INTO public.service_types (id, name) VALUES ('00000000-0000-0000-0000-000000005a01', 'Stamps Bed Work');
INSERT INTO public.jobs_ledger (id, master_user_id, service_type_id, job_name, billing_only) VALUES
  ('00000000-0000-0000-0000-000000005aa1', '00000000-0000-0000-0000-000000005ad1', '00000000-0000-0000-0000-000000005a01', 'Oakridge sewer line', true);
INSERT INTO public.jobs_ledger_invoices (id, job_id, sequence_order, status, amount) VALUES
  ('00000000-0000-0000-0000-000000005ab1', '00000000-0000-0000-0000-000000005aa1', 0, 'paid', 4850),
  ('00000000-0000-0000-0000-000000005ab2', '00000000-0000-0000-0000-000000005aa1', 1, 'billed', 300),
  ('00000000-0000-0000-0000-000000005ab3', '00000000-0000-0000-0000-000000005aa1', 2, 'paid', 120);
INSERT INTO public.jobs_ledger_payments (id, job_id, invoice_id, amount, paid_on, payment_type, created_at) VALUES
  ('00000000-0000-0000-0000-000000005af1', '00000000-0000-0000-0000-000000005aa1', '00000000-0000-0000-0000-000000005ab1', 2000, '2026-10-09', 'Check', TIMESTAMPTZ '2026-10-09 15:00:00+00'),
  ('00000000-0000-0000-0000-000000005af2', '00000000-0000-0000-0000-000000005aa1', '00000000-0000-0000-0000-000000005ab1', 2850, '2026-10-11', 'card', TIMESTAMPTZ '2026-10-11 16:00:00+00'),
  ('00000000-0000-0000-0000-000000005af3', '00000000-0000-0000-0000-000000005aa1', '00000000-0000-0000-0000-000000005ab3', 120, NULL, 'Cash', TIMESTAMPTZ '2026-10-12 03:30:00+00');

-- The copies the app sent with nobody pressing Send: 1 bill A, opened; 2 an estimate, only delivered; 3 bill B, clicked;
-- 4 a printed page, no email and no log; 5 bill C, its log row not written yet.
INSERT INTO public.sent_documents (id, kind, title, how, recipient_emails, subject, source_table, source_id, resend_email_id, sent_at) VALUES
  ('00000000-0000-0000-0000-000000005ae1', 'bill', 'Invoice 1312', 'email', '{dana@example.test}', 'Invoice 1312', 'jobs_ledger_invoices', '00000000-0000-0000-0000-000000005ab1', 're_stamps_1', TIMESTAMPTZ '2026-10-10 22:00:00+00'),
  ('00000000-0000-0000-0000-000000005ae2', 'estimate', 'Estimate for Oakridge sewer line', 'email', '{dana@example.test}', 'Your estimate', 'estimates', NULL, 're_stamps_2', TIMESTAMPTZ '2026-10-06 19:20:00+00'),
  ('00000000-0000-0000-0000-000000005ae3', 'bill', 'Invoice 1312-2', 'email', '{dana@example.test}', 'Invoice 1312-2', 'jobs_ledger_invoices', '00000000-0000-0000-0000-000000005ab2', 're_stamps_3', TIMESTAMPTZ '2026-10-12 14:00:00+00'),
  ('00000000-0000-0000-0000-000000005ae4', 'job_sheet', 'Job sheet 1312', 'print', '{}', '', '', NULL, NULL, TIMESTAMPTZ '2026-10-07 13:00:00+00'),
  ('00000000-0000-0000-0000-000000005ae5', 'bill', 'Invoice 1312-3', 'email', '{dana@example.test}', 'Invoice 1312-3', 'jobs_ledger_invoices', '00000000-0000-0000-0000-000000005ab3', 're_stamps_5', TIMESTAMPTZ '2026-10-11 20:00:00+00');
INSERT INTO public.email_send_log (resend_email_id, from_email, to_emails, subject, last_event, last_event_at, sent_at) VALUES
  ('re_stamps_1', 'office@clickplumbing.test', '{dana@example.test}', 'Invoice 1312', 'opened', TIMESTAMPTZ '2026-10-10 23:12:00+00', TIMESTAMPTZ '2026-10-10 22:00:00+00'),
  ('re_stamps_2', 'office@clickplumbing.test', '{dana@example.test}', 'Your estimate', 'delivered', TIMESTAMPTZ '2026-10-06 19:21:00+00', TIMESTAMPTZ '2026-10-06 19:20:00+00'),
  ('re_stamps_3', 'billing@clickplumbing.test', '{dana@example.test}', 'Invoice 1312-2', 'clicked', TIMESTAMPTZ '2026-10-12 15:40:00+00', TIMESTAMPTZ '2026-10-12 14:00:00+00');

-- 1 · The office reads each copy it asks for, a copy with nothing to say included.
SELECT scs.as_user('00000000-0000-0000-0000-000000005ad2');
SET LOCAL ROLE authenticated;
SELECT scs.same('from, opened and paid for each copy asked for',
  scs.read(ARRAY[
    '00000000-0000-0000-0000-000000005ae1', '00000000-0000-0000-0000-000000005ae2', '00000000-0000-0000-0000-000000005ae3',
    '00000000-0000-0000-0000-000000005ae4', '00000000-0000-0000-0000-000000005ae5']::uuid[]),
  concat_ws(E'\n',
    -- Bill A: opened, paid by the newest payment, not the first.
    's1 office@clickplumbing.test 10-10 23:12 2026-10-11 card',
    -- The estimate: delivered is not opened, and it carried no bill.
    's2 office@clickplumbing.test - - -',
    -- Bill B: a click reads as opened, and a bill not paid says nothing of paying.
    's3 billing@clickplumbing.test 10-12 15:40 - -',
    -- The printed page: nothing to say, and still a row.
    's4 - - - -',
    -- Bill C: no log row yet; its payment had no paid day, so the day it was entered, in Chicago.
    's5 - - 2026-10-11 Cash'));
SELECT scs.same('only the copies asked for, and none for an id no copy has',
  scs.read(ARRAY['00000000-0000-0000-0000-000000005ae2', '00000000-0000-0000-0000-0000000059ff']::uuid[]),
  's2 office@clickplumbing.test - - -');
SELECT scs.same('an empty ask reads nothing', scs.read(ARRAY[]::uuid[]), '');
RESET ROLE;

-- 2 · Anyone who may not read sent_documents reads no rows.
SELECT scs.as_user('00000000-0000-0000-0000-000000005ad3');
SET LOCAL ROLE authenticated;
SELECT scs.same('an estimator reads no stamps',
  scs.read(ARRAY['00000000-0000-0000-0000-000000005ae1', '00000000-0000-0000-0000-000000005ae3']::uuid[]), '');
RESET ROLE;

-- 3 · As shipped: anon cannot run it, the office can, and it reads as its definer.
SELECT scs.same('who runs it', (
  SELECT has_function_privilege('anon', 'public.sent_copy_stamps(uuid[])', 'EXECUTE')::text || '/'
    || has_function_privilege('authenticated', 'public.sent_copy_stamps(uuid[])', 'EXECUTE')::text || '/'
    || (SELECT prosecdef::text FROM pg_proc WHERE oid = 'public.sent_copy_stamps(uuid[])'::regprocedure)),
  'false/true/true');

DO $$ BEGIN RAISE NOTICE 'sent_copy_stamps PASSED'; END $$;
ROLLBACK;
