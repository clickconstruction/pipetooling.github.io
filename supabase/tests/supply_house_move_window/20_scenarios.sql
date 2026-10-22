-- Scenarios for count_supply_house_move_window() (20261021220000), the move window's Needs You
-- line. Raises on the first failed assertion; ends with "… PASSED". t_as(person) signs a person
-- in for the transaction, as PostgREST does on prod.
--
-- The $rows$ and $expect$ blocks below are ONE source of truth: src/lib/supplyHouseMoveWindow
-- .parity.test.ts reads them out of this file and runs the tab's kernel (movableCandidates +
-- isMovableAgingInvoice + moveStripSummary) over the same rows, so the function and the kernel
-- are held to the same four numbers. due_in_days counts from today in the company calendar
-- (app_today() here, a fixed day there; null = no due date); jobs = allocation rows; open_ask =
-- an unconfirmed ask; confirmed_ask = an ask the house already honored (history, never counted).

\set dev   '''00000000-0000-4000-8000-000000000001'''
\set tess  '''00000000-0000-4000-8000-000000000002'''
\set mike  '''00000000-0000-4000-8000-000000000003'''
\set house '''aaaaaaaa-0000-4000-8000-000000000001'''

INSERT INTO public.users (id, name, role) VALUES
  (:dev,  'Owner Dev',      'dev'),
  (:tess, 'Office Tess',    'assistant'),
  (:mike, 'Estimator Mike', 'estimator');
INSERT INTO public.supply_houses (id, name) VALUES (:house, 'Bluebonnet Supply');

CREATE OR REPLACE FUNCTION public.t_inv(p text) RETURNS uuid LANGUAGE sql IMMUTABLE AS $$ SELECT md5('inv:' || p)::uuid $$;
CREATE OR REPLACE FUNCTION public.t_job(p int) RETURNS uuid LANGUAGE sql IMMUTABLE AS $$ SELECT md5('job:' || p)::uuid $$;
INSERT INTO public.jobs_ledger (id, hcp_number, job_name) SELECT public.t_job(g), 'J' || g, 'Job ' || g FROM generate_series(1, 2) g;

CREATE TEMP TABLE t_rows AS
SELECT * FROM jsonb_to_recordset($rows$[
  {"id": "a", "amount": 2210.00, "due_in_days": 4,    "on_job_account": false, "is_paid": false, "jobs": 1, "open_ask": true,  "confirmed_ask": false, "why": "current, one job, asked: counts, asked"},
  {"id": "b", "amount": 1742.65, "due_in_days": 0,    "on_job_account": false, "is_paid": false, "jobs": 1, "open_ask": false, "confirmed_ask": false, "why": "due today is still current: counts, the soonest window"},
  {"id": "c", "amount": 500.00,  "due_in_days": -1,   "on_job_account": false, "is_paid": false, "jobs": 1, "open_ask": true,  "confirmed_ask": false, "why": "due yesterday: window closed, its open ask does not count either"},
  {"id": "d", "amount": 300.00,  "due_in_days": 10,   "on_job_account": true,  "is_paid": false, "jobs": 1, "open_ask": false, "confirmed_ask": true,  "why": "already on the job account"},
  {"id": "e", "amount": -40.00,  "due_in_days": 10,   "on_job_account": false, "is_paid": false, "jobs": 1, "open_ask": false, "confirmed_ask": false, "why": "a credit"},
  {"id": "f", "amount": 100.00,  "due_in_days": null, "on_job_account": false, "is_paid": false, "jobs": 1, "open_ask": false, "confirmed_ask": false, "why": "no due date: never movable"},
  {"id": "g", "amount": 800.00,  "due_in_days": 2,    "on_job_account": false, "is_paid": false, "jobs": 2, "open_ask": false, "confirmed_ask": false, "why": "split across two jobs"},
  {"id": "h", "amount": 900.00,  "due_in_days": 2,    "on_job_account": false, "is_paid": false, "jobs": 0, "open_ask": false, "confirmed_ask": false, "why": "no job yet"},
  {"id": "i", "amount": 1000.00, "due_in_days": 3,    "on_job_account": false, "is_paid": true,  "jobs": 1, "open_ask": false, "confirmed_ask": false, "why": "paid"},
  {"id": "j", "amount": 3522.06, "due_in_days": 9,    "on_job_account": false, "is_paid": false, "jobs": 1, "open_ask": false, "confirmed_ask": true,  "why": "current, one job, an ask the house confirmed long ago: counts, not asked"},
  {"id": "k", "amount": 100.00,  "due_in_days": 1,    "on_job_account": false, "is_paid": false, "jobs": 1, "open_ask": true,  "confirmed_ask": false, "why": "current, one job, asked: counts, asked"}
]$rows$::jsonb) AS x(id text, amount numeric, due_in_days int, on_job_account boolean, is_paid boolean, jobs int, open_ask boolean, confirmed_ask boolean, why text);

