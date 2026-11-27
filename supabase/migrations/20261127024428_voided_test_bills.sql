SET lock_timeout = '3s';

-- Presses nothing takes back (punch list #443, row 7): a voided test bill leaves a record.
--
-- What was wrong. **Void invoice** on Bill Customer calls the edge function void-stripe-invoice-for-revert, which
-- voids the invoice in Stripe and then deletes the bill's jobs_ledger_invoices row. The rows of its Stripe emails
-- (jobs_ledger_invoice_stripe_email_sends) go with it by their foreign key. Stripe keeps the invoice as void, and
-- nothing in the app is left to read as one thing: Deleted records keeps a copy of each row apart, for ninety days,
-- with nobody's name on it, since the function deletes as the service role.
--
-- The owner's answer, relayed 2026-11-27: "A, test bills only". Of three ways put to the owner, way A: the function
-- writes a record of the void to a small table of its own before it deletes, for a bill of a ZZ test job alone, read
-- by a developer alone. No state is added to the bill's row, and no reader of bills changes.
--
-- Why a table of its own and not a state on the bill. About 250 files and many SQL functions read
-- jobs_ledger_invoices, and each would have to leave a voided row out of its totals. A row that is gone is in no
-- total already. A record beside it costs one table that only one function writes and only one screen reads.
--
--   voided_test_bills   one row a voided test bill: the bill's whole row as it stood, its sends as a list, what the
--                       function did on Stripe's side, who voided it and when.
--
-- Who. A developer reads it (is_dev()). Nobody signed in writes it: the table grants a signed-in account SELECT and
-- nothing else, and it has no INSERT, UPDATE or DELETE policy. The function writes it as the service role. A record
-- goes with its test job (ON DELETE CASCADE), so deleting a ZZ test job leaves nothing behind.
--
-- What the push leaves on prod: this one empty table, its two indexes, its one policy, its grants, and the policies
-- and the statement trigger the four closing calls put on it. No other table is changed and no row is written.
-- Additive and idempotent: IF NOT EXISTS, and the policy is dropped before it is made.

CREATE TABLE IF NOT EXISTS public.voided_test_bills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- The deleted bill's id. No foreign key: the row it names is gone.
  invoice_id uuid NOT NULL,
  -- The test job the bill stood on. The record goes with its job.
  job_id uuid REFERENCES public.jobs_ledger(id) ON DELETE CASCADE,
  -- The bill's whole jobs_ledger_invoices row as it stood before the delete.
  bill jsonb NOT NULL
    CONSTRAINT voided_test_bills_bill_object CHECK (jsonb_typeof(bill) = 'object'),
  -- Its sends, one object each, oldest first: a Stripe bill email, or a sent copy that named the bill.
  sends jsonb NOT NULL DEFAULT '[]'::jsonb
    CONSTRAINT voided_test_bills_sends_array CHECK (jsonb_typeof(sends) = 'array'),
  stripe_invoice_id text,
  -- What the function did on Stripe's side, in its own word (void, delete_draft, noop, …).
  stripe_action text,
  -- Who pressed the void. The name is kept as text so the record reads after the account is gone.
  voided_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  voided_by_name text,
  voided_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.voided_test_bills IS
  'Punch list #443, row 7: one row a voided bill of a ZZ test job, written by the void-stripe-invoice-for-revert edge function right before it deletes the bill. It keeps the bill''s row, its sends, what was done in Stripe, who voided it and when. A developer reads it, under a folded line on Bill Customer. Nobody signed in writes it. A bill of a real job leaves no row here.';
COMMENT ON COLUMN public.voided_test_bills.invoice_id IS 'The id of the deleted jobs_ledger_invoices row. No foreign key, since that row is gone. Unique, so a void that is tried twice keeps one record.';
COMMENT ON COLUMN public.voided_test_bills.job_id IS 'The ZZ test job the bill stood on. The record is deleted with its job.';
COMMENT ON COLUMN public.voided_test_bills.bill IS 'The bill''s whole jobs_ledger_invoices row as it stood before the delete, as one JSON object.';
COMMENT ON COLUMN public.voided_test_bills.sends IS 'The bill''s sends as a JSON list, oldest first. Each is one object with a source: stripe_email for a jobs_ledger_invoice_stripe_email_sends row, which goes with the bill, or sent_copy for a sent_documents row that names the bill, which stays.';
COMMENT ON COLUMN public.voided_test_bills.stripe_invoice_id IS 'The Stripe invoice the bill carried, or null when it carried none.';
COMMENT ON COLUMN public.voided_test_bills.stripe_action IS 'What the function did on Stripe''s side, the stripe_action word of its own answer: void, delete_draft, noop, noop_missing, reverse_oob_mark, db_only_no_stripe_id or db_only_non_stripe_collect_send_back.';
COMMENT ON COLUMN public.voided_test_bills.voided_by IS 'The signed-in account that pressed the void. Null once that account is deleted.';
COMMENT ON COLUMN public.voided_test_bills.voided_by_name IS 'That account''s name when it voided the bill, or its email when it had no name.';
COMMENT ON COLUMN public.voided_test_bills.voided_at IS 'When the record was written, which is right before the bill''s row was deleted.';

CREATE INDEX IF NOT EXISTS voided_test_bills_job_idx ON public.voided_test_bills (job_id, voided_at);
-- One record a bill: a void that is tried twice keeps the first.
CREATE UNIQUE INDEX IF NOT EXISTS voided_test_bills_invoice_key ON public.voided_test_bills (invoice_id);

ALTER TABLE public.voided_test_bills ENABLE ROW LEVEL SECURITY;

-- A developer reads every record. There is no INSERT, UPDATE or DELETE policy, so no signed-in account writes one.
DROP POLICY IF EXISTS voided_test_bills_select_dev ON public.voided_test_bills;
CREATE POLICY voided_test_bills_select_dev ON public.voided_test_bills
  FOR SELECT TO authenticated
  USING ((SELECT public.is_dev()));

REVOKE ALL ON TABLE public.voided_test_bills FROM anon, authenticated;
GRANT SELECT ON TABLE public.voided_test_bills TO authenticated;
GRANT ALL ON TABLE public.voided_test_bills TO service_role;

-- House rules for every CREATE TABLE: training-mode blocks, the digital-twin fence and the archived seal.
SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
SELECT public.apply_digital_twin_write_blocks();
SELECT public.apply_archived_read_blocks();
