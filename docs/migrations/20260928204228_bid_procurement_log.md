# 20260928204228_bid_procurement_log.sql (2026-09-28, v2.4083)

The procurement log behind Bids → Submittals → **Procure**. Two tables, additive; the old client ignores both.

- `bid_procurement_items` — one row per submittal `tag` (unique per bid where the tag is set) or a hand row (`tag` NULL; `label`, `lead_time_days`, `stage` typed): `ordered_on`, `po_ref`, `expected_on` (the supply house's own date; NULL = ordered + lead time), `delivered_on`, `note`. Released (the room's approval) and required (the job's stage window) are derived, never stored.
- `bid_procurement_updates` — a dated update sent to the GC: `sent_to`, the one `line` we wrote, `rows` (the snapshot) and `changes` (since the update before), `sent_by` / `sent_by_name`.
- RLS on both: the bid-pricing role list + `can_access_bid_for_pricing(bid_id)`; both read-only fences applied.
