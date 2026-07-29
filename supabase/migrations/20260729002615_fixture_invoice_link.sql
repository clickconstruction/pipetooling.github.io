-- Job stages, step 2 of the series (v2.1068): fixtures can link to the invoice
-- that bills them — jobs_ledger_fixtures.invoice_id.
--
-- WHY ON THE FIXTURE SIDE. The Edit-Job save engine deletes + reinserts every
-- fixture row on save (client row ids never match DB ids across saves), so a
-- link table keyed on fixture ids would orphan on the next save. Putting the
-- FK on the fixture row means the client carries invoice_id in its in-memory
-- rows and simply re-writes the link with every reinsert — the link travels
-- WITH the row instead of pointing AT it.
--
-- ON DELETE SET NULL: every existing invoice-teardown flow (delete RTB draft,
-- send-back that deletes the row, void) automatically releases its segments
-- back to "unbilled" with zero changes to those RPCs.
--
-- Domain rule (enforced client-side, by construction of the flows): a fixture
-- links to at most one invoice, whole — no partial-segment billing. Jobs with
-- no links behave exactly as today; the break-off slider stays available for
-- arbitrary-dollar billing.
--
-- No CREATE TABLE here, so the read-only sweeps are not required; the existing
-- restrictive policies + read_only_block_stmt trigger on jobs_ledger_fixtures
-- already cover the new column.

ALTER TABLE public.jobs_ledger_fixtures
  ADD COLUMN IF NOT EXISTS invoice_id uuid
    REFERENCES public.jobs_ledger_invoices(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_jobs_ledger_fixtures_invoice_id
  ON public.jobs_ledger_fixtures (invoice_id)
  WHERE invoice_id IS NOT NULL;

COMMENT ON COLUMN public.jobs_ledger_fixtures.invoice_id IS
  'The jobs_ledger_invoices row that bills this line item (job-stages billing, v2.1068+). NULL = not yet billed as a segment (covered by the primary RTB remainder bundle). ON DELETE SET NULL so invoice deletion/send-back/void releases the segment. A fixture links to at most one invoice, whole (client-enforced).';
