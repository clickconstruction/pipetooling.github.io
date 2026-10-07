SET lock_timeout = '3s';

-- GC mode, the real build, Owner Billing's O1 (v2.4831): the tables, from the prototype's model
-- (to-dos/gc-mode/OWNER_BILLING_REAL_BUILD.md on branch spike/gc-mode, "The tables"). On the
-- project: the day our contract with the customer was signed, the retainage the customer holds and
-- its step, interest on late bills, the contract's late fee a day, its days to pay, and the
-- billing job (decision 1). Then the customer's price as signed, by line; change orders to the
-- customer; our pay applications as each went, with their lines; our reminders to pay; interest
-- bills; the customer's acceptance of the work. And gc_sign_owner_contract, which the Board's Get
-- started (B6) calls for "Owner contract signed".
--
-- gc_schedule_moves.change_order_id gains its foreign key here, the one that column's comment
-- waits for. It was the schedule's PR 16 reader's to add; Helper 1 (the schedule) agreed on
-- 2026-10-07 that it ride in O1. It changes no column of that table.
--
-- The bill on the billing job (each pay application's and interest bill's invoice_id) and our
-- conditional waiver's link come with O4a, which first uses them, so only billing_job_id leans on
-- decision 1 until then. Who sees all of it (decision 2): dev only while it is built; a door PR
-- opens it to the owner and the controller. Nothing reads or writes these yet.

-- On the project (gc_projects is New Project's table; these columns are Owner Billing's).
ALTER TABLE public.gc_projects
  -- Written only by gc_sign_owner_contract, with the price by line (GcProject.ownerContractSignedOn).
  ADD COLUMN IF NOT EXISTS owner_contract_signed_on date,
  -- What the customer holds back on each bill, in percent (decision 6; the prototype read it off the
  -- customer record, which customers does not have).
  ADD COLUMN IF NOT EXISTS owner_retainage_pct numeric NOT NULL DEFAULT 10
    CONSTRAINT gc_projects_owner_retainage_pct_known CHECK (owner_retainage_pct >= 0 AND owner_retainage_pct <= 100),
  -- Retainage that drops once the work is far enough along (OwnerRetainageStep). All three null:
  -- held to the end.
  ADD COLUMN IF NOT EXISTS owner_retainage_step_at_pct numeric,
  ADD COLUMN IF NOT EXISTS owner_retainage_step_to_pct numeric,
  ADD COLUMN IF NOT EXISTS owner_retainage_step_way text,
  -- Interest on late bills, a percent a month (ownerLateInterest). Null: we do not charge it.
  ADD COLUMN IF NOT EXISTS owner_late_interest_pct_per_month numeric
    CONSTRAINT gc_projects_owner_late_interest_positive CHECK (owner_late_interest_pct_per_month IS NULL OR owner_late_interest_pct_per_month > 0),
  -- The contract's late fee a day past substantial completion (ownerLateFinish). Null: none.
  ADD COLUMN IF NOT EXISTS owner_late_finish_per_day numeric
    CONSTRAINT gc_projects_owner_late_finish_counted CHECK (owner_late_finish_per_day IS NULL OR owner_late_finish_per_day >= 0),
  -- The contract's days to pay after the architect's certificate (decision 7). Null: not typed yet.
  ADD COLUMN IF NOT EXISTS owner_pay_days integer
    CONSTRAINT gc_projects_owner_pay_days_counted CHECK (owner_pay_days IS NULL OR (owner_pay_days >= 0 AND owner_pay_days <= 365)),
  -- The Pipeline job that carries the project's bills (decision 1), made by the first send (O4a).
  ADD COLUMN IF NOT EXISTS billing_job_id uuid REFERENCES public.jobs_ledger(id) ON DELETE SET NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'gc_projects_owner_retainage_step_whole') THEN
    ALTER TABLE public.gc_projects
      ADD CONSTRAINT gc_projects_owner_retainage_step_whole CHECK (
        (owner_retainage_step_at_pct IS NULL AND owner_retainage_step_to_pct IS NULL AND owner_retainage_step_way IS NULL)
        OR (owner_retainage_step_at_pct IS NOT NULL AND owner_retainage_step_to_pct IS NOT NULL AND owner_retainage_step_way IS NOT NULL
          AND owner_retainage_step_at_pct > 0 AND owner_retainage_step_at_pct < 100
          AND owner_retainage_step_to_pct >= 0 AND owner_retainage_step_to_pct < owner_retainage_pct
          AND owner_retainage_step_way IN ('after', 'all'))
      );
  END IF;
  -- One project to a billing job.
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'gc_projects_billing_job_once') THEN
    ALTER TABLE public.gc_projects
      ADD CONSTRAINT gc_projects_billing_job_once UNIQUE (billing_job_id);
  END IF;
