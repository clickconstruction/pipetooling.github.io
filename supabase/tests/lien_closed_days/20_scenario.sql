-- A lien day that passed with nothing filed stays listed until someone answers it (v2.7817,
-- 20261118230000_lien_closed_days.sql). Two things are proved on the same rows:
--   · list_lien_affidavit_windows answers what it answered before: the same rows, in the same order, for every ask,
--     against the body 20261113200000 left (kept here as list_lien_affidavit_windows_before);
--   · list_lien_closed_days lists a job from the eighth day after its last day to file, with the row the windows
--     reader gave it while it still listed it, and drops it once it is filed, off the lien path, Uncollectible, paid,
--     or its last day of work is corrected.
-- One transaction that rolls back; raises on the first failed assertion; ends with "lien_closed_days PASSED".
-- See scripts/pgtest-lien-closed-days.sh. Never against prod.
\set ON_ERROR_STOP on
BEGIN;

CREATE SCHEMA bedt;
CREATE FUNCTION bedt.ok(label text, pass boolean) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF pass IS NOT TRUE THEN RAISE EXCEPTION 'FAILED: %', label; END IF;
  RAISE NOTICE 'ok: %', label;
END $$;
CREATE FUNCTION bedt.id(n text) RETURNS uuid LANGUAGE sql IMMUTABLE AS
  $$ SELECT ('00000000-0000-0000-0000-' || lpad(n, 12, '0'))::uuid $$;
-- A job's number back from its id: "13".
CREATE FUNCTION bedt.n(job uuid) RETURNS text LANGUAGE sql IMMUTABLE AS
  $$ SELECT ltrim(right(job::text, 12), '0') $$;
-- A billed job under the GC, $5,000 open, made May 2, on the commercial property unless another is named.
CREATE FUNCTION bedt.job(n text, hand date DEFAULT NULL, address text DEFAULT '800') RETURNS void LANGUAGE sql AS $$
  INSERT INTO public.jobs_ledger (id, hcp_number, customer_id, gc_customer_id, customer_address_id, status, revenue, payments_made, created_at, lien_last_work_on)
  VALUES (bedt.id(n), n, bedt.id('901'), bedt.id('900'), bedt.id(address), 'billed', 5000, 0, '2026-05-02T15:00:00Z', hand)
$$;
-- Eight approved hours on a day.
CREATE FUNCTION bedt.hours(job text, day date) RETURNS void LANGUAGE sql AS $$
  INSERT INTO public.clock_sessions (job_ledger_id, work_date, clocked_in_at, clocked_out_at, approved_at)
  VALUES (bedt.id(job), day, day::timestamptz + interval '13 hours', day::timestamptz + interval '21 hours', day::timestamptz + interval '2 days')
$$;
-- The windows reader's jobs in its own order, each with its day: "1 2026-10-15, 2 2026-11-16".
CREATE FUNCTION bedt.windows(p integer) RETURNS text LANGUAGE sql AS
  $$ SELECT coalesce(string_agg(bedt.n(w.job_id) || ' ' || w.deadline, ', ' ORDER BY w.ordinality), '') FROM public.list_lien_affidavit_windows(p) WITH ORDINALITY AS w $$;
-- The closed days in their own order, each with its day and where its month came from: "3 2026-09-15 hand".
CREATE FUNCTION bedt.closed() RETURNS text LANGUAGE sql AS
  $$ SELECT coalesce(string_agg(bedt.n(c.job_id) || ' ' || c.deadline || ' ' || c.month_source, ', ' ORDER BY c.ordinality), '') FROM public.list_lien_closed_days() WITH ORDINALITY AS c $$;
-- Is a job a closed day?
CREATE FUNCTION bedt.listed(job text) RETURNS boolean LANGUAGE sql AS
  $$ SELECT EXISTS (SELECT 1 FROM public.list_lien_closed_days() c WHERE c.job_id = bedt.id(job)) $$;
-- Every column of every row a windows reader answers, in its order, as one text: the new body, and the one before it.
CREATE FUNCTION bedt.rows_now(p integer) RETURNS text LANGUAGE sql AS
  $$ SELECT coalesce(string_agg(to_jsonb(w)::text, ' | ' ORDER BY w.ordinality), '') FROM public.list_lien_affidavit_windows(p) WITH ORDINALITY AS w $$;
