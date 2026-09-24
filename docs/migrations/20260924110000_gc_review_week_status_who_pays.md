# 20260924110000_gc_review_week_status_who_pays.sql (2026-09-24, v2.3811)

**Purpose**: the Dashboard's GC-review nudge counts a Billed row under its GC only when the GC is the one who pays it — the same rule the GC Review modal groups by — so the card's "N of M certified" matches the modal's.

**Changes**
- `public.gc_review_week_status(date)` re-created (v4): the body of `20260905130000` with the `job_rows` CTE's two branches gaining the who-pays predicate — `public.job_bill_payer_customer_id(<invoice pick, else the job's bill_to_party>, customer_id, gc_customer_id) = gc_customer_id`, and an invoice addressed to a third-party `bill_to_email` never counts. `inv_open` carries `bill_to_party` and `bill_to_email` for it. Signature, keys, grants unchanged; the function comment names the rule.

**Idempotent**: `CREATE OR REPLACE`. No new table. **Order**: after `20260914160000` (the payer function's current body) — any later stamp is fine.