END $$;

-- The customer's price as signed, by line (GcProject.ownerContractWorth): each trade, then our
-- general conditions, contingency and fee. Written all at once by gc_sign_owner_contract, so buying
-- a trade out for more or less never changes it; only a change order does.
CREATE TABLE IF NOT EXISTS public.gc_owner_contract_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.gc_projects(project_id) ON DELETE CASCADE,
  line text NOT NULL
    CONSTRAINT gc_owner_contract_lines_line_known CHECK (line IN ('trade', 'gc', 'contingency', 'fee')),
  -- The trade, on a trade's line only. A trade with a signed price is not deleted; the check waits
  -- for the end of the transaction, so a whole project still goes by cascade.
  package_id uuid REFERENCES public.gc_trade_packages(id) DEFERRABLE INITIALLY DEFERRED,
  worth numeric NOT NULL
    CONSTRAINT gc_owner_contract_lines_worth_counted CHECK (worth >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT gc_owner_contract_lines_trade_named CHECK ((line = 'trade') = (package_id IS NOT NULL)),
  CONSTRAINT gc_owner_contract_lines_one_each UNIQUE NULLS NOT DISTINCT (project_id, line, package_id)
);

COMMENT ON TABLE public.gc_owner_contract_lines IS
  'GC mode (v2.4831): the customer''s price on a GC project as they signed it, by line (ownerContractWorth): each trade, then general conditions, contingency and fee. Written all at once by gc_sign_owner_contract; Bill the customer bills from it.';

CREATE INDEX IF NOT EXISTS gc_owner_contract_lines_package_idx ON public.gc_owner_contract_lines (package_id) WHERE package_id IS NOT NULL;

-- Changes to our contract with the customer (ChangeOrder): what changed, what it costs us, what it
-- adds to their price, the days it adds, and their answer. An RFI and a trade's ask keep their own
-- link to the change order they started (gc_rfis.change_order_id, gc_trade_change_requests.change_order_id);
-- the trade's side of a signed one is Building's (gc_change_order_trade_sends).
CREATE TABLE IF NOT EXISTS public.gc_change_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.gc_projects(project_id) ON DELETE CASCADE,
  -- Given at the draft, one up from the project's last.
  number integer NOT NULL
    CONSTRAINT gc_change_orders_number_counted CHECK (number >= 1),
  description text NOT NULL
    CONSTRAINT gc_change_orders_described CHECK (btrim(description) <> ''),
  reason text NOT NULL
    CONSTRAINT gc_change_orders_reason_known CHECK (reason IN ('owner', 'field', 'plans')),
  -- What it does to the schedule, in plain words ("+2 working days", "none").
  schedule_words text NOT NULL DEFAULT 'none',
  -- The trade the work belongs to. Null: our own work, under general conditions. Deferred, as above.
  package_id uuid REFERENCES public.gc_trade_packages(id) DEFERRABLE INITIALLY DEFERRED,
  -- What the work costs us, and what it adds to the customer's price. Negative: a credit.
  cost numeric NOT NULL DEFAULT 0,
  price numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'draft'
    CONSTRAINT gc_change_orders_status_known CHECK (status IN ('draft', 'sent', 'signed', 'declined')),
  sent_on date,
  -- The day the customer signed or declined it, and whether the office recorded it or they pressed
  -- it in their portal (decision 5).
  answered_on date,
  answered_how text
    CONSTRAINT gc_change_orders_answered_how_known CHECK (answered_how IS NULL OR answered_how IN ('office', 'portal')),
  -- Percent of its work done, for the customer's bill, until the trade's own report takes over.
  pct_done numeric NOT NULL DEFAULT 0
    CONSTRAINT gc_change_orders_pct_counted CHECK (pct_done >= 0 AND pct_done <= 100),
  -- The days it adds to the job. A signed one adds them to the contract time.
  days integer NOT NULL DEFAULT 0
    CONSTRAINT gc_change_orders_days_counted CHECK (days >= 0),
  -- A time extension (G-141): the schedule moves whose days it asks for. Null: an ordinary change order.
  days_on_chart uuid[],
  -- The set of plans that started it, if one did.
  plan_set_id uuid REFERENCES public.gc_plan_sets(id) ON DELETE SET NULL,
  created_by uuid DEFAULT auth.uid() REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT gc_change_orders_number_once UNIQUE (project_id, number),
  CONSTRAINT gc_change_orders_sent_dated CHECK (status = 'draft' OR sent_on IS NOT NULL),
  CONSTRAINT gc_change_orders_answer_dated CHECK (
    (status IN ('signed', 'declined')) = (answered_on IS NOT NULL AND answered_how IS NOT NULL)
  ),
  CONSTRAINT gc_change_orders_time_extension_priceless CHECK (days_on_chart IS NULL OR (cost = 0 AND price = 0))
);

