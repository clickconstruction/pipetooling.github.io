# 20260822003000_bid_pricing_history_loss_category.sql (2026-08-21, v2.2030)

`DROP FUNCTION` + `CREATE` of **`bid_pricing_history(uuid)`** (return type changes, so
`CREATE OR REPLACE` is rejected): the returned table gains **`loss_category text`**
(`bids.loss_category`, threaded through the `decided`/`ce` CTEs and the final select;
everything else identical to `20260820230000_bid_pricing_history.sql`). The Pricing
Workbench's calibration strip previously found "lost on price" bids by `/price/i` on
free-text `loss_reason` — bids categorized `price` through the Why-we-lost lens (often
with no note) were invisible to it. The client types the new field as optional
(`BidPricingHistoryRow.loss_category?`), so deploy order doesn't matter.
