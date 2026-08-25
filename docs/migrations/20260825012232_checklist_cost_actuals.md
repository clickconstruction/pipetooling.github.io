# 20260825012232 — checklist_item_costs actuals

Adds `actual_hours` (numeric, CHECK > 0), `actual_recorded_by_user_id`
(FK users, SET NULL), `actual_recorded_at` to `checklist_item_costs` — how
long a costed task really took, recorded at sign-off or after the fact
(v2.2260). Purely additive, idempotent; RLS unchanged (dev/controller).
Apply BEFORE or with the v2.2260 client — its estimate select reads
`actual_hours`.