COMMENT ON TABLE public.gc_change_orders IS
  'GC mode (v2.4831): a change to our contract with the customer on a GC project (ChangeOrder): what changed and why, whose work, what it costs us and adds to their price, the days it adds, sent, signed or declined, and its percent done for the bill. A time extension names the schedule moves its days come from.';

CREATE INDEX IF NOT EXISTS gc_change_orders_package_idx ON public.gc_change_orders (package_id) WHERE package_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS gc_change_orders_plan_set_idx ON public.gc_change_orders (plan_set_id) WHERE plan_set_id IS NOT NULL;

-- The schedule's moves name the signed change order whose days they put on the chart (G-76).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'gc_schedule_moves_change_order_fkey') THEN
    ALTER TABLE public.gc_schedule_moves
      ADD CONSTRAINT gc_schedule_moves_change_order_fkey
      FOREIGN KEY (change_order_id) REFERENCES public.gc_change_orders(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Our pay applications to the customer, each as it went (OwnerPayAppSent). The next one starts from
-- the last one's lines. Never changed once sent, but for the architect's certificate (privileges
-- below). Paid is not stored: it is read from the bill's payments once the bill exists (O4a).
CREATE TABLE IF NOT EXISTS public.gc_owner_pay_apps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.gc_projects(project_id) ON DELETE CASCADE,
  number integer NOT NULL
    CONSTRAINT gc_owner_pay_apps_number_counted CHECK (number >= 1),
  -- The final pay application: it asks for what the customer held.
  final boolean NOT NULL DEFAULT false,
  -- The bill day it went for, and the day it went.
  period_to date NOT NULL,
  sent_on date NOT NULL,
  sent_by uuid DEFAULT auth.uid() REFERENCES public.users(id) ON DELETE SET NULL,
  -- The retainage it went under: the percent, and the step if the job had one then.
  retainage_pct numeric NOT NULL
    CONSTRAINT gc_owner_pay_apps_retainage_pct_known CHECK (retainage_pct >= 0 AND retainage_pct <= 100),
  retainage_step_at_pct numeric,
  retainage_step_to_pct numeric,
  retainage_step_way text,
  -- What the customer holds on the work so far, every line's work so far, and what it asked.
  retainage numeric NOT NULL
    CONSTRAINT gc_owner_pay_apps_retainage_counted CHECK (retainage >= 0),
  work_to_date numeric NOT NULL
    CONSTRAINT gc_owner_pay_apps_work_counted CHECK (work_to_date >= 0),
  due numeric NOT NULL
    CONSTRAINT gc_owner_pay_apps_asks CHECK (due > 0),
  -- The architect's certificate, for what we asked or less (decision 4: the office types it).
  -- Null: waiting on the architect.
  certified numeric,
  certified_on date,
  certified_note text NOT NULL DEFAULT '',
  certified_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT gc_owner_pay_apps_number_once UNIQUE (project_id, number),
  CONSTRAINT gc_owner_pay_apps_step_whole CHECK (
    (retainage_step_at_pct IS NULL AND retainage_step_to_pct IS NULL AND retainage_step_way IS NULL)
    OR (retainage_step_at_pct IS NOT NULL AND retainage_step_to_pct IS NOT NULL AND retainage_step_way IS NOT NULL
      AND retainage_step_at_pct > 0 AND retainage_step_at_pct < 100
      AND retainage_step_to_pct >= 0 AND retainage_step_to_pct < retainage_pct
      AND retainage_step_way IN ('after', 'all'))
  ),
  CONSTRAINT gc_owner_pay_apps_final_holds_nothing CHECK (NOT final OR retainage = 0),
  CONSTRAINT gc_owner_pay_apps_certified_dated CHECK ((certified IS NULL) = (certified_on IS NULL)),
  CONSTRAINT gc_owner_pay_apps_certified_at_most_asked CHECK (certified IS NULL OR (certified >= 0 AND certified <= round(due, 2))),
  -- Less than we asked says why.
  CONSTRAINT gc_owner_pay_apps_certified_less_said CHECK (
    certified IS NULL OR certified >= round(due, 2) OR btrim(certified_note) <> ''
  )
);

