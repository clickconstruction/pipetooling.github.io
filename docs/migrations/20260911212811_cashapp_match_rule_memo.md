# 20260911212811_cashapp_match_rule_memo — `memo` as a Cash App match rule (v2.3333)

**What**: `cashapp_transactions_match_rule_check` now allows `'memo'` alongside `id / amount / split / manual`; column comment updated.

**Why**: the matcher's rule (e) files a send whose amount is named inside a recorded payment's memo (the owner's split notes). See `docs/recent-features/v2.3333.md`.

**Idempotent**: constraint drop/add. No data touched.
