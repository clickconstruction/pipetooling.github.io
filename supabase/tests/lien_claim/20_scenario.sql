-- The lien claim under the payment rule (v2.5093): lien_billed_open() case for case with the client's
-- lienBilledOpen (src/lib/jobs/lienBilledOpen.test.ts): the same jobs, the same money, the same answers.
-- One transaction that rolls back; raises on the first failed assertion; ends with "lien_claim PASSED".
-- See scripts/pgtest-lien-claim.sh. Never against prod.
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
-- A job's claim as the desk's readers ask for it.
CREATE FUNCTION bedt.claim(job text, status text, revenue numeric, payments_made numeric) RETURNS numeric LANGUAGE sql AS
  $$ SELECT public.lien_billed_open(bedt.id(job), status, revenue, payments_made) $$;
CREATE FUNCTION bedt.bill(job text, bill text, amount numeric, status text, seq integer, billed timestamptz DEFAULT NULL) RETURNS void LANGUAGE sql AS
  $$ INSERT INTO public.jobs_ledger_invoices (id, job_id, amount, status, sequence_order, billed_at) VALUES (bedt.id(bill), bedt.id(job), amount, status, seq, billed) $$;
CREATE FUNCTION bedt.pay(job text, bill text, amount numeric) RETURNS void LANGUAGE sql AS
  $$ INSERT INTO public.jobs_ledger_payments (job_id, invoice_id, amount) VALUES (bedt.id(job), CASE WHEN bill IS NULL THEN NULL ELSE bedt.id(bill) END, amount) $$;

-- Job 922 (2026-10-08): $5,000, two $2,000 bills sent, the last $1,000 a draft at Ready to Bill.
SELECT bedt.bill('922', '92201', 2000, 'billed', 0), bedt.bill('922', '92202', 2000, 'billed', 1), bedt.bill('922', '92203', 1000, 'ready_to_bill', 2);
SELECT bedt.ok('job 922: the sent bills owe $4,000 and the draft is not claimed', bedt.claim('922', 'billed', 5000, 0) = 4000);
SELECT bedt.pay('922', NULL, 1000);
SELECT bedt.ok('job 922: $1,000 with no bill picked pays the $1,000 on no sent bill first, so the bills still owe $4,000', bedt.claim('922', 'billed', 5000, 1000) = 4000);

-- The same shape with money tied to the bills: $2,000 to the first, $500.50 to the second.
SELECT bedt.bill('923', '92301', 2000, 'billed', 0), bedt.bill('923', '92302', 2000, 'billed', 1), bedt.bill('923', '92303', 1000, 'ready_to_bill', 2);
SELECT bedt.pay('923', '92301', 2000), bedt.pay('923', '92302', 500.50);
SELECT bedt.ok('a bill nets the money tied to it: $1,499.50 left', bedt.claim('923', 'billed', 5000, 2500.50) = 1499.50);

-- Both bills paid, the last $1,000 never billed: nothing is owed on sent bills.
SELECT bedt.bill('924', '92401', 2000, 'paid', 0), bedt.bill('924', '92402', 2000, 'paid', 1), bedt.bill('924', '92403', 1000, 'ready_to_bill', 2);
SELECT bedt.ok('paid bills owe nothing, and work not billed is not claimed', bedt.claim('924', 'billed', 5000, 4000) = 0);

-- Job 273 on prod (2026-10-09): $56,365, three billed bills of $13,420, $665 and $3,500, $39,680 paid with no bill picked.
SELECT bedt.bill('273', '27301', 13420, 'billed', 1), bedt.bill('273', '27302', 665, 'billed', 2), bedt.bill('273', '27303', 3500, 'billed', 3);
SELECT bedt.pay('273', NULL, 20000), bedt.pay('273', NULL, 10000), bedt.pay('273', NULL, 8780), bedt.pay('273', NULL, 900);
SELECT bedt.ok('job 273: the work on no bill takes $38,780, the oldest bill $900, so the claim is $16,685, not $17,585', bedt.claim('273', 'billed', 56365, 39680) = 16685);

