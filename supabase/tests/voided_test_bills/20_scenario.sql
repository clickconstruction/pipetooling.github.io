-- Presses nothing takes back (punch list #443, row 7): a voided test bill leaves a record (migration
-- *_voided_test_bills). voided_test_bills holds one row a voided bill of a ZZ test job, written by the edge function
-- void-stripe-invoice-for-revert as the service role right before it deletes the bill.
-- The table carries the four fences and grants a signed-in account SELECT alone. The function writes a record of
-- bill b1 with its Stripe email, then deletes the bill: the email's row goes with the bill and the record stands.
-- Devon the dev reads it. Rosa the assistant, Hal the helper, Ava who left and nobody signed in read nothing.
-- Nobody signed in writes one, Devon included, nor Tessa the dev in training mode, nor Twyla the twin. sends refuses
-- a value that is not a list and bill a value that is not an object. A second record for the same bill is refused,
-- and passed over when the function asks for that. Deleting the ZZ job takes its records.
-- Fixtures made as postgres; everything runs inside one transaction that rolls back. Raises on the first failed
-- assertion; ends with "voided_test_bills PASSED". See scripts/pgtest-voided-test-bills.sh. Never against prod.
-- Every person, job and address is made up.
\set ON_ERROR_STOP 1
BEGIN;

