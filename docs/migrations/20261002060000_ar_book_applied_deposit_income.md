# 20261002060000_ar_book_applied_deposit_income.sql (2026-10-02, v2.4369)

Book it as Income: a deposit that paid a bill, but that a Banking rule labelled as an expense, is booked as Income from Accounts Receivable in one press.

- **`mercury_transaction_ar_income_labels`** — `ADD COLUMN IF NOT EXISTS previous_label_id` (FK labels, `ON DELETE SET NULL`) and `relabelled_by` (FK users); the source CHECK now allows `relabel` beside `trigger` / `backfill`.
- **`ar_book_applied_deposit_income(p_mercury_transaction_id)`** (SECURITY DEFINER, AR roles — office staff + primary) — refuses a deposit with nothing applied to a bill; `kept` when the label is Income already; otherwise writes Income over the label and upserts the sidecar row (`source = 'relabel'`, the first payment's job / bill / payment, `previous_label_id` = the replaced label). Returns `booked` and `previous_label_name`.
- **`ar_unlabel_deposit_income`** — same gates; when the last payment leaves a deposit whose sidecar row has `previous_label_id`, that label goes back instead of the deposit going unlabelled.

Rehearsed on prod in `BEGIN … ROLLBACK` (see `docs/recent-features/v2.4369.md`).

Apply order: merge → `supabase db push`. Before the push the button's call fails with *not live in the database yet* and nothing changes.
