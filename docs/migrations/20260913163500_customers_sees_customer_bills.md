# 20260913163500_customers_sees_customer_bills.sql (2026-09-13, v2.3377)

Share this bill, PR 3 — `customers.sees_customer_bills boolean NOT NULL DEFAULT false`: when this customer is the GC on a **new** job (and not its customer row), the job starts with `show_bills_to_other_party = true`, so Bill Customer's *Show it on their statement* tick starts ticked. The same shape as `gc_pays_by_default` (v2.3353): a fact about the customer that sets a starting value; existing jobs are not touched, and each bill's stamp still decides what the portal shows.

Additive and idempotent; no CREATE TABLE, so no read-only-block calls; customers' existing RLS governs writes.

Apply order: `supabase db push` **as the PR merges** — the job form's two customers selects and Edit customer's save name the column, so a client deployed ahead of the push would 400 on Edit customer / New Job. The migration is harmless ahead of the client. No edge function.

Companion data script (owner runs it; dry run until `ROLLBACK` is swapped for `COMMIT`): [`scripts/sweeps/share-this-bill-done-right-repairs-2026-09-13.sql`](../../scripts/sweeps/share-this-bill-done-right-repairs-2026-09-13.sql) — flags Done Right Foundation, switches the memory on for its open owner-paid jobs, and stamps their billed, unpaid invoices `gc` so Done Right's portal lists them without a re-send.

`src/types/database.ts` carries the column by hand; the next `gen-types` run reorders it.
