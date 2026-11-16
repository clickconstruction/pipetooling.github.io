# 20261116130000_bid_priced_labor_rows.sql (2026-11-15, v2.7370)

Team scorecard (punch list #360), the train's one residual: the labor count is kept with the priced margin.

- **`bids.priced_labor_rows_total`** and **`bids.priced_labor_rows_with_hours`** (integer, nullable): the bid's labor rows that are not a sub's, and those with hours on any stage, counted the way `bid_estimate_breakdown` counts them, at the moment of the stamp. NULL on a stamp made before this migration.
- **`stamp_bid_priced_margin`** counts them itself and writes them with the margin. **Its arguments do not change**, so every client, old and new, stamps as it did. The body is prod's on 2026-11-15 (the same as `20261115030000_bid_difficulty.sql`'s) with the count added and nothing taken away; `bidPricedMarginSql.test.ts` pins it as the newest definition. Still `SECURITY INVOKER`: the count reads `cost_estimate_labor_rows` as the person pricing, who reads them on the Labor tab.
- No table is created, so there are no fence calls. Two nullable columns with no default: no rewrite of `bids`.

Why: the stamp freezes when a bid is sent, and the estimating score will not judge a bid whose labor was not estimated. That was read from the Labor tab as it stands today, so hours filled in after a bid went out made it read as judged while its kept cost still had no labor in it.

**Apply order**: any. The client reads the two columns in their own read, failing soft to none, so before the push every bid is judged as before. Regenerate types after the push as a `chore(types)` PR.
