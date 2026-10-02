# 20261002090000_version_star_own_price_repair.sql (2026-10-01, v2.4385)

A data repair, no schema change. A version's ★ (`bid_versions.starred_price_book_version_id`, v2.2117) is one of that version's own prices. Two versions on prod starred another version's price:

| Bid | Version | Stray ★ (owned by) | Repaired ★ |
|---|---|---|---|
| BP385 Galloway Park | Written to Plan (active base) | `731c244e` *Value Engineered* (Value Engineered) | `bc56b7ce` *Written to Plan*, its only price |
| BP384 Game Show Battle Rooms (lost) | NORTHSTAR CONSTRUCTION SERVICES (active) | `3c6b6a7b` *WENDI* (PlanHub) | `1c233cba` *WENDI*, its first price (sort 3) |

**How they got there.** Deleting the price open on the Pricing Workbench re-picked the lowest `sort_order` price on the whole bid and saved it as the active version's ★ and as `bids.selected_price_book_version_id`. Each stray ★ is exactly that price on its bid. The write is guarded since v2.4377 (`starWriteAllowed`, `afterOpenPriceDeleted` in `lib/bids/versionStar.ts`).

**The rule.** Each stray ★ moves to the price the version's letter already reads, `starredPricingIdForVersion`: the version's first price by `sort_order`, then oldest (`created_at NULLS FIRST`, then `id`), or none when it owns no price. So nothing a GC sees changes. The bid-level ★ moves with it only where it named that same stray price and the stray version is the bid's active one. The save wrote both columns together, and both rows match. A stale bid-level ★ that names the active version's sibling's own ★ (BP18, BP338, BP363 after a version switch) is left alone. Since v2.4377 Share reads the resolved ★, not that column.

One statement. A `stray` CTE picks the versions whose ★ is not one of their own prices. A data-modifying CTE updates `bids`, then the main `UPDATE` sets `bid_versions`. Idempotent: a second run finds no stray ★.

**Triggers.** `bid_versions`: `read_only_block_stmt` and `twin_no_send_guard` pass for `postgres`. `bids`: `update_bids_updated_at` stamps `updated_at`. `bids_clear_working_board_archive_on_progress` clears an archive stamp on a sent bid, but neither bid has one. The send/outcome triggers fire only on a send or outcome change.

**Dry run** on prod in `BEGIN … ROLLBACK` (2026-10-01): `UPDATE 2` versions, the two rows above, each now `own`. Two `bids` rows changed: BP385's and BP384's bid-level ★, no archive, send or outcome change. 0 stray ★s left, and a second run gave `UPDATE 0`.

Apply with `supabase db push` after the PR merges. No client change is needed, and the types do not change.