CREATE FUNCTION bedt.rows_before(p integer) RETURNS text LANGUAGE sql AS
  $$ SELECT coalesce(string_agg(to_jsonb(w)::text, ' | ' ORDER BY w.ordinality), '') FROM public.list_lien_affidavit_windows_before(p) WITH ORDINALITY AS w $$;
-- The asks its readers make (0, the default 30, the desk's 180, the beds' 400) and the two odd ones (below zero, none).
CREATE FUNCTION bedt.same_as_before() RETURNS boolean LANGUAGE sql AS
  $$ SELECT bool_and(bedt.rows_now(p) = bedt.rows_before(p)) FROM unnest(ARRAY[0, 30, 180, 400, -5, NULL]::integer[]) AS p $$;
-- True when a statement is refused for want of a privilege.
CREATE FUNCTION bedt.refused(q text) RETURNS boolean LANGUAGE plpgsql AS $$
BEGIN
  EXECUTE q;
  RETURN false;
EXCEPTION WHEN insufficient_privilege THEN
  RETURN true;
END $$;

-- Signed in as a dev, on Oct 22, 2026.
INSERT INTO public.users (id, role) VALUES (bedt.id('1'), 'dev'), (bedt.id('2'), 'assistant'), (bedt.id('3'), 'master_technician'), (bedt.id('4'), 'technician');
SELECT set_config('request.jwt.claim.sub', bedt.id('1')::text, true), set_config('request.jwt.claim.role', 'authenticated', true), set_config('bed.today', '2026-10-22', true);
INSERT INTO public.customers (id, name) VALUES (bedt.id('900'), 'Bed GC'), (bedt.id('901'), 'Bed Owner');
INSERT INTO public.customer_addresses (id, property_kind) VALUES (bedt.id('800'), 'non_residential'), (bedt.id('801'), 'residential');

-- The jobs. A commercial job's last day to file is the 15th of the fourth month after its last month of work.
SELECT bedt.job('1', '2026-06-12');                                   -- its day is Oct 15: seven days past today
SELECT bedt.job('2', '2026-07-10');                                   -- Nov 16, ahead
SELECT bedt.job('3', '2026-05-20'), bedt.job('4', '2026-05-20'), bedt.job('5', '2026-05-20'),
       bedt.job('6', '2026-05-20'), bedt.job('7', '2026-05-20'), bedt.job('8', '2026-05-20');  -- Sep 15, long past
SELECT bedt.job('9', '2026-10-05');                                   -- Feb 15, 2027: past the default ask
SELECT bedt.job('10');                                                -- nobody clocked on it: dated from its bill, Aug 17
INSERT INTO public.jobs_ledger_invoices (job_id, amount, status, billed_at) VALUES (bedt.id('10'), 5000, 'billed', '2026-04-10T15:00:00Z');
SELECT bedt.job('11'), bedt.hours('11', '2026-05-20');                -- dated from its approved hours, Sep 15
SELECT bedt.job('12', '2026-05-20');                                  -- never billed: on no lien list
UPDATE public.jobs_ledger SET status = 'working' WHERE id = bedt.id('12');
SELECT bedt.job('13', '2026-06-12', '801');                           -- a home: the third month, Sep 15
-- Job 8 carries papers that are not a filing: an approved affidavit on the desk, a notice, an affidavit record with
-- no filed day, and a filed affidavit that was voided.
INSERT INTO public.job_lien_desk_items (job_id, kind, status) VALUES (bedt.id('8'), 'affidavit', 'approved');
INSERT INTO public.job_lien_filings (job_id, kind) VALUES (bedt.id('8'), 'notice_53_056'), (bedt.id('8'), 'affidavit');
INSERT INTO public.job_lien_filings (job_id, kind, filed_at, voided_at) VALUES (bedt.id('8'), 'affidavit', '2026-09-01', now());

