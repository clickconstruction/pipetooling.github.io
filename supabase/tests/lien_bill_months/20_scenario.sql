-- The month comes from the bill (v2.7224): the four lien readers case for case with the client's lienStandInMonth
-- (src/lib/jobs/lienBillMonths.test.ts). A job with no approved hours and no day set by hand takes its months from
-- its sent, unpaid bills, each from the earlier of its billed day and its sent day; with no dated unpaid bill it
-- keeps its creation month. Hours and a day set by hand still come first.
-- One transaction that rolls back; raises on the first failed assertion; ends with "lien_bill_months PASSED".
-- See scripts/pgtest-lien-bill-months.sh. Never against prod.
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
-- A commercial job under the GC, $5,000 open, billed unless said otherwise.
CREATE FUNCTION bedt.job(n text, made timestamptz, hand date DEFAULT NULL, st text DEFAULT 'billed') RETURNS void LANGUAGE sql AS $$
  INSERT INTO public.jobs_ledger (id, hcp_number, customer_id, gc_customer_id, customer_address_id, status, revenue, payments_made, created_at, lien_last_work_on)
  VALUES (bedt.id(n), n, bedt.id('901'), bedt.id('900'), bedt.id('800'), st, 5000, 0, made, hand)
$$;
CREATE FUNCTION bedt.bill(job text, st text, billed timestamptz, sent timestamptz DEFAULT NULL) RETURNS void LANGUAGE sql AS $$
  INSERT INTO public.jobs_ledger_invoices (job_id, amount, status, billed_at, sent_to_customer_at) VALUES (bedt.id(job), 1000, st, billed, sent)
$$;
-- Eight approved hours on a day.
CREATE FUNCTION bedt.hours(job text, day date) RETURNS void LANGUAGE sql AS $$
  INSERT INTO public.clock_sessions (job_ledger_id, work_date, clocked_in_at, clocked_out_at, approved_at)
  VALUES (bedt.id(job), day, day::timestamptz + interval '13 hours', day::timestamptz + interval '21 hours', day::timestamptz + interval '2 days')
$$;
-- A reader's months for one job, oldest first, each with where it came from: "2026-07 bill, 2026-08 bill".
CREATE FUNCTION bedt.notice_months(job text) RETURNS text LANGUAGE sql AS
  $$ SELECT coalesce(string_agg(m.work_month || ' ' || m.month_source, ', ' ORDER BY m.work_month), '') FROM public.list_lien_notice_months(400) m WHERE m.job_id = bedt.id(job) $$;
CREATE FUNCTION bedt.gc_months(job text) RETURNS text LANGUAGE sql AS
  $$ SELECT coalesce(string_agg(m.work_month || ' ' || m.month_source, ', ' ORDER BY m.work_month), '') FROM public.list_gc_unpaid_months(bedt.id('900')) m WHERE m.job_id = bedt.id(job) $$;
CREATE FUNCTION bedt.affidavit(job text) RETURNS text LANGUAGE sql AS
  $$ SELECT coalesce((SELECT w.last_month || ' ' || w.month_source || ' by ' || w.deadline FROM public.list_lien_affidavit_windows(400) w WHERE w.job_id = bedt.id(job)), '') $$;
CREATE FUNCTION bedt.first_month(job text) RETURNS text LANGUAGE sql AS
  $$ SELECT coalesce((SELECT o.first_work_month || ' ' || o.month_source FROM public.list_jobs_owner_to_confirm() o WHERE o.job_id = bedt.id(job)), '') $$;

-- Signed in as a dev, on Aug 20, 2026.
INSERT INTO public.users (id, role) VALUES (bedt.id('1'), 'dev');
SELECT set_config('request.jwt.claim.sub', bedt.id('1')::text, true), set_config('request.jwt.claim.role', 'authenticated', true), set_config('bed.today', '2026-08-20', true);
INSERT INTO public.customers (id, name) VALUES (bedt.id('900'), 'Bed GC'), (bedt.id('901'), 'Bed Owner');
INSERT INTO public.customer_addresses (id, property_kind) VALUES (bedt.id('800'), 'non_residential');

-- 1 · The case: a job typed in on Aug 18, weeks after its work, whose bill carries a July day.
--     Until v2.7224 every reader said August, the month it was typed in.
SELECT bedt.job('1', '2026-08-18T05:59:40Z'), bedt.bill('1', 'billed', '2026-08-18T06:01:42Z', '2026-07-24T17:00:00Z');
SELECT bedt.ok('typed in late: the notice month is the bill''s', bedt.notice_months('1') = '2026-07 bill');
SELECT bedt.ok('typed in late: the affidavit counts from the bill''s month', bedt.affidavit('1') = '2026-07 bill by 2026-11-16');
SELECT bedt.ok('typed in late: the GC''s unpaid month is the bill''s', bedt.gc_months('1') = '2026-07 bill');
SELECT bedt.ok('typed in late: the first month is the bill''s', bedt.first_month('1') = '2026-07 bill');

