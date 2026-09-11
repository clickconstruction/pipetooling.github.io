# 20260911030000_standing_discount.sql (2026-09-11, v2.3272)

A standing discount per customer (fragment `docs/recent-features/v2.3272.md`), three additive columns:

- **`customers.standing_discount_pct numeric(7,4)`** (CHECK 0 < pct ≤ 100) and **`customers.standing_discount_reason text`** — the rate and the reason preset the offered row is named after. NULL = none.
- **`jobs_ledger.standing_discount_waived_at timestamptz`** — set when the office waved the offer off for that job ("not on this job").

Nothing is inserted by the database or by the app on its own: the client reads the rate loosely (a select error before the push reads as "no standing discount") and OFFERS it on New Job, the Bill tab, and inside Bill Customer until someone applies it (an ordinary discount row) or waves it off.

Apply order: push before or with the client — additive; the old client never reads the columns. No edge function.
