# 20261006230000_supply_houses_default_lead_time_days.sql (2026-10-06, v2.4685)

Adds `supply_houses.default_lead_time_days integer` (null by default, 0–730): the house's usual lead time. Punch list #89, item 2: BP375 had 43 parts with no lead time, so the procurement log's order-by dates, the day the GC must answer by and the calendar never appeared — the only ways in were per part or **Set…** on all of them.

Set on the supply house form (**Usual lead time**, `SupplyHouseForm` / `useSupplyHouseEditor`). Read by `procurementItemsFrom` (`lib/submittals/procurementLogIo.ts`): a part, or a row with no parts, whose lead time is null takes its house's usual one on the log; a typed number wins. The parts editor shows the usual as the empty box's placeholder (*3 wk · National Wholesale's usual*) and stops flagging the box as owed.

Additive and idempotent; no order coordination — the old client ignores the column. The per-product memory ("as last time", the same maker and model on an earlier bid) is deferred: measured 2026-10-06, only two bids carry parts and the `manufacturer` / `model` columns are empty on 70 of their 73 parts.
