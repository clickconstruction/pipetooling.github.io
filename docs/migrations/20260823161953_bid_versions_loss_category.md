# 20260823161953 — bid_versions.loss_category (v2.2171)

**What:** `ALTER TABLE bid_versions ADD COLUMN IF NOT EXISTS loss_category text` — the per-GC loss reason (same keys as `bids.loss_category`: gc_lost, price, other_sub, project_died, no_bid, no_answer). The free-text note lives in the existing `outcome_note`.

**Why:** Bids by GC — a bid won with one GC and lost with another needs the loss reason on the losing packet; `bids.loss_category` stays the single-GC path and is untouched for multi-GC bids.

**Safety:** `lock_timeout 3s`; additive, idempotent; no backfill (the kernel infers "GC lost the project" for an unanswered packet beside a sibling win; taps record a value). Old clients ignore the column.

**Apply:** `supabase db push` after CI on the PR is green (owner-authorized for this train); live test; then auto-merge. `npm run gen-types:linked` afterwards (types hand-added).