-- Money that only covers the work on no bill leaves every bill owing.
SELECT bedt.bill('274', '27401', 13420, 'billed', 1), bedt.bill('274', '27402', 665, 'billed', 2), bedt.bill('274', '27403', 3500, 'billed', 3);
SELECT bedt.pay('274', NULL, 38780);
SELECT bedt.ok('$38,780 is exactly the work on no bill: the bills still owe $17,585', bedt.claim('274', 'billed', 56365, 38780) = 17585);

-- The oldest bill, marked paid with nothing tied to it, takes the money first whatever order the rows were written in.
SELECT bedt.bill('275', '27503', 3500, 'billed', 3), bedt.bill('275', '27501', 13420, 'paid', 1), bedt.bill('275', '27502', 665, 'billed', 2);
SELECT bedt.pay('275', NULL, 13420);
SELECT bedt.ok('sequence_order walks the bills: the paid oldest takes $13,420 and the billed two still owe $4,165', bedt.claim('275', 'billed', 17585, 13420) = 4165);

-- An older bill marked paid with nothing tied to it needs its $1,000 first; the $500 left lowers the billed one.
SELECT bedt.bill('1', '101', 1000, 'paid', 0), bedt.bill('1', '102', 2000, 'billed', 1);
SELECT bedt.pay('1', NULL, 1500);
SELECT bedt.ok('a paid bill takes its share in its turn: $1,500 owed', bedt.claim('1', 'billed', 3000, 1500) = 1500);

-- No revenue on file: nothing is set aside for work on no bill.
SELECT bedt.bill('2', '201', 2000, 'billed', 0), bedt.bill('2', '202', 2000, 'billed', 1);
SELECT bedt.pay('2', NULL, 1000);
SELECT bedt.ok('with no job total the rule is oldest bill first alone: $3,000 owed', bedt.claim('2', 'billed', NULL, 1000) = 3000);

-- Ties on sequence_order go to the earlier day: the earlier bill, paid with nothing tied to it, takes the money first.
SELECT bedt.bill('3', '301', 1000, 'billed', 0, '2026-09-30T15:00:00Z'), bedt.bill('3', '302', 1500, 'paid', 0, '2026-09-24T15:00:00Z');
SELECT bedt.pay('3', NULL, 1500);
SELECT bedt.ok('the earlier day goes first on a tie: the billed later bill still owes $1,000', bedt.claim('3', 'billed', 2500, 1500) = 1000);

-- A refund on the job is never applied to a bill.
SELECT bedt.bill('4', '401', 2000, 'billed', 0), bedt.bill('4', '402', 2000, 'billed', 1);
SELECT bedt.pay('4', NULL, 1000), bedt.pay('4', NULL, -400);
SELECT bedt.ok('a refund is not applied: $1,000 lowers the oldest bill, $3,000 owed', bedt.claim('4', 'billed', 4000, 600) = 3000);

-- A bill's own payments stay its own: an overpay is not moved to the next bill.
SELECT bedt.bill('5', '501', 2000, 'billed', 0), bedt.bill('5', '502', 2000, 'billed', 1);
SELECT bedt.pay('5', '501', 2500);
SELECT bedt.ok('$2,500 tied to the first bill covers it; the second still owes $2,000', bedt.claim('5', 'billed', 4000, 2500) = 2000);

-- A job billed as one shell (no bill sent) is price less payments; a job with nothing sent and not billed owes nothing.
SELECT bedt.ok('a shell job: $3,500 less $1,000', bedt.claim('6', 'billed', 3500, 1000) = 2500);
SELECT bedt.ok('a shell job paid over its price owes nothing', bedt.claim('6', 'billed', 3500, 4000) = 0);
SELECT bedt.ok('a working job with no bill sent owes nothing', bedt.claim('6', 'working', 3500, 0) = 0);
SELECT bedt.bill('7', '701', 1000, 'billed', 0);
SELECT bedt.ok('a sent bill is a sent bill whatever the job''s own status', bedt.claim('7', 'working', 3500, 0) = 1000);

SELECT 'lien_claim PASSED' AS result;
ROLLBACK;
