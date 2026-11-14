-- The day set by hand counts (v2.7193, punch list #335, row 1): the four lien readers case for case with the client's
-- lienClockMonths (src/lib/jobs/lienLastWorkDay.test.ts). A day set by hand is the last day of work: its month is the
-- last month on the clock, months of approved hours before it stay, months of approved hours after it are off it.
-- One transaction that rolls back; raises on the first failed assertion; ends with "lien_hand_day PASSED".
-- See scripts/pgtest-lien-hand-day.sh. Never against prod.
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
-- A billed commercial job under the GC, $5,000 open, made May 2.
CREATE FUNCTION bedt.job(n text, hand date DEFAULT NULL) RETURNS void LANGUAGE sql AS $$
  INSERT INTO public.jobs_ledger (id, hcp_number, customer_id, gc_customer_id, customer_address_id, status, revenue, payments_made, created_at, lien_last_work_on)
  VALUES (bedt.id(n), n, bedt.id('901'), bedt.id('900'), bedt.id('800'), 'billed', 5000, 0, '2026-05-02T15:00:00Z', hand)
$$;
-- Eight approved hours on a day.
CREATE FUNCTION bedt.hours(job text, day date) RETURNS void LANGUAGE sql AS $$
  INSERT INTO public.clock_sessions (job_ledger_id, work_date, clocked_in_at, clocked_out_at, approved_at)
  VALUES (bedt.id(job), day, day::timestamptz + interval '13 hours', day::timestamptz + interval '21 hours', day::timestamptz + interval '2 days')
$$;
-- A reader's months for one job, oldest first, each with where it came from: "2026-05 hours, 2026-06 hand".
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

-- 1 · No day set by hand: every month with approved hours, as before.
SELECT bedt.job('1'), bedt.hours('1', '2026-05-20'), bedt.hours('1', '2026-07-08');
SELECT bedt.ok('no hand day: the notice months are the months with hours', bedt.notice_months('1') = '2026-05 hours, 2026-07 hours');
SELECT bedt.ok('no hand day: the affidavit counts from the last month with hours', bedt.affidavit('1') = '2026-07 hours by 2026-11-16');
SELECT bedt.ok('no hand day: the GC''s unpaid months are the months with hours', bedt.gc_months('1') = '2026-05 hours, 2026-07 hours');
SELECT bedt.ok('no hand day: the first month is the first with hours', bedt.first_month('1') = '2026-05 hours');

-- 2 · A hand day later than the hours adds its month, as it always did (v2.4676).
SELECT bedt.job('2', '2026-08-14'), bedt.hours('2', '2026-07-08');
SELECT bedt.ok('hand day after the hours: its month joins the notice months', bedt.notice_months('2') = '2026-07 hours, 2026-08 hand');
SELECT bedt.ok('hand day after the hours: the affidavit counts from its month', bedt.affidavit('2') = '2026-08 hand by 2026-12-15');
SELECT bedt.ok('hand day after the hours: the GC''s unpaid months gain its month', bedt.gc_months('2') = '2026-07 hours, 2026-08 hand');

-- 3 · The case: hours in May, the last day set by hand as Jun 12, then hours approved in October.
--     Until v2.7193 October owed a notice and the affidavit counted from it (by 2027-02-15).
SELECT bedt.job('3', '2026-06-12'), bedt.hours('3', '2026-05-20'), bedt.hours('3', '2026-10-20');
SELECT bedt.ok('hours after the hand day: October owes no notice, June does', bedt.notice_months('3') = '2026-05 hours, 2026-06 hand');
SELECT bedt.ok('hours after the hand day: the affidavit counts from June, by Oct 15', bedt.affidavit('3') = '2026-06 hand by 2026-10-15');
SELECT bedt.ok('hours after the hand day: the GC''s unpaid months stop at June', bedt.gc_months('3') = '2026-05 hours, 2026-06 hand');
SELECT bedt.ok('hours after the hand day: the first month is still May', bedt.first_month('3') = '2026-05 hours');

-- 4 · Hours in the hand day's own month, before and after the day: one month, read as set by hand, its hours counted.
SELECT bedt.job('4', '2026-06-12'), bedt.hours('4', '2026-06-05'), bedt.hours('4', '2026-06-25');
SELECT bedt.ok('hours in the hand day''s month: one row, by hand', bedt.notice_months('4') = '2026-06 hand');
SELECT bedt.ok('hours in the hand day''s month: both days'' hours are on the row',
  (SELECT round(m.approved_hours) = 16 FROM public.list_lien_notice_months(400) m WHERE m.job_id = bedt.id('4')));
SELECT bedt.ok('hours in the hand day''s month: the affidavit counts from June', bedt.affidavit('4') = '2026-06 hand by 2026-10-15');

-- 5 · Every approved hour is after the hand day: the hand day's month stands alone, and is the first month too.
SELECT bedt.job('5', '2026-06-12'), bedt.hours('5', '2026-09-10');
SELECT bedt.ok('all hours after the hand day: only June is on the clock', bedt.notice_months('5') = '2026-06 hand');
SELECT bedt.ok('all hours after the hand day: the affidavit counts from June', bedt.affidavit('5') = '2026-06 hand by 2026-10-15');
SELECT bedt.ok('all hours after the hand day: the first month is June, by hand', bedt.first_month('5') = '2026-06 hand');
SELECT bedt.ok('all hours after the hand day: the GC''s unpaid month is June', bedt.gc_months('5') = '2026-06 hand');

-- 6 · No hours and no hand day: the creation month, as before (v2.3747).
SELECT bedt.job('6');
SELECT bedt.ok('no hours, no hand day: the creation month', bedt.notice_months('6') = '2026-05 job_created' AND bedt.affidavit('6') = '2026-05 job_created by 2026-09-15' AND bedt.first_month('6') = '2026-05 job_created');

-- 7 · Clearing the hand day puts the later hours back on the clock.
UPDATE public.jobs_ledger SET lien_last_work_on = NULL WHERE id = bedt.id('3');
SELECT bedt.ok('hand day cleared: October is back', bedt.notice_months('3') = '2026-05 hours, 2026-10 hours' AND bedt.affidavit('3') = '2026-10 hours by 2027-02-15');

-- 8 · Nobody but the office reads them: signed out, every list is empty.
SELECT set_config('request.jwt.claim.sub', '', true), set_config('request.jwt.claim.role', '', true);
SELECT bedt.ok('signed out: no rows', bedt.notice_months('1') = '' AND bedt.affidavit('1') = '' AND bedt.gc_months('1') = '' AND bedt.first_month('1') = '');

DO $$ BEGIN RAISE NOTICE 'lien_hand_day PASSED'; END $$;
ROLLBACK;
