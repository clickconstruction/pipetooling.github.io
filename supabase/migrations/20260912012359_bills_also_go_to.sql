SET lock_timeout = '3s';

-- Bills also go to (v2.3358): a second email for the bill, remembered.
--
-- Taunya's ask (2026-09-11): "option to add a 2nd email to send bill to".
-- Who pays (v2.3345) settled WHO is billed; this settles who else gets a
-- copy, without the office re-picking them every time:
--
--   customer_contact_persons.gets_bill_copies
--     true — this contact is copied on every bill sent to the customer they
--     belong to (an AP clerk, a spouse, a PM). Set on Edit Job → Bills also
--     go to, or Edit customer → Contacts. Bill Customer pre-ticks them.
--   jobs_ledger.bill_copy_other_party
--     true — the party NOT billed on this job (the GC on a customer-pays job,
--     the customer on a GC-pays job) gets a copy of every bill. Meaningless
--     (and hidden) when the job has no GC or the GC is the customer row.
--   jobs_ledger_invoices.copy_emails
--     the addresses this bill was (or will be) copied to, fixed at the moment
--     the office presses Create Stripe invoice / Send email — the Send to
--     list as ticked, so a later Send Email invoice from Stripe copies the
--     same people. PR 2 (copies on the Stripe path) is the consumer; the
--     physical-invoice email records its `additional_emails` here too.
--
-- Additive and idempotent; no CREATE TABLE, so no read-only-block calls. The
-- three tables' existing RLS governs writes.

ALTER TABLE public.customer_contact_persons
  ADD COLUMN IF NOT EXISTS gets_bill_copies boolean NOT NULL DEFAULT false;

ALTER TABLE public.jobs_ledger
  ADD COLUMN IF NOT EXISTS bill_copy_other_party boolean NOT NULL DEFAULT false;

ALTER TABLE public.jobs_ledger_invoices
  ADD COLUMN IF NOT EXISTS copy_emails text[];

COMMENT ON COLUMN public.customer_contact_persons.gets_bill_copies IS
  'Bills also go to (v2.3358): copied on every bill sent to this customer. Bill Customer pre-ticks the contact; the office can untick per bill.';
COMMENT ON COLUMN public.jobs_ledger.bill_copy_other_party IS
  'Bills also go to (v2.3358): the party not billed on this job (GC or customer, per bill_to_party) gets a copy of every bill. Read by Bill Customer.';
COMMENT ON COLUMN public.jobs_ledger_invoices.copy_emails IS
  'Bills also go to (v2.3358): the copy recipients fixed when this bill went out — read by send-stripe-invoice so a later Send Email invoice copies the same people.';