-- 1 · Seven days past its day a job is still the windows reader's, and not yet a closed day.
SELECT bedt.ok('day 7: the windows reader lists the job seven days past and the one ahead', bedt.windows(30) = '1 2026-10-15, 2 2026-11-16');
SELECT bedt.ok('day 7: a wider ask adds the far day and nothing older', bedt.windows(400) = '1 2026-10-15, 2 2026-11-16, 9 2027-02-15');
SELECT bedt.ok('day 7: the windows reader answers the rows it answered before, for every ask', bedt.same_as_before());
SELECT bedt.ok('day 7: the closed days are the jobs more than seven days past, oldest day first',
  bedt.closed() = '10 2026-08-17 bill, 3 2026-09-15 hand, 4 2026-09-15 hand, 5 2026-09-15 hand, 6 2026-09-15 hand, 7 2026-09-15 hand, 8 2026-09-15 hand, 11 2026-09-15 hours, 13 2026-09-15 hand');
SELECT bedt.ok('day 7: no job is on both lists',
  NOT EXISTS (SELECT 1 FROM public.list_lien_closed_days() c JOIN public.list_lien_affidavit_windows(400) w ON w.job_id = c.job_id));

-- 2 · On the eighth day the job leaves the windows reader, as before, and is a closed day.
SELECT set_config('bed.today', '2026-10-23', true);
SELECT bedt.ok('day 8: the windows reader has dropped the job', bedt.windows(30) = '2 2026-11-16');
SELECT bedt.ok('day 8: the windows reader still answers the rows it answered before', bedt.same_as_before());
SELECT bedt.ok('day 8: the job is a closed day',
  bedt.closed() = '10 2026-08-17 bill, 3 2026-09-15 hand, 4 2026-09-15 hand, 5 2026-09-15 hand, 6 2026-09-15 hand, 7 2026-09-15 hand, 8 2026-09-15 hand, 11 2026-09-15 hours, 13 2026-09-15 hand, 1 2026-10-15 hand');

-- 3 · A closed day's row is the row the windows reader gave the job while it still listed it. The Sep 15 rows are
--     kept, the day is set back to Sep 20 (five days past them), and the reader as it stood is asked.
CREATE TEMP TABLE bed_closed ON COMMIT DROP AS SELECT * FROM public.list_lien_closed_days();
SELECT set_config('bed.today', '2026-09-20', true);
SELECT bedt.ok('the row: eight closed days fell on Sep 15', (SELECT count(*) FROM bed_closed c WHERE c.deadline = '2026-09-15') = 8);
SELECT bedt.ok('the row: each is the row the reader as it stood listed on Sep 20, column for column',
  NOT EXISTS (SELECT * FROM bed_closed c WHERE c.deadline = '2026-09-15' EXCEPT SELECT * FROM public.list_lien_affidavit_windows_before(0)));
SELECT set_config('bed.today', '2026-10-23', true);
SELECT bedt.ok('the row: papers that are not a filing leave the job listed, with its approved affidavit and its notice',
  (SELECT c.desk_status = 'approved' AND c.desk_item_id IS NOT NULL AND c.noticed AND NOT c.filed AND c.open_balance = 5000
   FROM public.list_lien_closed_days() c WHERE c.job_id = bedt.id('8')));

-- 4 · Each answer takes its job off the list.
INSERT INTO public.job_lien_filings (job_id, kind, filed_at) VALUES (bedt.id('4'), 'affidavit', '2026-10-20');
SELECT bedt.ok('filed: a recorded filing drops the job', NOT bedt.listed('4'));
UPDATE public.jobs_ledger SET lien_path_answer = 'off_path' WHERE id = bedt.id('5');
SELECT bedt.ok('off the lien path: the job drops', NOT bedt.listed('5'));
UPDATE public.jobs_ledger SET lien_path_answer = NULL WHERE id = bedt.id('5');
SELECT bedt.ok('put back on the lien path: the job is listed again', bedt.listed('5'));
UPDATE public.jobs_ledger SET uncollectible_at = now() WHERE id = bedt.id('6');
SELECT bedt.ok('Uncollectible: the job drops', NOT bedt.listed('6'));
UPDATE public.jobs_ledger SET payments_made = 5000 WHERE id = bedt.id('7');
SELECT bedt.ok('paid: the job drops', NOT bedt.listed('7'));
UPDATE public.jobs_ledger SET lien_last_work_on = '2026-08-03' WHERE id = bedt.id('3');
SELECT bedt.ok('the date was wrong: the job drops, and its new day is the windows reader''s',
  NOT bedt.listed('3') AND bedt.windows(180) = '2 2026-11-16, 3 2026-12-15, 9 2027-02-15');
