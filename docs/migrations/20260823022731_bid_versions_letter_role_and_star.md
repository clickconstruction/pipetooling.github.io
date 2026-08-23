# 20260823022731 — bid_versions: letter role + per-version ★ (v2.2117)

**What:** two additive, idempotent columns on `public.bid_versions`:
- `is_alternate boolean NOT NULL DEFAULT false` — Cover Letter (New): `true` = offered *in lieu of* the base bids; `false` = base (adds to the letter total).
- `starred_price_book_version_id uuid NULL REFERENCES price_book_versions(id) ON DELETE SET NULL` (+ index `bid_versions_starred_pbv_idx`) — this version's customer-facing ★ price scenario. `bids.selected_price_book_version_id` stays as the *active* version's ★ (bid-level); the client now writes both.

**Backfill (fills NULLs only):** each version's ★ = the bid's saved ★ when that scenario belongs to the version, else the version's first scenario (`sort_order`, then `created_at`).

**Why:** the ★ lived only on the bid, so switching versions on the Pricing tab silently lost the other version's star; and the New Cover Letter bundles versions *at their ★*, which needs a per-version pointer. Base/Alternate is the letter role the owner approved (D2).

**Safety:** `SET lock_timeout = '3s'`; `ADD COLUMN IF NOT EXISTS`; no table created (no read-only block calls needed); old clients ignore both columns. No RLS change — existing `bid_versions` policies cover the new columns.

**Apply:** `supabase db push` after the PR is on main (client first is fine — the new client tolerates the columns being absent for reads; the Base/Alternate toggle writes `is_alternate` and needs the column). Then `npm run gen-types:linked` in a follow-up PR to drop the local `BidVersionLetter` casts.
