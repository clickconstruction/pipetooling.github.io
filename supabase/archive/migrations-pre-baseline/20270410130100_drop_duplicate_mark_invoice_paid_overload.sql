-- PostgREST may error: "Could not choose the best candidate function" when two overloads exist,
-- e.g. (uuid, numeric, date, text) vs (uuid, date, text, numeric). CREATE OR REPLACE does not drop
-- the other overload. Keep the canonical signature from 20270410120000_invoice_linked_payments_partial_mark_paid.sql.
DROP FUNCTION IF EXISTS public.mark_invoice_paid(uuid, date, text, numeric);
