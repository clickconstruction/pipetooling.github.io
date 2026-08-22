# 20260822143810_bid_pricing_history_tab_low (v2.2085)

`bid_pricing_history(p_service_type_id)` gains two pass-through columns from
`bids`:

- `bid_tab_low numeric` — the recorded bid-tab low (v2.2081 capture). The
  Workbench calibration strip turns it into "the margin that would have
  matched this tab's low" (`(low − est_cost) / low`) and a win-odds verdict.
- `customer_id uuid` — the bid's GC, so the verdict can go GC-specific when
  the bid being priced has ≥2 recorded tabs from the same GC.

Return type changes, so DROP + CREATE (CREATE OR REPLACE rejects return-type
changes). Body otherwise identical to `20260822003000`; still `STABLE`,
`SECURITY INVOKER` (RLS applies). Client (`BidPricingHistoryRow`) treats both
columns as optional, so either deploy order is safe.
