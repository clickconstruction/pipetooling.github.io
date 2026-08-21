# 20260821230000_bid_gc_recipients.sql (2026-08-21, v2.1994)

Bid GC recipients: `bid_gc_recipients` table — every GC a bid was sent to
beyond the bid-level `customer_id` (the primary GC is implied, never
duplicated). Columns: bid_id / customer_id (both cascade), `source`
CHECK `manual|version`, added_by (SET NULL), added_at, UNIQUE(bid_id,
customer_id) + per-column indexes. RLS mirrors the bid-scoped overlay
tables (`bid_payment_schedule_rows` pattern): reads for the seven bids
roles gated on `can_access_bid_for_pricing(bid_id)`; writes for
dev/master/assistant-like/estimator only. Backfills `source='version'`
rows from existing `bid_versions.customer_id` overrides that differ from
the bid's own GC. Ends with both read-only block calls. Client degrades
gracefully if it deploys first (Edit Bid hides the "Also sent to" row);
apply order free.
