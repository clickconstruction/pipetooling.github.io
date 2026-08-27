# 20260827191047_clone_all_prices_on_new_bid_version.sql (2026-08-27, v2.2395)

`CREATE OR REPLACE public.create_bid_version` (body from 20260823034820 with the pricing block
rewritten; signature unchanged). Fixes Wendi's "new version keeps prices / the alternate has no
prices" — the old body cloned exactly one scenario (`p_pricing_source_version_id`), and the
client skipped cloning entirely when the source version had no ★.

- When `p_clone_pricing`, the new version now clones **every** `price_book_versions` row the
  source version owns (name, `include_in_submission`, `sort_order` preserved; entries + custom
  prices + hides + assignments via the existing `clone_price_book_version_to_bid`).
- ★ maps by priority: clone of the source version's ★ → clone of `p_pricing_source_version_id`
  (the hint old/new clients pass) → first clone.
- Legacy fallback unchanged: a source version owning no scenarios (unsplit bid on a shared
  template pricing) clones the passed scenario as before.
- `split_bid_into_versions` inherits the behavior (it calls `create_bid_version` after
  `materialize_bid_version` stamps the unsplit scenarios onto the base version).

No tables/RLS touched — function-only. Old clients keep working; `BidVersionPicker` (same PR)
now always passes `p_clone_pricing` from the checkbox and treats the source id as the ★ hint.
