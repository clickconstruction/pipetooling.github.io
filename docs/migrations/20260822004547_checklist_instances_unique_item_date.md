# 20260822004547_checklist_instances_unique_item_date

One occurrence per checklist item per day, enforced (v2.2055, checklist
scheduling overhaul phase 1).

- **Dedupe pass** (defensive): among duplicate `(checklist_item_id,
  scheduled_date)` rows, keeps completed > has-assignees > oldest, deletes the
  rest. Prod verified duplicate-free before shipping (2,599 rows, 0 dupes,
  2026-08-21) — the pass is for safety/idempotency.
- **`checklist_instances_item_date_uniq`**: unique index on
  `(checklist_item_id, scheduled_date)`. Every instance creator (Add modal,
  Edit regeneration, cron top-up, completion chaining) upserts against it —
  idempotent by construction.

No new table (read-only-block calls not required). `SET lock_timeout = '3s'`.
Apply via `supabase db push` after merge, per house rules.
