# 20260928191629_bid_sov_labor_material.sql (2026-09-28, v2.4075)

The storage behind the Cover Letter schedule of values' two shapes, all in one push (the By stage half ships with v2.4075, the My lines half with the PR after it). Additive; the old client ignores every column and table.

- `bids.sov_shape` (`stage` | `lines`, default `stage`), `bids.sov_split_labor_material`, `bids.sov_letter_total_only` — the three switches under the Schedule of values pill.
- `app_settings` `bid_sov_labor_share_pct_v1` = 45: the company labor share for a stage with no labor hours (Settings → Bid Cover Letter Defaults).
- `bid_sov_stage_overrides` (bid, stage → typed `labor` or NULL for derived, `note`): the By stage shape's overrides.
- `bid_sov_lines` (bid, `sort_order`, `label`, `value`, `labor` or NULL, `note`, the `stage` it was seeded from): the My lines shape.
- RLS on both tables: the bid-pricing role list + `can_access_bid_for_pricing(bid_id)`, the same predicate as `bid_payment_schedule_rows`; both read-only fences applied.