COMMENT ON TABLE public.gc_owner_pay_apps IS
  'GC mode (v2.4831): our pay applications to the customer on a GC project, each as it went (OwnerPayAppSent): the bill day, the retainage and its step, work so far, what it asked, the final one, and the architect''s certificate. Never changed once sent but for the certificate. Its lines are gc_owner_pay_app_lines.';

-- One final pay application a project.
CREATE UNIQUE INDEX IF NOT EXISTS gc_owner_pay_apps_one_final ON public.gc_owner_pay_apps (project_id) WHERE final;

-- Each line of a sent pay application (doneToDate, worthByLine, storedByLine), kept before our
-- costs and fee are spread into the trades: the fee is a line here. The printed G703 is rebuilt
-- from these (spreadMarkup), never stored.
CREATE TABLE IF NOT EXISTS public.gc_owner_pay_app_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pay_app_id uuid NOT NULL REFERENCES public.gc_owner_pay_apps(id) ON DELETE CASCADE,
  -- The line's place on the bill.
  position integer NOT NULL DEFAULT 0,
  line text NOT NULL
    CONSTRAINT gc_owner_pay_app_lines_line_known CHECK (line IN ('trade', 'self', 'gc', 'contingency', 'fee', 'change_order')),
  -- A billed trade or change order is not deleted; deferred, as on the contract's lines.
  package_id uuid REFERENCES public.gc_trade_packages(id) DEFERRABLE INITIALLY DEFERRED,
  change_order_id uuid REFERENCES public.gc_change_orders(id) DEFERRABLE INITIALLY DEFERRED,
  -- The line's name as it went.
  label text NOT NULL,
  -- Its worth when it went, the work done on it so far, and the materials stored on site (column F).
  worth numeric NOT NULL,
  done_to_date numeric NOT NULL,
  stored numeric NOT NULL DEFAULT 0
    CONSTRAINT gc_owner_pay_app_lines_stored_counted CHECK (stored >= 0),
  CONSTRAINT gc_owner_pay_app_lines_keyed CHECK (
    (line IN ('trade', 'self') AND package_id IS NOT NULL AND change_order_id IS NULL)
    OR (line = 'change_order' AND change_order_id IS NOT NULL AND package_id IS NULL)
    OR (line IN ('gc', 'contingency', 'fee') AND package_id IS NULL AND change_order_id IS NULL)
  ),
  CONSTRAINT gc_owner_pay_app_lines_one_each UNIQUE NULLS NOT DISTINCT (pay_app_id, line, package_id, change_order_id)
);

