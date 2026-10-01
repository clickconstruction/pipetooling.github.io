# 20261001234500_ar_return_case_actions.sql (2026-10-01, v2.4325)

The three writes the case of a returned check needs in Accounts Receivable (punch list #76 PR 3). The case itself is `20261001230000`.

- **`take_returned_check_off_jobs(p_mercury_transaction_id)`** — every payment the deposit still carries comes off its job through `remove_jobs_ledger_payment_and_reconcile` (the reconcile, the `removed` history event with the bank's reason, the bill and the job back to Billed), biggest first, under a row lock on the deposit. All or nothing: a refusal from any payment (a Stripe credit note, a bill Stripe holds as paid) raises `#978 Springtown- HVAC: This bill is marked paid in Stripe — …` and nothing comes off. Only for a deposit that came back (a returned row, or the bank-return rule). Returns `{ok, removed, jobs: [{job_id, label, amount, warning}]}`.
- **`close_ar_return_case(p_mercury_transaction_id, p_reason, p_note default null, p_replaced_by default null)`** — `replaced` (names the new deposit, never itself), `settled_other_way`, `not_coming`; a note up to 500 characters; only an open case.
- **`reopen_ar_return_case(p_mercury_transaction_id)`** — clears the close.

All three: dev, master_technician, assistant, controller, primary; revoked from `public` and `anon`, granted to `authenticated`.

Rehearsed on prod in `BEGIN … ROLLBACK` with `20261001220000` and `20261001230000` first, as the dev: KCG's three-job deposit (flipped to failed in the transaction) was refused whole because #978's first bill is marked paid in Stripe; a single-job deposit came off (#765 back to Billed, one `removed` event); close as settled and reopen worked; a deposit that never came back and a replaced close with no deposit were refused.

Apply order: merge → `supabase db push`. Until it is pushed the case pane reads, but its buttons answer *could not find the function*.
