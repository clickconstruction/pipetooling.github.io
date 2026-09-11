SET lock_timeout = '3s';

-- Cash App reconciliation (v2.3321, PR 1 of the train). The owner pays staff through Cash App
-- and records the payment on the pay report by hand — or forgets to. The app now keeps every
-- row of the Cash App activity export (idempotent by Cash App's Transaction ID) and a small
-- alias table that ties a Cash App counterparty ("Abe Whites") to an app person ("Abraham"),
-- with an optional note rule for proxy accounts (Taunya's account + a note containing
-- "tristen" → Tristen). The client kernels in src/lib/cashapp/ decide the lane; this migration
-- only stores. Payroll-access roles read and write (same gate as pay_stub_payments).
--
-- Also: person_offsets gains the 'advance' type — money sent ahead of a pay report, offered
-- as a Less line when that person's next report is generated.

CREATE TABLE IF NOT EXISTS public.cashapp_transactions (
  id text PRIMARY KEY,
  occurred_at_text text NOT NULL,
  occurred_date date NOT NULL,
  tx_type text NOT NULL,
  status text NOT NULL,
  currency text NOT NULL DEFAULT 'USD',
  amount numeric(12,2) NOT NULL,
  fee numeric(12,2) NOT NULL DEFAULT 0,
  net_amount numeric(12,2) NOT NULL,
  counterparty text NOT NULL DEFAULT '',
  note text NOT NULL DEFAULT '',
  account text NOT NULL DEFAULT '',
  lane text NOT NULL DEFAULT 'review'
    CHECK (lane IN ('review', 'recorded', 'advance', 'expense', 'before_records', 'not_staff', 'ignored')),
  person_name text,
  match_rule text CHECK (match_rule IS NULL OR match_rule IN ('id', 'amount', 'split', 'manual')),
  pay_stub_payment_id uuid REFERENCES public.pay_stub_payments(id) ON DELETE SET NULL,
  person_offset_id uuid REFERENCES public.person_offsets(id) ON DELETE SET NULL,
  decided_at timestamptz,
  decided_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  imported_at timestamptz NOT NULL DEFAULT now(),
  imported_by uuid REFERENCES public.users(id) ON DELETE SET NULL
);

COMMENT ON TABLE public.cashapp_transactions IS
  'v2.3321: every row of the owner''s Cash App activity export, keyed by Cash App''s Transaction ID so re-uploads add only new rows. amount is signed as exported (negative = sent). lane is the reconcile decision; a recorded row points at the pay_stub_payment it became, an advance at its person_offset.';
COMMENT ON COLUMN public.cashapp_transactions.lane IS
  'review = waiting for a decision · recorded = matched or recorded as a pay-report payment · advance = filed as a person_offsets advance · expense = money to staff that is not pay (gas, reimbursement) · before_records = sent before the app had a pay report for that person · not_staff = counterparty is not a person we pay · ignored = skipped on purpose';
COMMENT ON COLUMN public.cashapp_transactions.match_rule IS
  'How the recorded link was made: id (Cash App ID found in the payment memo), amount (person + amount within the window), split (one send = 2–3 recorded payments), manual (chosen in the queue).';

CREATE INDEX IF NOT EXISTS cashapp_transactions_occurred_date_idx ON public.cashapp_transactions (occurred_date DESC);
CREATE INDEX IF NOT EXISTS cashapp_transactions_lane_idx ON public.cashapp_transactions (lane);
CREATE INDEX IF NOT EXISTS cashapp_transactions_person_name_idx ON public.cashapp_transactions (person_name);

CREATE TABLE IF NOT EXISTS public.cashapp_aliases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  counterparty_key text NOT NULL UNIQUE,
  counterparty text NOT NULL,
  person_name text,
  not_staff boolean NOT NULL DEFAULT false,
  note_contains text,
  note_person_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  CHECK (NOT (not_staff AND person_name IS NOT NULL)),
  CHECK ((note_contains IS NULL) = (note_person_name IS NULL))
);

COMMENT ON TABLE public.cashapp_aliases IS
  'v2.3321: Cash App counterparty → app person. counterparty_key is lower(trim(name)) with collapsed spaces (src/lib/cashapp/cashAppAliases.ts aliasKey). not_staff marks a counterparty we never pay as staff. note_contains / note_person_name redirect a proxy account''s payment when the note carries a word (Taunya + "tristen" → Tristen).';

ALTER TABLE public.person_offsets DROP CONSTRAINT IF EXISTS person_offsets_type_check;
ALTER TABLE public.person_offsets ADD CONSTRAINT person_offsets_type_check
  CHECK (type = ANY (ARRAY['backcharge'::text, 'damage'::text, 'employee_credit'::text, 'profit_share'::text, 'utility_overage'::text, 'advance'::text]));

COMMENT ON COLUMN public.person_offsets.type IS
  'backcharge / damage: they owe us. employee_credit / profit_share: we owe them. utility_overage: partner utility charge. advance (v2.3321): pay sent ahead of a report — pending until offered as a Less line on the person''s next pay report.';

ALTER TABLE public.cashapp_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cashapp_aliases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "payroll_select_cashapp_transactions" ON public.cashapp_transactions;
CREATE POLICY "payroll_select_cashapp_transactions" ON public.cashapp_transactions FOR SELECT TO authenticated USING (public.has_payroll_access());
DROP POLICY IF EXISTS "payroll_insert_cashapp_transactions" ON public.cashapp_transactions;
CREATE POLICY "payroll_insert_cashapp_transactions" ON public.cashapp_transactions FOR INSERT TO authenticated WITH CHECK (public.has_payroll_access());
DROP POLICY IF EXISTS "payroll_update_cashapp_transactions" ON public.cashapp_transactions;
CREATE POLICY "payroll_update_cashapp_transactions" ON public.cashapp_transactions FOR UPDATE TO authenticated USING (public.has_payroll_access()) WITH CHECK (public.has_payroll_access());
DROP POLICY IF EXISTS "payroll_delete_cashapp_transactions" ON public.cashapp_transactions;
CREATE POLICY "payroll_delete_cashapp_transactions" ON public.cashapp_transactions FOR DELETE TO authenticated USING (public.has_payroll_access());

DROP POLICY IF EXISTS "payroll_select_cashapp_aliases" ON public.cashapp_aliases;
CREATE POLICY "payroll_select_cashapp_aliases" ON public.cashapp_aliases FOR SELECT TO authenticated USING (public.has_payroll_access());
DROP POLICY IF EXISTS "payroll_insert_cashapp_aliases" ON public.cashapp_aliases;
CREATE POLICY "payroll_insert_cashapp_aliases" ON public.cashapp_aliases FOR INSERT TO authenticated WITH CHECK (public.has_payroll_access());
DROP POLICY IF EXISTS "payroll_update_cashapp_aliases" ON public.cashapp_aliases;
CREATE POLICY "payroll_update_cashapp_aliases" ON public.cashapp_aliases FOR UPDATE TO authenticated USING (public.has_payroll_access()) WITH CHECK (public.has_payroll_access());
DROP POLICY IF EXISTS "payroll_delete_cashapp_aliases" ON public.cashapp_aliases;
CREATE POLICY "payroll_delete_cashapp_aliases" ON public.cashapp_aliases FOR DELETE TO authenticated USING (public.has_payroll_access());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.cashapp_transactions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cashapp_aliases TO authenticated;
GRANT ALL ON public.cashapp_transactions TO service_role;
GRANT ALL ON public.cashapp_aliases TO service_role;

SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
