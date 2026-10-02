# 20261002030000_pay_speed_by_payer.sql (2026-10-01, v2.4362)

Pay speed counts each payment for whoever the bill went to. Every reader sampled per `jobs_ledger.customer_id`, so a bill the GC pays taught the homeowner's pace, and a job with no customer (every GC job since the v2.3404 sweep, `20260914160000_job_customer_gc_distinct.sql`) taught nobody, not even the company median. Three copies of the sampling SQL had drifted too: the payment-forecast email still ran August 21's rules.

- **`invoice_bill_payer_customer_id(invoice bill_to_party, invoice bill_to_email, job bill_to_party, customer_id, gc_customer_id)`**: who pays one bill. A typed `bill_to_email` is someone else (NULL); else the invoice's own `gc`/`customer` pick, else the job's rule, through `job_bill_payer_customer_id`. Mirrors `effectiveInvoiceParty` + `payerCustomerId` (`src/lib/jobs/billToParty.ts`). IMMUTABLE.
- **`pay_speed_samples()`**: the one sampler, each measurable 12-month pair with its `payer_id`. Rules are `get_billed_customer_pay_speeds` v11's, with two changes: a job with a GC and no customer counts, and a same-day payment with a blank `payment_type` counts (the v11 HCP quarantine test went NULL on it, so 15 same-day Stripe payments were dropped while the Data health list called them measurable). EXECUTE revoked from PUBLIC, anon and authenticated; the gated readers call it.
- **`get_billed_customer_pay_speeds` v12**: `customers`, `receipts` and `segments` keyed on the payer; same JSON shape.
- **`get_pay_speed_transactions` v6**: `customerName` is the payer's name; a GC job's payment is `measurable`, not `unlinked`.
- **`get_money_waiting_email_payload`**, **`get_payment_forecast_email_payload`**: medians from the sampler; rows gain `payer_id` and `payer_name`. The forecast email moves onto the app's current rules.

Grants restated as before. No table, no trigger, no policy change.

**Dry run** on prod in a rolled-back transaction (2026-10-01): 227 samples (was 176), company median 6 d (was 5); RMC- Dudley Mason 4 payments, 35 d (was 0); Knight Contracting 17, 24 d (was 1); Done Right Foundation 44, 10 d (was 4). The Data health list's measurable count (227) now equals the sampler's. As a dev, the app RPC returns the same numbers; as `authenticated`, calling `pay_speed_samples()` directly is refused.

**Apply order:** either. The old client looks up `customers[job.customer_id]`, which finds a GC-billed homeowner empty and falls back to the company median, as it already does for every GC job. The two client PRs that follow (Expected dates, then the lists that group by customer) read the payer.