CREATE TEMP TABLE t_expect AS
SELECT * FROM jsonb_to_record($expect${"count": 4, "dollars": 7574.71, "asked": 2, "soonest_in_days": 0}$expect$::jsonb)
  AS x(count int, dollars numeric, asked int, soonest_in_days int);

INSERT INTO public.supply_house_invoices (id, supply_house_id, invoice_number, invoice_date, amount, is_paid, due_date, on_job_account)
SELECT public.t_inv(r.id), :house, 'INV-' || r.id, public.app_today() - 30, r.amount, r.is_paid,
       CASE WHEN r.due_in_days IS NULL THEN NULL ELSE public.app_today() + r.due_in_days END, r.on_job_account
FROM t_rows r;
INSERT INTO public.supply_house_invoice_job_allocations (invoice_id, job_id, pct)
SELECT public.t_inv(r.id), public.t_job(g), 100.0 / r.jobs FROM t_rows r, generate_series(1, r.jobs) g;
INSERT INTO public.supply_house_invoice_move_requests (invoice_id, job_id, supply_house_id, via, confirmed_at)
SELECT public.t_inv(r.id), public.t_job(1), :house, 'email', NULL FROM t_rows r WHERE r.open_ask;
INSERT INTO public.supply_house_invoice_move_requests (invoice_id, job_id, supply_house_id, via, confirmed_at)
SELECT public.t_inv(r.id), public.t_job(1), :house, 'phone', now() - interval '20 days' FROM t_rows r WHERE r.confirmed_ask;

-- The four numbers as the signed-in person read them, against the $expect$ block.
CREATE OR REPLACE FUNCTION public.t_matches_expect() RETURNS boolean LANGUAGE sql AS $$
  SELECT (SELECT count(*) FROM public.count_supply_house_move_window()) = 1
     AND (SELECT w.count = e.count AND w.dollars = e.dollars AND w.asked = e.asked
                 AND w.soonest_due = public.app_today() + e.soonest_in_days
          FROM public.count_supply_house_move_window() w, t_expect e)
$$;
CREATE OR REPLACE FUNCTION public.t_is_zero_row() RETURNS boolean LANGUAGE sql AS $$
  SELECT (SELECT count(*) FROM public.count_supply_house_move_window()) = 1
     AND (SELECT w.count = 0 AND w.dollars = 0 AND w.asked = 0 AND w.soonest_due IS NULL
          FROM public.count_supply_house_move_window() w)
$$;

-- ── S1: the dev reads count, dollars, asked and the soonest window ───────────────────────────
BEGIN;
SELECT public.t_as(:dev);
SELECT public.t_assert(public.t_matches_expect(), 'S1 the dev reads the $expect$ numbers');
COMMIT;

-- ── S2: an assistant (the office set that works Accounts payable) reads the same ─────────────
BEGIN;
SELECT public.t_as(:tess);
SELECT public.t_assert(public.t_matches_expect(), 'S2 the assistant reads the $expect$ numbers');
COMMIT;

-- ── S3: an estimator gets the zero row, not an error ─────────────────────────────────────────
BEGIN;
SELECT public.t_as(:mike);
SELECT public.t_assert(public.t_is_zero_row(), 'S3 the estimator reads the zero row');
COMMIT;

-- ── S4: signed out, the zero row ─────────────────────────────────────────────────────────────
BEGIN;
SELECT public.t_as(NULL);
SELECT public.t_assert(public.t_is_zero_row(), 'S4 signed out reads the zero row');
COMMIT;

-- ── S5: it reads live — flag the soonest one on, and the count, the dollars and the window move
BEGIN;
SELECT public.t_as(:dev);
UPDATE public.supply_house_invoices SET on_job_account = true WHERE id = public.t_inv('b');
SELECT public.t_assert(
  (SELECT w.count = 3 AND w.dollars = 5832.06 AND w.asked = 2 AND w.soonest_due = public.app_today() + 1
   FROM public.count_supply_house_move_window() w),
  'S5 flagging b on: 3 rows, $5,832.06, 2 asked, the soonest window is k tomorrow');
-- confirm k's ask: it still counts, but is no longer asked
UPDATE public.supply_house_invoice_move_requests SET confirmed_at = now() WHERE invoice_id = public.t_inv('k');
SELECT public.t_assert(
  (SELECT w.count = 3 AND w.asked = 1 FROM public.count_supply_house_move_window() w),
  'S5 confirming k''s ask: still 3 rows, 1 asked');
ROLLBACK;

-- ── S6: the roles of the migration — anon may not call it, authenticated may ─────────────────
SELECT public.t_assert(NOT has_function_privilege('anon', 'public.count_supply_house_move_window()', 'EXECUTE'), 'S6 anon cannot execute');
SELECT public.t_assert(has_function_privilege('authenticated', 'public.count_supply_house_move_window()', 'EXECUTE'), 'S6 authenticated can execute');

DO $$ BEGIN RAISE NOTICE 'supply_house_move_window scenarios PASSED'; END $$;
