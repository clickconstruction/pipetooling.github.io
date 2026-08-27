# 20260827211517_bid_date_sent_syncs_from_sends.sql (2026-08-27, v2.2407)

`bids.bid_date_sent` becomes a DERIVED roll-up of the per-GC send records instead of a second
hand-writable source of truth (Option A of the per-GC sent design).

- New row trigger `bid_version_sends_sync_bid_date` (fn `sync_bid_date_sent_from_sends`,
  INVOKER rights — writers of `bid_version_sends` already update `bids` from the same flows)
  on INSERT/UPDATE/DELETE: sets `bids.bid_date_sent = min(sent_on)` over the bid's send rows,
  NULL when the last row is removed (un-send → the bid returns to Unsent/Working).
- Backfill: bids that already have send rows converge to first-send (multi-send bids previously
  carried the LAST mark-sent date). Bids with NO send rows (version-less, or hand-dated
  historicals) are untouched — the trigger only fires on send-row activity.
- Function-only + one backfill UPDATE; no tables, columns, or RLS changes.

Client counterpart (same PR): Edit Bid's `BidGcSentPanel` + Cover Letter `markSentToday`
write the identical derived value, so behavior is unchanged in the client-deployed →
migration-pushed window.
