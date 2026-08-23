# 20260823145006 — bid_versions.outcome / outcome_at / outcome_note (v2.2162)

**What:** three nullable columns on `public.bid_versions` — `outcome text` ('won' | 'lost' | null), `outcome_at date`, `outcome_note text`. Additive, idempotent (`ADD COLUMN IF NOT EXISTS`), `lock_timeout 3s`. No RLS change.

**Why:** per-GC outcome ("won with SPC, lost with BURD"); `bids.outcome` remains the roll-up written by `setGcPacketOutcome`.

**Apply:** `supabase db push` after the PR's CI is green; live test; then auto-merge. `npm run gen-types:linked` afterwards (types hand-added).