COMMENT ON TABLE public.gc_owner_pay_app_lines IS
  'GC mode (v2.4831): one line of a pay application we sent the customer, as it went: a trade, our own crew, general conditions, contingency, fee or a change order, with its worth, the work done so far and what was stored on site. Kept before the spread, so only the owner and the controller read it once opened.';

CREATE INDEX IF NOT EXISTS gc_owner_pay_app_lines_package_idx ON public.gc_owner_pay_app_lines (package_id) WHERE package_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS gc_owner_pay_app_lines_change_order_idx ON public.gc_owner_pay_app_lines (change_order_id) WHERE change_order_id IS NOT NULL;

-- Our asks to pay a late bill (OwnerPayAppSent.reminders): never a promise, and the day it was due
-- stays. The RPC that writes one (O5) also writes a chase touch on the billing job.
CREATE TABLE IF NOT EXISTS public.gc_owner_pay_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pay_app_id uuid NOT NULL REFERENCES public.gc_owner_pay_apps(id) ON DELETE CASCADE,
  sent_on date NOT NULL,
  sent_by uuid DEFAULT auth.uid() REFERENCES public.users(id) ON DELETE SET NULL,
  -- The day we asked them to pay by.
  pay_by date NOT NULL,
  -- The office's own line in it.
  note text NOT NULL DEFAULT '',
  -- The email as it went, a paragraph a line.
  subject text NOT NULL
    CONSTRAINT gc_owner_pay_reminders_subject_said CHECK (btrim(subject) <> ''),
  lines text[] NOT NULL,
  email_send_log_id uuid REFERENCES public.email_send_log(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.gc_owner_pay_reminders IS
  'GC mode (v2.4831): a reminder we sent the customer to pay a late pay application on a GC project: when, the pay-by day we asked for, the office''s line, and the email as it went. Never a promise. Append only.';

CREATE INDEX IF NOT EXISTS gc_owner_pay_reminders_pay_app_idx ON public.gc_owner_pay_reminders (pay_app_id, created_at);

-- Bills for the interest on late bills (OwnerInterestBill): a bill of its own, never on the pay
-- application. Its bill on the billing job, and so its payments, come with O4a.
CREATE TABLE IF NOT EXISTS public.gc_owner_interest_bills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.gc_projects(project_id) ON DELETE CASCADE,
  number integer NOT NULL
    CONSTRAINT gc_owner_interest_bills_number_counted CHECK (number >= 1),
  sent_on date NOT NULL,
  amount numeric NOT NULL
    CONSTRAINT gc_owner_interest_bills_amount_counted CHECK (amount > 0),
  created_by uuid DEFAULT auth.uid() REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT gc_owner_interest_bills_number_once UNIQUE (project_id, number)
);

COMMENT ON TABLE public.gc_owner_interest_bills IS
  'GC mode (v2.4831): a bill for the interest built up on a GC project''s late pay applications (OwnerInterestBill), its own bill and never a line on the pay application. Append only.';

