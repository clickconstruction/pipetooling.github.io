# 20260928175002_bids_include_schedule_of_values.sql (2026-09-28, v2.4066)

One boolean on `bids`: `include_schedule_of_values` (not null, default false). The Cover Letter's **Schedule of values** pill remembers per bid the way `include_payment_schedule` and `include_materials_by_stage` do; the Approval PDF reads it fresh. Additive — the old client never reads it, so the client and the migration can go in either order.
