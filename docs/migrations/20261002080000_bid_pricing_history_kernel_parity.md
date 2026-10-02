# 20261002080000_bid_pricing_history_kernel_parity.sql (2026-10-01, v2.4372)

`CREATE OR REPLACE` of **`bid_pricing_history(p_service_type_id uuid)`**, the read behind the Pricing tab's win/loss strip (*This number vs your history*, `usePricingMarginHistory` → `PricingMarginHistory`). Its `est_cost` now equals the `totalCost` of [`computeBidCostBreakdown`](../../src/lib/bids/bidTotalCostBreakdown.ts), the Workbench's one cost kernel, materials aside. Same return type, so the grants stay. Body otherwise identical to `20261002070000_bid_pricing_history_combined_materials.sql` (v2.4371), which must be applied first. Still `STABLE` and `SECURITY INVOKER`.

**Three rules move to the kernel's.**

- **Labor hours** follow `laborRowMultiplier` (v2.3291, [`laborRowHours.ts`](../../src/lib/bids/laborRowHours.ts)): kind `sub` = 0, `is_fixed` or kind `task` = ×1, unit `per_100ft` = count ÷ 100, else × count. `bid_estimate_breakdown` reads rows the same way. The old CTE knew only `is_fixed` or × count, so a sub line counted its hours and a footage row multiplied by its feet. Hours also drive the driving cost, so a footage row's feet became trips as well.
- **Estimator time is out** (v2.3294, #3022: the kernel still reports `estimatorCost`, but no total adds it). The old body added `estimator_cost_flat_amount`, else $10 (or `estimator_cost_per_count`) × the bid's count rows. Its `count_rows` CTE counted every version's rows, so a split bid paid it once per version. The CTE and its join go.
- **Distance** is the number the text starts with, as the kernel's `parseFloat` reads it: `96.4 mi` → 96.4, `1,200` → 1, `about 12` → 0, blank → 0. The exponent is capped at three digits so no text can overflow `numeric`, where JavaScript would read Infinity. The old read gave 0 unless the whole text was a number. `bid_estimate_breakdown` still strips everything but digits and dots (`1,200` → 1200; `1.2.3` fails its cast) and the Bid Board map's `parseBidDistanceMiles` drops commas. The Labor box and the address lookup write plain numbers, and on 2026-10-01 every distance on prod was a plain number or blank, so the four readers agree on today's data.

[`bidPricingHistorySql.test.ts`](../../src/lib/bids/bidPricingHistorySql.test.ts) pins the newest body to the kernel: no `estimator_cost`, the four labor branches against `laborRowMultiplier`, and the distance regex against the kernel's reading of 14 strings.

**Still different from the Workbench:** materials, as v2.4371 notes (no Sold in sticks rounding; stage POs first, not the materials model). A dot's margin also divides by `bids.bid_value` where the ▼ divides by the Workbench's revenue, as before.

**Dry run** on prod in `BEGIN … ROLLBACK` (as `postgres`, every service type): the live body, then v2.4371's, then this one. 73 rows under all three (Plumbing 71, HVAC 2, Electrical 0). Each bid's inputs were exported and run through `computeBidCostBreakdown`, with materials from v2.4371's CTE. All 73 match this body's `est_cost` (worst difference 2e-12); 69 differed from v2.4371's. Of the three rules, only estimator time moved anything on 2026-10-01. No labor row on prod is `sub` or `per_100ft` (7,213 rows; the two `task` rows are also `is_fixed`), and no distance is anything but a plain number or blank. Estimator time came off 69 rows: $26,640 in all, $300 median, $2,710 the most. Six split bids had paid it on two versions' rows (BP483: 170 rows, 85 in its active version).

**The strip's dots** (Plumbing; HVAC's two rows never reach the three the strip needs, and both now cost $0, so the kernel drops them):

- v2.4371 draws 6 dots, 2 won and 4 lost on price, all past 65%, so all sit at the scale's right end. This body draws 5. BP298 (won, $110,747) goes from 94.70% to 95.01% and leaves the 95% sanity band. The other five gain 0.03–1.0 points and stay at the right end: BP190 (won) 78.50 → 79.14, BP483 78.63 → 79.37, BP371 83.41 → 84.37, BP357 89.07 → 89.27, BP339 94.91 → 94.94.
- The ▽ tab marks: BP483 56.3% → 57.8%, the one mark that visibly moves; BP319 91.9% → 92.6%, still at the right end.
- The verdict: one win is left, so the highest win falls from 94.7% to 79.1%. A Workbench margin between about 80% and 95% now reads *Above every recorded win (max 79%)* where it read *Mixed territory*.

Apply with `supabase db push` after the PR merges, with or after `20261002070000`. No client change, so deploy order does not matter, and the types do not change.
