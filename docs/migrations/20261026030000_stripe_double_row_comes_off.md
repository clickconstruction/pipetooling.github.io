# 20261026030000_stripe_double_row_comes_off.sql (2026-10-26, v2.5869)

`remove_jobs_ledger_payment_and_reconcile(p_payment_id)` re-created from the body of `20261019120000_primary_paid_verbs.sql` with one change: on a bill Stripe marks paid, the refusal now covers only the rows Stripe holds, the earliest rows on the bill (by `created_at`, then `id`) that pay it in full. A row past them is a double of a Stripe payment; it is removed like any ledger row, the bill stays paid, and the `jobs_ledger_payment_events` line carries reason `double_on_stripe_bill`. The credit-note refusal, the permission checks, the bank handling and the reconcile are unchanged. No table created, no policy change; `CREATE OR REPLACE` keeps the grants.

Apply order: either first is harmless. Before the push, the client shows Remove on a double and the function refuses it with the old words; after it, both agree. Applied with `supabase db push` after the PR merged. SQL bed: `npm run test:pg:stripe-double-row`.
