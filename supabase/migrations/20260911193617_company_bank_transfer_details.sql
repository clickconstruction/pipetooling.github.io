SET lock_timeout = '3s';

-- Bank transfer details on the statement (v2.3308). Customers who pay by ACH,
-- wire, or mailed check need the company's remittance details; the repo is
-- public, so the numbers live here — one row, entered from Settings → Company,
-- never in a source file. The customer portal (service role) reads the row
-- when show_on_portal is on; office roles read it for the Accounts Receivable
-- modal; dev and master write it.
--
-- Every column is text the office typed; nothing here is derived. The client
-- kernel (src/lib/bankTransferDetails.ts) decides what is complete enough to
-- show.

CREATE TABLE IF NOT EXISTS public.company_bank_transfer_details (
  id text PRIMARY KEY DEFAULT 'default' CHECK (id = 'default'),
  payee_name text NOT NULL DEFAULT '',
  bank_name text NOT NULL DEFAULT '',
  bank_note text NOT NULL DEFAULT '',
  routing_number text NOT NULL DEFAULT '',
  account_number text NOT NULL DEFAULT '',
  account_kind text NOT NULL DEFAULT 'Checking',
  beneficiary_address text NOT NULL DEFAULT '',
  check_mailing_address text NOT NULL DEFAULT '',
  show_on_portal boolean NOT NULL DEFAULT true,
  updated_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.company_bank_transfer_details IS
  'v2.3308: the company''s ACH / wire remittance details and the check mailing address — one row (id = default), entered at Settings → Company. Read by the customer portal (service role, when show_on_portal) and the office (Accounts Receivable modal); written by dev and master. Kept out of the public repo on purpose.';
COMMENT ON COLUMN public.company_bank_transfer_details.bank_note IS
  'One line under the bank name, e.g. why the customer''s bank shows a partner bank''s name.';
COMMENT ON COLUMN public.company_bank_transfer_details.check_mailing_address IS
  'Where paper checks must be mailed; the portal says checks sent elsewhere may need to be re-issued.';

ALTER TABLE public.company_bank_transfer_details ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "office_read_company_bank_transfer_details" ON public.company_bank_transfer_details;
CREATE POLICY "office_read_company_bank_transfer_details"
  ON public.company_bank_transfer_details FOR SELECT
  TO authenticated
  USING (public.is_office_staff());

DROP POLICY IF EXISTS "master_or_dev_insert_company_bank_transfer_details" ON public.company_bank_transfer_details;
CREATE POLICY "master_or_dev_insert_company_bank_transfer_details"
  ON public.company_bank_transfer_details FOR INSERT
  TO authenticated
  WITH CHECK (public.is_master_or_dev());

DROP POLICY IF EXISTS "master_or_dev_update_company_bank_transfer_details" ON public.company_bank_transfer_details;
CREATE POLICY "master_or_dev_update_company_bank_transfer_details"
  ON public.company_bank_transfer_details FOR UPDATE
  TO authenticated
  USING (public.is_master_or_dev())
  WITH CHECK (public.is_master_or_dev());

DROP POLICY IF EXISTS "master_or_dev_delete_company_bank_transfer_details" ON public.company_bank_transfer_details;
CREATE POLICY "master_or_dev_delete_company_bank_transfer_details"
  ON public.company_bank_transfer_details FOR DELETE
  TO authenticated
  USING (public.is_master_or_dev());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.company_bank_transfer_details TO authenticated;
GRANT ALL ON public.company_bank_transfer_details TO service_role;

SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