-- The customer accepts the work (OwnerBilling.acceptedOn): our final pay application waits for it.
CREATE TABLE IF NOT EXISTS public.gc_owner_acceptances (
  project_id uuid PRIMARY KEY REFERENCES public.gc_projects(project_id) ON DELETE CASCADE,
  accepted_on date NOT NULL,
  -- Who walked it and accepted it, by name.
  accepted_by_name text NOT NULL
    CONSTRAINT gc_owner_acceptances_named CHECK (btrim(accepted_by_name) <> ''),
  -- The office recorded it, or they pressed it in their portal (decision 5).
  how text NOT NULL
    CONSTRAINT gc_owner_acceptances_how_known CHECK (how IN ('office', 'portal')),
  note text NOT NULL DEFAULT '',
  recorded_by uuid DEFAULT auth.uid() REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.gc_owner_acceptances IS
  'GC mode (v2.4831): the day the customer accepted the work on a GC project, who, and whether the office recorded it or they pressed it in their portal. Our final pay application waits for it.';

-- Who sees them (decision 2): dev only while it is built. One policy a table, for every verb, the
-- check made once a statement. The door PR swaps each for the owner and the controller.
ALTER TABLE public.gc_owner_contract_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gc_change_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gc_owner_pay_apps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gc_owner_pay_app_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gc_owner_pay_reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gc_owner_interest_bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gc_owner_acceptances ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS gc_owner_contract_lines_dev ON public.gc_owner_contract_lines;
CREATE POLICY gc_owner_contract_lines_dev ON public.gc_owner_contract_lines FOR ALL TO authenticated
  USING ((SELECT public.is_dev())) WITH CHECK ((SELECT public.is_dev()));
DROP POLICY IF EXISTS gc_change_orders_dev ON public.gc_change_orders;
CREATE POLICY gc_change_orders_dev ON public.gc_change_orders FOR ALL TO authenticated
  USING ((SELECT public.is_dev())) WITH CHECK ((SELECT public.is_dev()));
DROP POLICY IF EXISTS gc_owner_pay_apps_dev ON public.gc_owner_pay_apps;
CREATE POLICY gc_owner_pay_apps_dev ON public.gc_owner_pay_apps FOR ALL TO authenticated
  USING ((SELECT public.is_dev())) WITH CHECK ((SELECT public.is_dev()));
DROP POLICY IF EXISTS gc_owner_pay_app_lines_dev ON public.gc_owner_pay_app_lines;
CREATE POLICY gc_owner_pay_app_lines_dev ON public.gc_owner_pay_app_lines FOR ALL TO authenticated
  USING ((SELECT public.is_dev())) WITH CHECK ((SELECT public.is_dev()));
DROP POLICY IF EXISTS gc_owner_pay_reminders_dev ON public.gc_owner_pay_reminders;
CREATE POLICY gc_owner_pay_reminders_dev ON public.gc_owner_pay_reminders FOR ALL TO authenticated
  USING ((SELECT public.is_dev())) WITH CHECK ((SELECT public.is_dev()));
DROP POLICY IF EXISTS gc_owner_interest_bills_dev ON public.gc_owner_interest_bills;
CREATE POLICY gc_owner_interest_bills_dev ON public.gc_owner_interest_bills FOR ALL TO authenticated
  USING ((SELECT public.is_dev())) WITH CHECK ((SELECT public.is_dev()));
DROP POLICY IF EXISTS gc_owner_acceptances_dev ON public.gc_owner_acceptances;
CREATE POLICY gc_owner_acceptances_dev ON public.gc_owner_acceptances FOR ALL TO authenticated
  USING ((SELECT public.is_dev())) WITH CHECK ((SELECT public.is_dev()));

-- Nobody signed out reaches them.
REVOKE ALL ON TABLE public.gc_owner_contract_lines, public.gc_change_orders, public.gc_owner_pay_apps,
  public.gc_owner_pay_app_lines, public.gc_owner_pay_reminders, public.gc_owner_interest_bills,
  public.gc_owner_acceptances FROM anon;

-- What went to the customer never changes (a sent bill keeps what it went with): no update, delete
-- or truncate on pay applications, their lines, reminders and interest bills. Two doors stay: the
-- architect's certificate on a pay application, and the email a reminder went in. A row still goes
-- with its project by cascade, which runs as the table's owner.
REVOKE UPDATE, DELETE, TRUNCATE ON TABLE public.gc_owner_pay_apps, public.gc_owner_pay_app_lines,
  public.gc_owner_pay_reminders, public.gc_owner_interest_bills FROM authenticated;
GRANT UPDATE (certified, certified_on, certified_note, certified_by) ON TABLE public.gc_owner_pay_apps TO authenticated;
GRANT UPDATE (email_send_log_id) ON TABLE public.gc_owner_pay_reminders TO authenticated;

-- Our contract with the customer is signed (or marked not signed): the day and the price by line,
-- in one transaction. p_worth is the prototype's ownerContractWorth shape, what the client's
-- ownerContractWorthNow returns: each trade's package id, then "gc", "contingency" and "fee", each to
-- a dollar amount. Once signed, the price by line is kept: signing again moves only the day, and
-- to price it again it is marked not signed first, which a sent pay application refuses. SECURITY
-- INVOKER, so RLS decides who may: today dev only.
CREATE OR REPLACE FUNCTION public.gc_sign_owner_contract(p_project_id uuid, p_signed_on date, p_worth jsonb DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_key text;
  v_value jsonb;
  v_worth numeric;
  v_trades integer;
  v_named integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in to mark the contract signed.';
  END IF;
  PERFORM 1 FROM public.gc_projects WHERE project_id = p_project_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'That GC project is not there.';
  END IF;

  -- Marked not signed: the day and the price go together.
  IF p_signed_on IS NULL THEN
    IF EXISTS (SELECT 1 FROM public.gc_owner_pay_apps WHERE project_id = p_project_id) THEN
      RAISE EXCEPTION 'A pay application went out on this price, so the contract stays signed.';
    END IF;
    DELETE FROM public.gc_owner_contract_lines WHERE project_id = p_project_id;
    UPDATE public.gc_projects SET owner_contract_signed_on = NULL WHERE project_id = p_project_id;
    RETURN;
  END IF;

  -- Signed already: the price stays as it was signed, and only the day moves.
  IF EXISTS (SELECT 1 FROM public.gc_owner_contract_lines WHERE project_id = p_project_id) THEN
    UPDATE public.gc_projects SET owner_contract_signed_on = p_signed_on WHERE project_id = p_project_id;
    RETURN;
  END IF;

  IF p_worth IS NULL OR jsonb_typeof(p_worth) <> 'object' THEN
    RAISE EXCEPTION 'Send the price by line: each trade, then general conditions, contingency and fee.';
  END IF;
  FOR v_key, v_value IN SELECT key, value FROM jsonb_each(p_worth) LOOP
    IF jsonb_typeof(v_value) <> 'number' THEN
      RAISE EXCEPTION 'Each line of the price needs a dollar amount.';
    END IF;
    v_worth := (v_value #>> '{}')::numeric;
    IF v_worth < 0 THEN
      RAISE EXCEPTION 'A line of the price cannot be below zero.';
    END IF;
    IF v_key IN ('gc', 'contingency', 'fee') THEN
      INSERT INTO public.gc_owner_contract_lines (project_id, line, worth) VALUES (p_project_id, v_key, v_worth);
    ELSIF v_key ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
      AND EXISTS (SELECT 1 FROM public.gc_trade_packages WHERE id = v_key::uuid AND project_id = p_project_id) THEN
      INSERT INTO public.gc_owner_contract_lines (project_id, line, package_id, worth) VALUES (p_project_id, 'trade', v_key::uuid, v_worth);
    ELSE
      RAISE EXCEPTION 'Each line of the price must be one of this project''s trades, general conditions, contingency or fee.';
    END IF;
  END LOOP;

  SELECT count(*) INTO v_trades FROM public.gc_trade_packages WHERE project_id = p_project_id;
  SELECT count(*) INTO v_named FROM public.gc_owner_contract_lines WHERE project_id = p_project_id AND line = 'trade';
  IF v_named <> v_trades THEN
    RAISE EXCEPTION 'The price must name every trade on the project.';
  END IF;
  IF (SELECT count(*) FROM public.gc_owner_contract_lines WHERE project_id = p_project_id AND line <> 'trade') <> 3 THEN
    RAISE EXCEPTION 'The price must have general conditions, contingency and fee.';
  END IF;

  UPDATE public.gc_projects SET owner_contract_signed_on = p_signed_on WHERE project_id = p_project_id;
END;
$$;

COMMENT ON FUNCTION public.gc_sign_owner_contract(uuid, date, jsonb) IS
  'GC mode (v2.4831): our contract with the customer is signed on a day, with the price by line (ownerContractWorth: each trade''s package id, then gc, contingency and fee); a null day marks it not signed, which a sent pay application refuses. Signed already: only the day moves. The Board''s Get started calls it. SECURITY INVOKER.';

REVOKE ALL ON FUNCTION public.gc_sign_owner_contract(uuid, date, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.gc_sign_owner_contract(uuid, date, jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.gc_sign_owner_contract(uuid, date, jsonb) TO authenticated;

-- House rules: read-only training mode and the twin write fence cover every new table.
SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
SELECT public.apply_digital_twin_write_blocks();