CREATE SCHEMA vtb;
CREATE FUNCTION vtb.id(p text) RETURNS uuid LANGUAGE sql IMMUTABLE AS $$ SELECT ('00000000-0000-0000-0000-0000004437' || p)::uuid $$;
CREATE FUNCTION vtb.same(label text, got text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF got IS DISTINCT FROM want THEN RAISE EXCEPTION E'% differs.\n--- got ---\n%\n--- want ---\n%', label, got, want; END IF;
  RAISE NOTICE 'ok: %', label;
END $$;
CREATE FUNCTION vtb.sign_in(p_user uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', p_user::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
END $$;
-- The claims the edge function's own client carries: the service role, and nobody signed in.
CREATE FUNCTION vtb.as_service() RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, true);
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claim.role', 'service_role', true);
END $$;
CREATE FUNCTION vtb.sign_out() RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', '', true);
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claim.role', '', true);
END $$;
-- What a statement does under the caller's rights: 'rows N', or the sqlstate it raised (42501 is a refusal).
CREATE FUNCTION vtb.try(p_sql text) RETURNS text LANGUAGE plpgsql AS $$
DECLARE n bigint;
BEGIN
  EXECUTE p_sql;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN 'rows ' || n;
EXCEPTION WHEN OTHERS THEN
  RETURN SQLSTATE;
END $$;
-- The records the caller reads, each by the last two hex digits of the bill it names.
CREATE FUNCTION vtb.reads() RETURNS text LANGUAGE sql AS $$
  SELECT coalesce(string_agg(right(invoice_id::text, 2), ' ' ORDER BY invoice_id), 'none') FROM public.voided_test_bills
$$;
-- The records that stand, past RLS, for the checks after a refused write.
CREATE FUNCTION vtb.stands() RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(string_agg(right(invoice_id::text, 2) || ':' || coalesce(stripe_action, '-'), ' ' ORDER BY invoice_id), 'none') FROM public.voided_test_bills
$$;
GRANT USAGE ON SCHEMA vtb TO anon, authenticated, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA vtb TO anon, authenticated, service_role;

-- Who: Devon the dev, Rosa the assistant, Hal the helper, Tessa a dev in training mode, Twyla a twin, Ava a dev who
-- left, Malachi the master both jobs are under.
INSERT INTO auth.users (id, email) VALUES
  (vtb.id('a1'), 'devon@voidedbills.test'), (vtb.id('a2'), 'rosa@voidedbills.test'), (vtb.id('a3'), 'hal@voidedbills.test'),
  (vtb.id('a4'), 'tessa@voidedbills.test'), (vtb.id('a5'), 'twyla@voidedbills.test'), (vtb.id('a6'), 'ava@voidedbills.test'),
  (vtb.id('a7'), 'malachi@voidedbills.test');
INSERT INTO public.users (id, email, name, role, read_only, is_digital_twin, archived_at) VALUES
  (vtb.id('a1'), 'devon@voidedbills.test', 'Devon Dev Vtb', 'dev', false, false, NULL),
  (vtb.id('a2'), 'rosa@voidedbills.test', 'Rosa Office Vtb', 'assistant', false, false, NULL),
  (vtb.id('a3'), 'hal@voidedbills.test', 'Hal Helper Vtb', 'helpers', false, false, NULL),
  (vtb.id('a4'), 'tessa@voidedbills.test', 'Tessa Trainee Vtb', 'dev', true, false, NULL),
  (vtb.id('a5'), 'twyla@voidedbills.test', 'Twyla Twin Vtb', 'estimator', false, true, NULL),
  (vtb.id('a6'), 'ava@voidedbills.test', 'Ava Away Vtb', 'dev', false, false, now()),
  (vtb.id('a7'), 'malachi@voidedbills.test', 'Malachi Master Vtb', 'master_technician', false, false, NULL)
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name, read_only = EXCLUDED.read_only,
    is_digital_twin = EXCLUDED.is_digital_twin, archived_at = EXCLUDED.archived_at;

-- Two ZZ Test jobs: d1 holds the bill that is voided, d2 a record that goes with its job at the end.
INSERT INTO public.service_types (id, name) VALUES (vtb.id('f0'), 'Voided bills bed work');
INSERT INTO public.jobs_ledger (id, master_user_id, service_type_id, hcp_number, job_name, customer_name, bill_to_party, revenue, payments_made, status) VALUES
  (vtb.id('d1'), vtb.id('a7'), vtb.id('f0'), 'J44371', 'ZZ Test voided bill job', 'ZZ Test Customer', 'customer', 1000, 0, 'billed'),
  (vtb.id('d2'), vtb.id('a7'), vtb.id('f0'), 'J44372', 'ZZ Test second voided bill job', 'ZZ Test Customer', 'customer', 1000, 0, 'billed');
-- Bill b1 on d1, billed through Stripe, with one row in the send log of its Stripe emails.
INSERT INTO public.jobs_ledger_invoices (id, job_id, sequence_order, status, amount, billed_at, stripe_invoice_id, external_send_channel) VALUES
  (vtb.id('b1'), vtb.id('d1'), 0, 'billed', 125.50, now(), 'in_test_vtb1', 'stripe');
INSERT INTO public.jobs_ledger_invoice_stripe_email_sends (id, jobs_ledger_invoice_id, sent_at, stripe_invoice_id) VALUES
  (vtb.id('e1'), vtb.id('b1'), now() - interval '1 hour', 'in_test_vtb1');

-- ---------------------------------------------------------------------------------------------------------------
-- 1. The structure.
SELECT vtb.same('the table carries the training-mode blocks, the twin fences and the archived seal', (
  SELECT count(*)::text FROM pg_policies
  WHERE schemaname = 'public' AND tablename = 'voided_test_bills'
    AND policyname IN ('read_only_users_cannot_insert', 'read_only_users_cannot_update', 'read_only_users_cannot_delete',
                       'digital_twin_write_fence_insert', 'digital_twin_write_fence_update', 'digital_twin_write_fence_delete', 'archived_fence')
), '7');
SELECT vtb.same('and the training-mode statement trigger', (
  SELECT count(*)::text FROM pg_trigger WHERE tgrelid = 'public.voided_test_bills'::regclass AND tgname = 'read_only_block_stmt' AND NOT tgisinternal
), '1');
SELECT vtb.same('the one policy that lets anyone in is the dev''s read', (
  SELECT string_agg(policyname || ' ' || cmd || ' ' || roles::text, ', ' ORDER BY policyname) FROM pg_policies
  WHERE schemaname = 'public' AND tablename = 'voided_test_bills' AND permissive = 'PERMISSIVE'
), 'voided_test_bills_select_dev SELECT {authenticated}');
SELECT vtb.same('row security is on', (SELECT relrowsecurity::text FROM pg_class WHERE oid = 'public.voided_test_bills'::regclass), 'true');
SELECT vtb.same('anon holds no right on the table', (
  has_table_privilege('anon', 'public.voided_test_bills', 'SELECT')::text || ' ' ||
  has_table_privilege('anon', 'public.voided_test_bills', 'INSERT')::text || ' ' ||
  has_table_privilege('anon', 'public.voided_test_bills', 'UPDATE')::text || ' ' ||
  has_table_privilege('anon', 'public.voided_test_bills', 'DELETE')::text
), 'false false false false');
SELECT vtb.same('a signed-in account may read and nothing more', (
  has_table_privilege('authenticated', 'public.voided_test_bills', 'SELECT')::text || ' ' ||
  has_table_privilege('authenticated', 'public.voided_test_bills', 'INSERT')::text || ' ' ||
  has_table_privilege('authenticated', 'public.voided_test_bills', 'UPDATE')::text || ' ' ||
  has_table_privilege('authenticated', 'public.voided_test_bills', 'DELETE')::text || ' ' ||
  has_table_privilege('authenticated', 'public.voided_test_bills', 'TRUNCATE')::text
), 'true false false false false');
SELECT vtb.same('the columns', (
  SELECT string_agg(column_name, ', ' ORDER BY ordinal_position) FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'voided_test_bills'
), 'id, invoice_id, job_id, bill, sends, stripe_invoice_id, stripe_action, voided_by, voided_by_name, voided_at');
SELECT vtb.same('a record goes with its job, and outlives the account that voided the bill', (
  SELECT string_agg(a.attname || ' ' || c.confdeltype::text, ', ' ORDER BY a.attname)
  FROM pg_constraint c JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
  WHERE c.conrelid = 'public.voided_test_bills'::regclass AND c.contype = 'f'
), 'job_id c, voided_by n');
SELECT vtb.same('the bill''s id is no foreign key, and is unique', (
  SELECT count(*)::text FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'voided_test_bills' AND indexname = 'voided_test_bills_invoice_key' AND indexdef LIKE 'CREATE UNIQUE INDEX%(invoice_id)'
), '1');

-- ---------------------------------------------------------------------------------------------------------------
-- 2. The function's door. As the service role it copies bill b1 and its Stripe email into a record, then deletes
-- the bill, as void-stripe-invoice-for-revert does. The email's row goes with the bill. The record stands.
SET LOCAL ROLE service_role;
SELECT vtb.as_service();
SELECT vtb.same('the function writes the record of bill b1', vtb.try(format($q$
  INSERT INTO public.voided_test_bills (invoice_id, job_id, bill, sends, stripe_invoice_id, stripe_action, voided_by, voided_by_name)
  SELECT b.id, b.job_id, to_jsonb(b),
    (SELECT coalesce(jsonb_agg(jsonb_build_object('source', 'stripe_email', 'id', s.id, 'sent_at', s.sent_at, 'stripe_invoice_id', s.stripe_invoice_id, 'copy_emails', '[]'::jsonb) ORDER BY s.sent_at), '[]'::jsonb)
       FROM public.jobs_ledger_invoice_stripe_email_sends s WHERE s.jobs_ledger_invoice_id = b.id),
    b.stripe_invoice_id, 'void', %L::uuid, 'Devon Dev Vtb'
  FROM public.jobs_ledger_invoices b WHERE b.id = %L::uuid
$q$, vtb.id('a1'), vtb.id('b1'))), 'rows 1');
SELECT vtb.same('then deletes the bill', vtb.try(format($q$DELETE FROM public.jobs_ledger_invoices WHERE id = %L$q$, vtb.id('b1'))), 'rows 1');
RESET ROLE;
SELECT vtb.same('the row of the bill''s Stripe email went with the bill', (SELECT count(*)::text FROM public.jobs_ledger_invoice_stripe_email_sends WHERE id = vtb.id('e1')), '0');
SELECT vtb.same('the record stands, with the bill as it stood and its one send', (
  SELECT (bill ->> 'amount') || ' / ' || (bill ->> 'status') || ' / ' || (bill ->> 'stripe_invoice_id') || ' / ' || jsonb_array_length(sends)::text || ' send / ' || (sends -> 0 ->> 'source')
      || ' / ' || stripe_action || ' / ' || voided_by_name || ' / ' || (voided_at > now() - interval '1 hour')::text
  FROM public.voided_test_bills WHERE invoice_id = vtb.id('b1')
), '125.50 / billed / in_test_vtb1 / 1 send / stripe_email / void / Devon Dev Vtb / true');

-- What the table refuses the function itself.
SET LOCAL ROLE service_role;
SELECT vtb.as_service();
SELECT vtb.same('sends refuses a value that is not a list', vtb.try(format($q$
  INSERT INTO public.voided_test_bills (invoice_id, job_id, bill, sends) VALUES (%L, %L, '{"id":"x"}'::jsonb, '{"source":"stripe_email"}'::jsonb)
$q$, vtb.id('b7'), vtb.id('d1'))), '23514');
SELECT vtb.same('bill refuses a value that is not an object', vtb.try(format($q$
  INSERT INTO public.voided_test_bills (invoice_id, job_id, bill) VALUES (%L, %L, '[]'::jsonb)
$q$, vtb.id('b7'), vtb.id('d1'))), '23514');
SELECT vtb.same('a record with no bill is refused', vtb.try(format($q$
  INSERT INTO public.voided_test_bills (invoice_id, job_id) VALUES (%L, %L)
$q$, vtb.id('b7'), vtb.id('d1'))), '23502');
SELECT vtb.same('a second record for the same bill is refused', vtb.try(format($q$
  INSERT INTO public.voided_test_bills (invoice_id, job_id, bill, stripe_action) VALUES (%L, %L, '{"id":"again"}'::jsonb, 'noop')
$q$, vtb.id('b1'), vtb.id('d1'))), '23505');
SELECT vtb.same('and passed over when the function asks for that, as its second try does', vtb.try(format($q$
  INSERT INTO public.voided_test_bills (invoice_id, job_id, bill, stripe_action) VALUES (%L, %L, '{"id":"again"}'::jsonb, 'noop')
  ON CONFLICT (invoice_id) DO NOTHING
$q$, vtb.id('b1'), vtb.id('d1'))), 'rows 0');
SELECT vtb.same('a record on a job that is not there is refused', vtb.try(format($q$
  INSERT INTO public.voided_test_bills (invoice_id, job_id, bill) VALUES (%L, %L, '{"id":"x"}'::jsonb)
$q$, vtb.id('b7'), vtb.id('ff'))), '23503');
SELECT vtb.same('the function writes a record on the second job, with no send', vtb.try(format($q$
  INSERT INTO public.voided_test_bills (invoice_id, job_id, bill, stripe_action) VALUES (%L, %L, '{"id":"b2","amount":80}'::jsonb, 'db_only_no_stripe_id')
$q$, vtb.id('b2'), vtb.id('d2'))), 'rows 1');
RESET ROLE;
SELECT vtb.same('two records stand, the first as it was first written', vtb.stands(), 'b1:void b2:db_only_no_stripe_id');
SELECT vtb.same('a record with no sends holds an empty list', (SELECT sends::text FROM public.voided_test_bills WHERE invoice_id = vtb.id('b2')), '[]');

-- ---------------------------------------------------------------------------------------------------------------
-- 3. Who reads a record: a dev, and nobody else.
SET LOCAL ROLE authenticated;
SELECT vtb.sign_in(vtb.id('a1'));
SELECT vtb.same('Devon the dev reads both records', vtb.reads(), 'b1 b2');
SELECT vtb.sign_in(vtb.id('a2'));
SELECT vtb.same('Rosa the assistant reads none', vtb.reads(), 'none');
SELECT vtb.sign_in(vtb.id('a3'));
SELECT vtb.same('Hal the helper reads none', vtb.reads(), 'none');
SELECT vtb.sign_in(vtb.id('a7'));
SELECT vtb.same('Malachi, the master the job is under, reads none', vtb.reads(), 'none');
SELECT vtb.sign_in(vtb.id('a5'));
SELECT vtb.same('Twyla the twin reads none', vtb.reads(), 'none');
SELECT vtb.sign_in(vtb.id('a4'));
SELECT vtb.same('Tessa, a dev in training mode, reads both', vtb.reads(), 'b1 b2');
SELECT vtb.sign_in(vtb.id('a6'));
SELECT vtb.same('Ava, a dev who left, reads none', vtb.reads(), 'none');
RESET ROLE;
SELECT vtb.sign_out();
SET LOCAL ROLE anon;
SELECT vtb.same('nobody signed in reads the table', vtb.try($q$SELECT 1 FROM public.voided_test_bills$q$), '42501');
SELECT vtb.same('nobody signed in writes it', vtb.try(format($q$
  INSERT INTO public.voided_test_bills (invoice_id, job_id, bill) VALUES (%L, %L, '{"id":"x"}'::jsonb)
$q$, vtb.id('b8'), vtb.id('d1'))), '42501');
RESET ROLE;

-- ---------------------------------------------------------------------------------------------------------------
-- 4. Nobody signed in writes a record: the function is the one door. Devon the dev, Rosa the assistant, Tessa in
-- training mode and Twyla the twin each try the three writes.
SET LOCAL ROLE authenticated;
DO $$
DECLARE
  who record;
  ins text := format($q$INSERT INTO public.voided_test_bills (invoice_id, job_id, bill) VALUES (%L, %L, '{"id":"x"}'::jsonb)$q$, vtb.id('b9'), vtb.id('d1'));
  upd text := format($q$UPDATE public.voided_test_bills SET voided_by_name = 'Somebody else' WHERE invoice_id = %L$q$, vtb.id('b1'));
  del text := format($q$DELETE FROM public.voided_test_bills WHERE invoice_id = %L$q$, vtb.id('b1'));
BEGIN
  FOR who IN SELECT * FROM (VALUES ('a1', 'Devon the dev'), ('a2', 'Rosa the assistant'), ('a4', 'Tessa in training mode'), ('a5', 'Twyla the twin')) AS t(tail, name) LOOP
    PERFORM vtb.sign_in(vtb.id(who.tail));
    PERFORM vtb.same(who.name || ' cannot write a record by hand', vtb.try(ins), '42501');
    PERFORM vtb.same(who.name || ' cannot change a record', vtb.try(upd), '42501');
    PERFORM vtb.same(who.name || ' cannot remove a record', vtb.try(del), '42501');
  END LOOP;
END $$;
RESET ROLE;
SELECT vtb.same('nothing changed: both records stand as written', vtb.stands(), 'b1:void b2:db_only_no_stripe_id');
SELECT vtb.same('and the first still names who voided it', (SELECT voided_by_name FROM public.voided_test_bills WHERE invoice_id = vtb.id('b1')), 'Devon Dev Vtb');

-- ---------------------------------------------------------------------------------------------------------------
-- 5. What goes with what. Deleting the second ZZ job takes its record and leaves the other job's.
DELETE FROM public.jobs_ledger WHERE id = vtb.id('d2');
SELECT vtb.same('a deleted job takes its record, and only its own', vtb.stands(), 'b1:void');
DELETE FROM public.jobs_ledger WHERE id = vtb.id('d1');
SELECT vtb.same('the first job takes the last record', vtb.stands(), 'none');

DO $$ BEGIN RAISE NOTICE 'voided_test_bills PASSED'; END $$;
ROLLBACK;