SELECT bedt.ok('after the answers: what is left is what nobody answered',
  bedt.closed() = '10 2026-08-17 bill, 5 2026-09-15 hand, 8 2026-09-15 hand, 11 2026-09-15 hours, 13 2026-09-15 hand, 1 2026-10-15 hand');
SELECT bedt.ok('after the answers: the windows reader still answers the rows it answered before', bedt.same_as_before());

-- 5 · The gate is the windows reader's: the lien office and the service role, nobody else.
SELECT set_config('request.jwt.claim.sub', bedt.id('2')::text, true);
SELECT bedt.ok('an assistant reads the closed days', (SELECT count(*) FROM public.list_lien_closed_days()) = 6);
SELECT set_config('request.jwt.claim.sub', bedt.id('3')::text, true);
SELECT bedt.ok('a master reads the closed days', (SELECT count(*) FROM public.list_lien_closed_days()) = 6);
SELECT set_config('request.jwt.claim.sub', bedt.id('4')::text, true);
SELECT bedt.ok('a technician reads none, from either reader', (SELECT count(*) FROM public.list_lien_closed_days()) = 0 AND bedt.windows(400) = '');
SELECT set_config('request.jwt.claim.sub', '', true), set_config('request.jwt.claim.role', '', true);
SELECT bedt.ok('signed out: no rows, from either reader', (SELECT count(*) FROM public.list_lien_closed_days()) = 0 AND bedt.windows(400) = '');
SELECT set_config('request.jwt.claim.role', 'service_role', true);
SELECT bedt.ok('the service role reads the closed days, and the windows as before',
  (SELECT count(*) FROM public.list_lien_closed_days()) = 6 AND bedt.same_as_before() AND bedt.windows(30) = '2 2026-11-16');

-- 6 · Who may call what. The shared reader is the two readers' alone.
SELECT bedt.ok('grants: the closed days are for signed-in callers and the service role, never anon',
  has_function_privilege('authenticated', 'public.list_lien_closed_days()', 'EXECUTE')
  AND has_function_privilege('service_role', 'public.list_lien_closed_days()', 'EXECUTE')
  AND NOT has_function_privilege('anon', 'public.list_lien_closed_days()', 'EXECUTE'));
SELECT bedt.ok('grants: the windows reader keeps its callers',
  has_function_privilege('authenticated', 'public.list_lien_affidavit_windows(integer)', 'EXECUTE')
  AND has_function_privilege('service_role', 'public.list_lien_affidavit_windows(integer)', 'EXECUTE')
  AND NOT has_function_privilege('anon', 'public.list_lien_affidavit_windows(integer)', 'EXECUTE'));
SELECT bedt.ok('grants: nobody but its owner may call the shared reader',
  NOT has_function_privilege('authenticated', 'public.lien_affidavit_days()', 'EXECUTE')
  AND NOT has_function_privilege('service_role', 'public.lien_affidavit_days()', 'EXECUTE')
  AND NOT has_function_privilege('anon', 'public.lien_affidavit_days()', 'EXECUTE'));

-- 7 · The same, as the role the app signs in with: both readers answer a dev, and a direct call to the shared reader
--     is refused.
GRANT USAGE ON SCHEMA bedt TO authenticated;
SELECT set_config('request.jwt.claim.sub', bedt.id('1')::text, true), set_config('request.jwt.claim.role', 'authenticated', true);
SET LOCAL ROLE authenticated;
SELECT bedt.ok('as the authenticated role: the closed days answer', (SELECT count(*) FROM public.list_lien_closed_days()) = 6);
SELECT bedt.ok('as the authenticated role: the windows answer', (SELECT count(*) FROM public.list_lien_affidavit_windows(30)) = 1);
SELECT bedt.ok('as the authenticated role: a direct call to the shared reader is refused', bedt.refused('SELECT count(*) FROM public.lien_affidavit_days()'));
RESET ROLE;

DO $$ BEGIN RAISE NOTICE 'lien_closed_days PASSED'; END $$;
ROLLBACK;
