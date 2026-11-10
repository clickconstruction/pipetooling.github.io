SET lock_timeout = '3s';

-- One place for work paid in kind (punch list #301, PR 1 of four, v2.6827). In kind became a kind of payment in
-- v2.6816: a credit given instead of money pays a bill down and is never counted as cash. What the app did not know
-- is the deal behind the payments: who pays this way, with what, on which jobs, and what each thing given was. The
-- owner's calls of 2026-11-10: a ledger of lines entered as needed, each with an amount, a date and a memo of the
-- details, counted as overhead unless that line is put on a job. This file is the ground; no screen reads it yet
-- (PR 2 is the card on the customer's page, the ledger and Add a line).
--
--   1. in_kind_arrangements: one row a deal. The customer, what is given, a note of the terms, and for a deal with a
--      monthly amount the usual credit, the whole monthly bill it comes off, the name it goes out under at the bank and
--      its first month. ended_at closes it.
--   2. jobs_ledger.in_kind_arrangement_id: the jobs a deal pays. On the job's own row, so every reader that already
--      holds the job can say its open bill is scheduled in kind and not late.
--   3. in_kind_lines: one row a thing given. The date, the amount, the memo, the job it counts on as material (none
--      means overhead) and, for a monthly deal, the month it settles. An amount of zero with a month is "no credit this
--      month", so a month with the whole bill paid never reads as forgotten. Never deleted: removed_at takes one back.
--   4. in_kind_line_payments: the In kind payments a line wrote, so the ledger shows each line whole with the bills it
--      went to, and taking a line back removes exactly those payments.
--   5. The verbs. in_kind_line_add places a line on the deal's open bills, oldest first, through mark_invoice_paid and
--      mark_job_paid, all in one transaction, and with p_dry_run only says where it would go. A bill that is on Stripe
--      is passed over and named, since Stripe has to be told by the bill's own window. in_kind_line_remove takes a line
--      and its payments back. in_kind_line_set_cost moves a line between overhead and a job.
--      in_kind_arrangement_set_jobs says which jobs the deal pays.
--
-- Additive and idempotent. Three tables are created, so the four fences close the file. No client reads any of it
-- until PR 2, so the push may come at any time after the merge.

-- 1. The deal.
CREATE TABLE IF NOT EXISTS public.in_kind_arrangements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  partner_name text NOT NULL DEFAULT '' CHECK (length(partner_name) <= 200),
  what_given text NOT NULL CHECK (length(btrim(what_given)) BETWEEN 1 AND 200),
  note text NOT NULL DEFAULT '' CHECK (length(note) <= 1000),
  monthly_amount numeric(12, 2) CHECK (monthly_amount IS NULL OR (monthly_amount > 0 AND monthly_amount < 10000000)),
  monthly_due numeric(12, 2) CHECK (monthly_due IS NULL OR (monthly_due > 0 AND monthly_due < 10000000)),
  bank_payee text NOT NULL DEFAULT '' CHECK (length(bank_payee) <= 200),
  starts_on date,
  ended_at timestamptz,
  ended_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT in_kind_arrangements_monthly_is_whole CHECK ((monthly_amount IS NULL) = (starts_on IS NULL)),
  CONSTRAINT in_kind_arrangements_due_needs_monthly CHECK (monthly_due IS NULL OR (monthly_amount IS NOT NULL AND monthly_due >= monthly_amount)),
  CONSTRAINT in_kind_arrangements_starts_on_a_first CHECK (starts_on IS NULL OR starts_on = date_trunc('month', starts_on)::date)
);
CREATE INDEX IF NOT EXISTS in_kind_arrangements_customer_idx ON public.in_kind_arrangements (customer_id) WHERE customer_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS in_kind_arrangements_open_idx ON public.in_kind_arrangements (created_at DESC) WHERE ended_at IS NULL;
COMMENT ON TABLE public.in_kind_arrangements IS 'A deal where work is paid with something other than money (punch list #301): the customer, what is given, and for a monthly deal its amount, its first month and the bank line it comes off. Its jobs are jobs_ledger.in_kind_arrangement_id; what was given is in_kind_lines. Read and written by the office (is_office_staff).';
COMMENT ON COLUMN public.in_kind_arrangements.partner_name IS 'The customer''s name when the deal was made, kept so the deal still reads if the customer row is deleted.';
COMMENT ON COLUMN public.in_kind_arrangements.what_given IS 'What is given instead of money, in a few words: Rent credit, the shop. Concrete, as delivered.';
COMMENT ON COLUMN public.in_kind_arrangements.monthly_amount IS 'The usual credit a month. Set only on a deal with a schedule: the app then reminds each month and suggests the amount. Null is a deal that takes a line as things are given.';
COMMENT ON COLUMN public.in_kind_arrangements.monthly_due IS 'The whole monthly bill the credit comes off (the rent). With it and bank_payee the suggested credit is this less what left the bank that month: the usual credit in a month the rest was paid, all of it in a month nothing was.';
COMMENT ON COLUMN public.in_kind_arrangements.bank_payee IS 'The name the monthly bill goes out under at the bank, matched inside mercury_transactions.counterparty_name.';
COMMENT ON COLUMN public.in_kind_arrangements.starts_on IS 'The first month of a monthly deal, as the first of that month.';
COMMENT ON COLUMN public.in_kind_arrangements.ended_at IS 'When the deal was closed. Its jobs are released then (in_kind_arrangements_end_releases_jobs), so their bills read as ordinary bills again.';

-- 2. The jobs a deal pays.
ALTER TABLE public.jobs_ledger
  ADD COLUMN IF NOT EXISTS in_kind_arrangement_id uuid REFERENCES public.in_kind_arrangements(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS jobs_ledger_in_kind_arrangement_idx ON public.jobs_ledger (in_kind_arrangement_id) WHERE in_kind_arrangement_id IS NOT NULL;
COMMENT ON COLUMN public.jobs_ledger.in_kind_arrangement_id IS 'The in-kind deal that pays this job (punch list #301). Its open bill is scheduled in kind, not late. Written only by in_kind_arrangement_set_jobs; cleared when the deal ends.';

-- 3. What was given.
CREATE TABLE IF NOT EXISTS public.in_kind_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  arrangement_id uuid NOT NULL REFERENCES public.in_kind_arrangements(id) ON DELETE CASCADE,
  given_on date NOT NULL,
  amount numeric(12, 2) NOT NULL CHECK (amount >= 0 AND amount < 10000000),
  memo text NOT NULL CHECK (length(btrim(memo)) BETWEEN 1 AND 500),
  cost_job_id uuid REFERENCES public.jobs_ledger(id) ON DELETE SET NULL,
  for_month date CHECK (for_month IS NULL OR for_month = date_trunc('month', for_month)::date),
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  removed_at timestamptz,
  removed_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  CONSTRAINT in_kind_lines_zero_is_a_month CHECK (amount > 0 OR for_month IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS in_kind_lines_arrangement_idx ON public.in_kind_lines (arrangement_id, given_on DESC);
CREATE INDEX IF NOT EXISTS in_kind_lines_cost_job_idx ON public.in_kind_lines (cost_job_id) WHERE cost_job_id IS NOT NULL AND removed_at IS NULL;
CREATE INDEX IF NOT EXISTS in_kind_lines_overhead_idx ON public.in_kind_lines (given_on) WHERE cost_job_id IS NULL AND removed_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS in_kind_lines_one_per_month ON public.in_kind_lines (arrangement_id, for_month) WHERE for_month IS NOT NULL AND removed_at IS NULL;
COMMENT ON TABLE public.in_kind_lines IS 'One thing given instead of money (punch list #301): the date, the amount and a memo of the details. Written only by in_kind_line_add, in_kind_line_remove and in_kind_line_set_cost. The In kind payments it wrote are in_kind_line_payments.';
COMMENT ON COLUMN public.in_kind_lines.amount IS 'What it was worth. Zero only with for_month: no credit that month, since the whole monthly bill was paid.';
COMMENT ON COLUMN public.in_kind_lines.cost_job_id IS 'The job this line counts on as material. Null means it counts as overhead.';
COMMENT ON COLUMN public.in_kind_lines.for_month IS 'On a monthly deal, the month this line settles, as the first of that month. One live line a month. Null is a line outside the schedule.';
COMMENT ON COLUMN public.in_kind_lines.removed_at IS 'When the line was taken back. Its payments were removed then; the row stays as the record.';

-- 4. The payments a line wrote.
CREATE TABLE IF NOT EXISTS public.in_kind_line_payments (
  line_id uuid NOT NULL REFERENCES public.in_kind_lines(id) ON DELETE CASCADE,
  payment_id uuid NOT NULL REFERENCES public.jobs_ledger_payments(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (line_id, payment_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS in_kind_line_payments_payment_idx ON public.in_kind_line_payments (payment_id);
COMMENT ON TABLE public.in_kind_line_payments IS 'Which In kind payments (jobs_ledger_payments) a line wrote (punch list #301). A payment removed from its bill by hand drops its row here, so the line then reads as partly on no bill.';

-- The gates. The office reads and writes a deal; a line and its payments are read by the office and written only by
-- the functions below.
ALTER TABLE public.in_kind_arrangements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS in_kind_arrangements_select_office ON public.in_kind_arrangements;
CREATE POLICY in_kind_arrangements_select_office ON public.in_kind_arrangements FOR SELECT TO authenticated
  USING (public.is_office_staff());
DROP POLICY IF EXISTS in_kind_arrangements_insert_office ON public.in_kind_arrangements;
CREATE POLICY in_kind_arrangements_insert_office ON public.in_kind_arrangements FOR INSERT TO authenticated
  WITH CHECK (public.is_office_staff() AND created_by = auth.uid());
DROP POLICY IF EXISTS in_kind_arrangements_update_office ON public.in_kind_arrangements;
CREATE POLICY in_kind_arrangements_update_office ON public.in_kind_arrangements FOR UPDATE TO authenticated
  USING (public.is_office_staff()) WITH CHECK (public.is_office_staff());
-- A deal made by mistake goes, once nothing given stands on it.
DROP POLICY IF EXISTS in_kind_arrangements_delete_empty ON public.in_kind_arrangements;
CREATE POLICY in_kind_arrangements_delete_empty ON public.in_kind_arrangements FOR DELETE TO authenticated
  USING (public.is_office_staff() AND NOT EXISTS (
    SELECT 1 FROM public.in_kind_lines l WHERE l.arrangement_id = in_kind_arrangements.id AND l.removed_at IS NULL
  ));

ALTER TABLE public.in_kind_lines ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS in_kind_lines_select_office ON public.in_kind_lines;
CREATE POLICY in_kind_lines_select_office ON public.in_kind_lines FOR SELECT TO authenticated
  USING (public.is_office_staff());

ALTER TABLE public.in_kind_line_payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS in_kind_line_payments_select_office ON public.in_kind_line_payments;
CREATE POLICY in_kind_line_payments_select_office ON public.in_kind_line_payments FOR SELECT TO authenticated
  USING (public.is_office_staff());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.in_kind_arrangements TO authenticated;
GRANT SELECT ON public.in_kind_lines, public.in_kind_line_payments TO authenticated;
GRANT ALL ON public.in_kind_arrangements, public.in_kind_lines, public.in_kind_line_payments TO service_role;
REVOKE ALL ON public.in_kind_arrangements, public.in_kind_lines, public.in_kind_line_payments FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.in_kind_lines, public.in_kind_line_payments FROM authenticated;

-- A deal keeps its own clock, and its maker and its end are not rewritten by hand.
CREATE OR REPLACE FUNCTION public.in_kind_arrangements_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.created_at := now();
    NEW.updated_at := now();
    IF btrim(NEW.partner_name) = '' AND NEW.customer_id IS NOT NULL THEN
      NEW.partner_name := COALESCE((SELECT left(btrim(c.name), 200) FROM public.customers c WHERE c.id = NEW.customer_id), '');
    END IF;
    RETURN NEW;
  END IF;
  NEW.created_at := OLD.created_at;
  NEW.created_by := OLD.created_by;
  NEW.updated_at := now();
  IF NEW.ended_at IS NOT NULL AND OLD.ended_at IS NULL THEN
    NEW.ended_at := now();
    NEW.ended_by := auth.uid();
  ELSIF NEW.ended_at IS NULL THEN
    NEW.ended_by := NULL;
  ELSE
    NEW.ended_at := OLD.ended_at;
    NEW.ended_by := OLD.ended_by;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS in_kind_arrangements_guard ON public.in_kind_arrangements;
CREATE TRIGGER in_kind_arrangements_guard BEFORE INSERT OR UPDATE ON public.in_kind_arrangements
  FOR EACH ROW EXECUTE FUNCTION public.in_kind_arrangements_guard();

-- A deal that ends lets its jobs go, so their bills read as ordinary bills again.
CREATE OR REPLACE FUNCTION public.in_kind_arrangements_end_releases_jobs()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.ended_at IS NOT NULL AND OLD.ended_at IS NULL THEN
    UPDATE public.jobs_ledger SET in_kind_arrangement_id = NULL WHERE in_kind_arrangement_id = NEW.id;
  END IF;
  RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION public.in_kind_arrangements_end_releases_jobs() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS in_kind_arrangements_end_releases_jobs ON public.in_kind_arrangements;
CREATE TRIGGER in_kind_arrangements_end_releases_jobs AFTER UPDATE OF ended_at ON public.in_kind_arrangements
  FOR EACH ROW EXECUTE FUNCTION public.in_kind_arrangements_end_releases_jobs();

-- 5. The verbs.

-- Which jobs a deal pays. The whole list each time: a job left out is released.
CREATE OR REPLACE FUNCTION public.in_kind_arrangement_set_jobs(p_arrangement_id uuid, p_job_ids uuid[])
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_arr public.in_kind_arrangements%ROWTYPE;
  v_ids uuid[] := COALESCE(p_job_ids, '{}');
  v_n integer;
BEGIN
  IF auth.uid() IS NULL THEN RETURN jsonb_build_object('error', 'Not signed in.'); END IF;
  IF NOT public.is_office_staff() THEN RETURN jsonb_build_object('error', 'Only the office changes an in kind arrangement.'); END IF;
  SELECT * INTO v_arr FROM public.in_kind_arrangements WHERE id = p_arrangement_id FOR UPDATE;
  IF v_arr.id IS NULL THEN RETURN jsonb_build_object('error', 'That arrangement is gone.'); END IF;
  IF v_arr.ended_at IS NOT NULL THEN RETURN jsonb_build_object('error', 'This arrangement has ended.'); END IF;
  IF v_arr.customer_id IS NULL AND cardinality(v_ids) > 0 THEN RETURN jsonb_build_object('error', 'This arrangement has no customer, so it pays no job.'); END IF;
  IF cardinality(v_ids) > 500 THEN RETURN jsonb_build_object('error', 'That is too many jobs for one arrangement.'); END IF;

  SELECT count(*) INTO v_n FROM unnest(v_ids) AS x(id) WHERE NOT EXISTS (SELECT 1 FROM public.jobs_ledger j WHERE j.id = x.id);
  IF v_n > 0 THEN RETURN jsonb_build_object('error', 'A job in the list is gone.'); END IF;
  SELECT count(*) INTO v_n FROM public.jobs_ledger j
    WHERE j.id = ANY (v_ids) AND j.customer_id IS DISTINCT FROM v_arr.customer_id AND j.gc_customer_id IS DISTINCT FROM v_arr.customer_id;
  IF v_n > 0 THEN RETURN jsonb_build_object('error', 'A job in the list belongs to another customer.'); END IF;
  SELECT count(*) INTO v_n FROM public.jobs_ledger j
    WHERE j.id = ANY (v_ids) AND j.in_kind_arrangement_id IS NOT NULL AND j.in_kind_arrangement_id <> v_arr.id;
  IF v_n > 0 THEN RETURN jsonb_build_object('error', 'A job in the list is already paid by another arrangement.'); END IF;

  UPDATE public.jobs_ledger SET in_kind_arrangement_id = NULL
    WHERE in_kind_arrangement_id = v_arr.id AND NOT (id = ANY (v_ids));
  UPDATE public.jobs_ledger SET in_kind_arrangement_id = v_arr.id
    WHERE id = ANY (v_ids) AND in_kind_arrangement_id IS DISTINCT FROM v_arr.id;
  UPDATE public.in_kind_arrangements SET updated_at = now() WHERE id = v_arr.id;
  RETURN jsonb_build_object('ok', true, 'jobs', cardinality(v_ids));
END $$;
REVOKE ALL ON FUNCTION public.in_kind_arrangement_set_jobs(uuid, uuid[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.in_kind_arrangement_set_jobs(uuid, uuid[]) TO authenticated, service_role;
COMMENT ON FUNCTION public.in_kind_arrangement_set_jobs(uuid, uuid[]) IS 'In kind (punch list #301): the jobs a deal pays, the whole list each time. Office only. Refuses a job of another customer and a job another deal already pays. Returns {ok, jobs} or {error}.';

-- A line, placed on the deal's open bills, oldest first. With p_dry_run it writes nothing and says where it would go.
CREATE OR REPLACE FUNCTION public.in_kind_line_add(
  p_arrangement_id uuid,
  p_given_on date,
  p_amount numeric,
  p_memo text,
  p_cost_job_id uuid DEFAULT NULL,
  p_for_month date DEFAULT NULL,
  p_dry_run boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_arr public.in_kind_arrangements%ROWTYPE;
  v_amount numeric := round(COALESCE(p_amount, 0), 2);
  v_memo text := btrim(COALESCE(p_memo, ''));
  v_month date := date_trunc('month', p_for_month)::date;
  v_left numeric;
  v_take numeric;
  v_job_left numeric;
  v_used jsonb := '{}'::jsonb;
  v_applied jsonb := '[]'::jsonb;
  v_held jsonb := '[]'::jsonb;
  v_line_id uuid;
  v_res jsonb;
  v_pay_id uuid;
  v_note text;
  v_chunk jsonb;
  r record;
BEGIN
  IF auth.uid() IS NULL THEN RETURN jsonb_build_object('error', 'Not signed in.'); END IF;
  IF NOT public.is_office_staff() THEN RETURN jsonb_build_object('error', 'Only the office records what was given in kind.'); END IF;
  -- The deal's row is the lock: two people adding a line at once take turns, so neither pays the same bill twice.
  IF p_dry_run THEN
    SELECT * INTO v_arr FROM public.in_kind_arrangements WHERE id = p_arrangement_id;
  ELSE
    SELECT * INTO v_arr FROM public.in_kind_arrangements WHERE id = p_arrangement_id FOR UPDATE;
  END IF;
  IF v_arr.id IS NULL THEN RETURN jsonb_build_object('error', 'That arrangement is gone.'); END IF;
  IF v_arr.ended_at IS NOT NULL THEN RETURN jsonb_build_object('error', 'This arrangement has ended.'); END IF;
  IF p_given_on IS NULL THEN RETURN jsonb_build_object('error', 'Pick the date it was given.'); END IF;
  IF p_given_on > public.app_today() + 1 THEN RETURN jsonb_build_object('error', 'That date has not come yet.'); END IF;
  IF v_amount < 0 OR v_amount >= 10000000 THEN RETURN jsonb_build_object('error', 'Enter an amount.'); END IF;
  IF v_amount = 0 AND v_month IS NULL THEN RETURN jsonb_build_object('error', 'Enter an amount above zero.'); END IF;
  IF v_memo = '' THEN RETURN jsonb_build_object('error', 'Say what was given instead of money.'); END IF;
  IF length(v_memo) > 500 THEN RETURN jsonb_build_object('error', 'Keep the memo under 500 letters.'); END IF;
  IF v_month IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.in_kind_lines l WHERE l.arrangement_id = v_arr.id AND l.for_month = v_month AND l.removed_at IS NULL
  ) THEN
    RETURN jsonb_build_object('error', 'That month already has its line.');
  END IF;
  IF p_cost_job_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.jobs_ledger j WHERE j.id = p_cost_job_id) THEN
    RETURN jsonb_build_object('error', 'The job to count it on is gone.');
  END IF;

  -- Where it goes: the deal's billed jobs, the oldest bill first. A job billed with no bill row takes it on the job.
  v_left := v_amount;
  FOR r IN
    SELECT b.*
    FROM (
      SELECT j.id AS job_id, i.id AS invoice_id, j.hcp_number, j.click_number, j.job_name,
        COALESCE(i.billed_at, i.created_at, j.created_at) AS bill_at, j.created_at AS job_at, COALESCE(i.sequence_order, 0) AS seq,
        GREATEST(0, COALESCE(i.amount, 0) - COALESCE((SELECT sum(p.amount) FROM public.jobs_ledger_payments p WHERE p.invoice_id = i.id), 0)) AS bill_left,
        GREATEST(0, COALESCE(j.revenue, 0) - COALESCE(j.payments_made, 0)) AS job_left,
        NULLIF(btrim(COALESCE(i.stripe_invoice_id, '')), '') IS NOT NULL AS on_stripe
      FROM public.jobs_ledger j
      JOIN public.jobs_ledger_invoices i ON i.job_id = j.id AND i.status = 'billed'
      WHERE j.in_kind_arrangement_id = v_arr.id AND j.status = 'billed'
      UNION ALL
      SELECT j.id, NULL::uuid, j.hcp_number, j.click_number, j.job_name,
        j.created_at, j.created_at, 0,
        GREATEST(0, COALESCE(j.revenue, 0) - COALESCE(j.payments_made, 0)),
        GREATEST(0, COALESCE(j.revenue, 0) - COALESCE(j.payments_made, 0)),
        false
      FROM public.jobs_ledger j
      WHERE j.in_kind_arrangement_id = v_arr.id AND j.status = 'billed'
        AND NOT EXISTS (SELECT 1 FROM public.jobs_ledger_invoices i WHERE i.job_id = j.id)
    ) b
    WHERE b.bill_left > 0
    ORDER BY b.bill_at, b.job_at, b.job_id, b.seq, b.invoice_id
  LOOP
    EXIT WHEN v_left <= 0;
    IF r.on_stripe THEN
      v_held := v_held || jsonb_build_object('job_id', r.job_id, 'invoice_id', r.invoice_id, 'hcp_number', r.hcp_number,
        'click_number', r.click_number, 'job_name', r.job_name, 'open', r.bill_left, 'why', 'stripe');
      CONTINUE;
    END IF;
    v_job_left := r.job_left - COALESCE((v_used ->> r.job_id::text)::numeric, 0);
    v_take := LEAST(v_left, r.bill_left, v_job_left);
    CONTINUE WHEN v_take <= 0;
    v_applied := v_applied || jsonb_build_object('job_id', r.job_id, 'invoice_id', r.invoice_id, 'hcp_number', r.hcp_number,
      'click_number', r.click_number, 'job_name', r.job_name, 'amount', v_take, 'left_after', r.bill_left - v_take,
      'pays_off', v_take >= r.bill_left);
    v_used := jsonb_set(v_used, ARRAY[r.job_id::text], to_jsonb(COALESCE((v_used ->> r.job_id::text)::numeric, 0) + v_take));
    v_left := v_left - v_take;
  END LOOP;

  IF p_dry_run THEN
    RETURN jsonb_build_object('ok', true, 'dry_run', true, 'applied', v_applied, 'held', v_held, 'unapplied', v_left);
  END IF;

  INSERT INTO public.in_kind_lines (arrangement_id, given_on, amount, memo, cost_job_id, for_month, created_by)
  VALUES (v_arr.id, p_given_on, v_amount, v_memo, p_cost_job_id, v_month, auth.uid())
  RETURNING id INTO v_line_id;

  FOR v_chunk IN SELECT * FROM jsonb_array_elements(v_applied) LOOP
    v_take := (v_chunk ->> 'amount')::numeric;
    -- The bill's own memo says which part of the line it carries, as the office wrote it by hand before.
    v_note := CASE
      WHEN v_take = v_amount THEN v_memo
      ELSE left(v_memo, 400) || ': $' || btrim(to_char(v_take, 'FM999,999,990.00')) || ' of the $' || btrim(to_char(v_amount, 'FM999,999,990.00')) || ' given'
    END;
    IF v_chunk ->> 'invoice_id' IS NOT NULL THEN
      v_res := public.mark_invoice_paid((v_chunk ->> 'invoice_id')::uuid, v_take, p_given_on, v_note, 'In kind', NULL);
    ELSE
      v_res := public.mark_job_paid((v_chunk ->> 'job_id')::uuid, v_take, p_given_on, v_note, 'In kind', NULL);
    END IF;
    IF v_res ? 'error' THEN
      RAISE EXCEPTION 'The line was not saved. %', v_res ->> 'error' USING ERRCODE = 'P0001';
    END IF;
    SELECT p.id INTO v_pay_id
    FROM public.jobs_ledger_payments p
    WHERE p.job_id = (v_chunk ->> 'job_id')::uuid
      AND p.invoice_id IS NOT DISTINCT FROM (v_chunk ->> 'invoice_id')::uuid
      AND p.amount = v_take AND p.payment_type = 'In kind'
      AND NOT EXISTS (SELECT 1 FROM public.in_kind_line_payments lp WHERE lp.payment_id = p.id)
    ORDER BY p.sequence_order DESC
    LIMIT 1;
    IF v_pay_id IS NULL THEN
      RAISE EXCEPTION 'The line was not saved. Its payment could not be read back.' USING ERRCODE = 'P0001';
    END IF;
    INSERT INTO public.in_kind_line_payments (line_id, payment_id) VALUES (v_line_id, v_pay_id);
  END LOOP;

  UPDATE public.in_kind_arrangements SET updated_at = now() WHERE id = v_arr.id;
  RETURN jsonb_build_object('ok', true, 'line_id', v_line_id, 'applied', v_applied, 'held', v_held, 'unapplied', v_left);
END $$;
REVOKE ALL ON FUNCTION public.in_kind_line_add(uuid, date, numeric, text, uuid, date, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.in_kind_line_add(uuid, date, numeric, text, uuid, date, boolean) TO authenticated, service_role;
COMMENT ON FUNCTION public.in_kind_line_add(uuid, date, numeric, text, uuid, date, boolean) IS 'In kind (punch list #301): one thing given (date, amount, memo), placed on the deal''s open bills oldest first as In kind payments through mark_invoice_paid and mark_job_paid, in one transaction. p_cost_job_id counts it on a job as material, else overhead. p_for_month settles a month of a monthly deal (amount 0 = no credit that month). A bill on Stripe is passed over and returned in held. p_dry_run writes nothing. Office only. Returns {ok, line_id, applied[], held[], unapplied} or {error}.';

-- A line taken back: its payments leave their bills, the row stays as the record.
CREATE OR REPLACE FUNCTION public.in_kind_line_remove(p_line_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_line public.in_kind_lines%ROWTYPE;
  v_res jsonb;
  v_n integer := 0;
  r record;
BEGIN
  IF auth.uid() IS NULL THEN RETURN jsonb_build_object('error', 'Not signed in.'); END IF;
  IF NOT public.is_office_staff() THEN RETURN jsonb_build_object('error', 'Only the office takes back what was given in kind.'); END IF;
  SELECT * INTO v_line FROM public.in_kind_lines WHERE id = p_line_id FOR UPDATE;
  IF v_line.id IS NULL THEN RETURN jsonb_build_object('error', 'That line is gone.'); END IF;
  IF v_line.removed_at IS NOT NULL THEN RETURN jsonb_build_object('error', 'That line was already taken back.'); END IF;
  PERFORM 1 FROM public.in_kind_arrangements WHERE id = v_line.arrangement_id FOR UPDATE;

  FOR r IN SELECT lp.payment_id FROM public.in_kind_line_payments lp WHERE lp.line_id = v_line.id LOOP
    v_res := public.remove_jobs_ledger_payment_and_reconcile(r.payment_id);
    IF v_res ? 'error' THEN
      RAISE EXCEPTION 'The line was not taken back. %', v_res ->> 'error' USING ERRCODE = 'P0001';
    END IF;
    v_n := v_n + 1;
  END LOOP;
  UPDATE public.in_kind_lines SET removed_at = now(), removed_by = auth.uid() WHERE id = v_line.id;
  UPDATE public.in_kind_arrangements SET updated_at = now() WHERE id = v_line.arrangement_id;
  RETURN jsonb_build_object('ok', true, 'payments_removed', v_n);
END $$;
REVOKE ALL ON FUNCTION public.in_kind_line_remove(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.in_kind_line_remove(uuid) TO authenticated, service_role;
COMMENT ON FUNCTION public.in_kind_line_remove(uuid) IS 'In kind (punch list #301): takes a line back. Each payment it wrote is removed through remove_jobs_ledger_payment_and_reconcile, so its bill and job reopen; the line stays with removed_at. Office only. Returns {ok, payments_removed} or {error}.';

-- What a line counts as: overhead (null) or a job's material.
CREATE OR REPLACE FUNCTION public.in_kind_line_set_cost(p_line_id uuid, p_cost_job_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_line public.in_kind_lines%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN RETURN jsonb_build_object('error', 'Not signed in.'); END IF;
  IF NOT public.is_office_staff() THEN RETURN jsonb_build_object('error', 'Only the office changes what a line counts as.'); END IF;
  SELECT * INTO v_line FROM public.in_kind_lines WHERE id = p_line_id FOR UPDATE;
  IF v_line.id IS NULL THEN RETURN jsonb_build_object('error', 'That line is gone.'); END IF;
  IF v_line.removed_at IS NOT NULL THEN RETURN jsonb_build_object('error', 'That line was taken back.'); END IF;
  IF p_cost_job_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.jobs_ledger j WHERE j.id = p_cost_job_id) THEN
    RETURN jsonb_build_object('error', 'The job to count it on is gone.');
  END IF;
  UPDATE public.in_kind_lines SET cost_job_id = p_cost_job_id WHERE id = v_line.id;
  RETURN jsonb_build_object('ok', true);
END $$;
REVOKE ALL ON FUNCTION public.in_kind_line_set_cost(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.in_kind_line_set_cost(uuid, uuid) TO authenticated, service_role;
COMMENT ON FUNCTION public.in_kind_line_set_cost(uuid, uuid) IS 'In kind (punch list #301): what a line counts as. A job id counts it on that job as material; null counts it as overhead. Office only. Returns {ok} or {error}.';

SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
SELECT public.apply_digital_twin_write_blocks();
SELECT public.apply_archived_read_blocks();
