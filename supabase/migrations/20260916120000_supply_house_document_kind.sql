-- Supply house credits, step 3: the gate (v2.3502)
--
-- A return from a supply house is a numbered document the house issues — a credit memo — and until
-- now it had nowhere to live: `supply_house_invoices` carried CHECK (amount >= 0), so the office
-- netted returns into an invoice, zeroed them out, or left them positive on a job that kept nothing.
--
-- A credit is recorded as its own row with a NEGATIVE amount, which is what lets every reader that
-- sums `amount * pct / 100` credit the right job with no change at all — `get_invoice_amounts_for_jobs`
-- and `get_invoice_allocation_lines_for_jobs` are already raw signed sums. `document_kind` is what
-- keeps a credit from being indistinguishable from a mistyped invoice: the form derives the sign
-- from the choice, never from typing.
--
-- Safe to push ahead of the client (v2.3503): the column defaults to 'invoice', the old client never
-- sends it, and an invoice keeps exactly the rule it has today. Verified read-only against prod on
-- 2026-09-15 — all 466 existing rows satisfy the new constraint under the default, and the lowest
-- amount on file is $0.00. Adding a NOT NULL column with a constant default does not rewrite the
-- table on PG 11+, so the lock timeout below should never be reached.
--
-- The readers were hardened first, in v2.3500 and v2.3501, while negatives were still impossible.

SET lock_timeout = '3s';

ALTER TABLE public.supply_house_invoices
  ADD COLUMN IF NOT EXISTS document_kind text NOT NULL DEFAULT 'invoice';

COMMENT ON COLUMN public.supply_house_invoices.document_kind IS
  'invoice (default) or credit. A credit is a credit memo the house issued — a return or a price correction — and its amount is stored negative so every reader that sums amount x pct stays correct without learning the kind. An "owed" figure counts invoices only; a "cost" figure nets.';

-- Drop-then-add keeps this idempotent (Postgres has no ADD CONSTRAINT IF NOT EXISTS).
ALTER TABLE public.supply_house_invoices
  DROP CONSTRAINT IF EXISTS supply_house_invoices_document_kind_check;
ALTER TABLE public.supply_house_invoices
  ADD CONSTRAINT supply_house_invoices_document_kind_check
  CHECK (document_kind IN ('invoice', 'credit'));

-- The gate itself. An invoice keeps today's rule untouched; only a credit may be negative, and a
-- credit must be negative — a zero credit is not a document, it is a typo.
ALTER TABLE public.supply_house_invoices
  DROP CONSTRAINT IF EXISTS supply_house_invoices_amount_check;
ALTER TABLE public.supply_house_invoices
  ADD CONSTRAINT supply_house_invoices_amount_check
  CHECK (
    (document_kind = 'invoice' AND amount >= 0) OR
    (document_kind = 'credit'  AND amount <  0)
  );