-- 2 · A job made in May and billed in August takes August, not May.
SELECT bedt.job('2', '2026-05-02T15:00:00Z'), bedt.bill('2', 'billed', '2026-08-04T15:00:00Z', '2026-08-04T15:01:00Z');
SELECT bedt.ok('made early, billed later: the bill''s month', bedt.notice_months('2') = '2026-08 bill' AND bedt.affidavit('2') = '2026-08 bill by 2026-12-15');

-- 3 · Two unpaid bills in two months and one paid bill: a month per unpaid bill, the latest is the last, the paid one gives none.
SELECT bedt.job('3', '2026-05-02T15:00:00Z'), bedt.bill('3', 'paid', '2026-06-03T15:00:00Z'), bedt.bill('3', 'billed', '2026-07-01T15:00:00Z'), bedt.bill('3', 'billed', '2026-08-10T15:00:00Z');
SELECT bedt.ok('two unpaid bills: each month owes its notice', bedt.notice_months('3') = '2026-07 bill, 2026-08 bill');
SELECT bedt.ok('two unpaid bills: the affidavit counts from the later', bedt.affidavit('3') = '2026-08 bill by 2026-12-15');
SELECT bedt.ok('two unpaid bills: the first month is the earlier', bedt.first_month('3') = '2026-07 bill');
SELECT bedt.ok('two unpaid bills: the GC''s unpaid months are both', bedt.gc_months('3') = '2026-07 bill, 2026-08 bill');

-- 4 · No dated unpaid bill: the creation month, as before (v2.3747). A paid bill, and a bill with no day, give nothing.
SELECT bedt.job('4', '2026-05-02T15:00:00Z'), bedt.bill('4', 'paid', '2026-07-01T15:00:00Z'), bedt.bill('4', 'billed', NULL);
SELECT bedt.ok('no dated unpaid bill: the creation month', bedt.notice_months('4') = '2026-05 job_created' AND bedt.affidavit('4') = '2026-05 job_created by 2026-09-15' AND bedt.first_month('4') = '2026-05 job_created' AND bedt.gc_months('4') = '2026-05 job_created');

-- 5 · Approved hours come first: the bill gives no month.
SELECT bedt.job('5', '2026-05-02T15:00:00Z'), bedt.hours('5', '2026-06-09'), bedt.bill('5', 'billed', '2026-08-04T15:00:00Z');
SELECT bedt.ok('hours on the clock: the bill is not read', bedt.notice_months('5') = '2026-06 hours' AND bedt.affidavit('5') = '2026-06 hours by 2026-10-15' AND bedt.first_month('5') = '2026-06 hours' AND bedt.gc_months('5') = '2026-06 hours');

-- 6 · A day set by hand comes first too.
SELECT bedt.job('6', '2026-05-02T15:00:00Z', '2026-06-12'), bedt.bill('6', 'billed', '2026-08-04T15:00:00Z');
SELECT bedt.ok('a day set by hand: the bill is not read', bedt.notice_months('6') = '2026-06 hand' AND bedt.affidavit('6') = '2026-06 hand by 2026-10-15' AND bedt.first_month('6') = '2026-06 hand' AND bedt.gc_months('6') = '2026-06 hand');

-- 7 · The company calendar: 03:10 UTC on Aug 1 is still July 31 in Chicago.
SELECT bedt.job('7', '2026-05-02T15:00:00Z'), bedt.bill('7', 'billed', '2026-08-01T03:10:00Z');
SELECT bedt.ok('the bill''s day is read in the company calendar', bedt.notice_months('7') = '2026-07 bill');

-- 8 · A bill sent again later keeps its first day.
SELECT bedt.job('8', '2026-05-02T15:00:00Z'), bedt.bill('8', 'billed', '2026-07-28T15:00:00Z', '2026-09-04T14:28:00Z');
SELECT bedt.ok('sent again later: the first day stands', bedt.notice_months('8') = '2026-07 bill' AND bedt.affidavit('8') = '2026-07 bill by 2026-11-16');

-- 9 · A job not billed yet has no bill to read: the readers that list it keep its creation month.
SELECT bedt.job('9', '2026-06-20T15:00:00Z', NULL, 'working');
SELECT bedt.ok('not billed yet: the creation month', bedt.gc_months('9') = '2026-06 job_created' AND bedt.first_month('9') = '2026-06 job_created');

-- 10 · The rule's one home, called by itself.
SELECT bedt.ok('lien_bill_months lists each unpaid bill''s month once',
  (SELECT string_agg(m.work_month, ', ' ORDER BY m.work_month) FROM public.lien_bill_months(bedt.id('3')) m) = '2026-07, 2026-08'
  AND NOT EXISTS (SELECT 1 FROM public.lien_bill_months(bedt.id('4'))));

-- 11 · Nobody but the office reads them: signed out, every list is empty.
SELECT set_config('request.jwt.claim.sub', '', true), set_config('request.jwt.claim.role', '', true);
SELECT bedt.ok('signed out: no rows', bedt.notice_months('1') = '' AND bedt.affidavit('1') = '' AND bedt.gc_months('1') = '' AND bedt.first_month('1') = '');

DO $$ BEGIN RAISE NOTICE 'lien_bill_months PASSED'; END $$;
ROLLBACK;
