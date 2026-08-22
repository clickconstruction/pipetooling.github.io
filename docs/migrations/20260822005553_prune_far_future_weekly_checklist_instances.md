# 20260822005553_prune_far_future_weekly_checklist_instances

Rolling-horizon cutover (v2.2056, scheduling overhaul phase 2). Weekly items
used to materialize 104 weeks of occurrences at save; the nightly top-up in
`send-scheduled-reminders` now keeps 35 days stocked.

- Deletes `checklist_instances` for `day_of_week` items where
  `scheduled_date > CURRENT_DATE + 35`, `completed_at IS NULL`, and no
  `checklist_instance_events` exist. Assignee rows cascade.
- Idempotent DML; `SET lock_timeout = '3s'`.
- **Ordering**: deploy the updated `send-scheduled-reminders` (the top-up)
  before or with `db push` — the pruned window is refilled nightly either way,
  since the prune only removes rows beyond 35 days out.
