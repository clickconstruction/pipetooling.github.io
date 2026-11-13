# 20261112230000_roadmap_task_places.sql (2026-11-12, v2.7063)

A roadmap task can carry a place (punch list #328, PR 5 of 8). `20261112220000` gave the task as written, `checklist_items`, a place. A roadmap task is written in `checklist_tech_tree_group_tasks` and reaches a person's list only when its stage unlocks.

## Why the place is on the roadmap task

`sync_roadmap_to_checklist` makes a `checklist_items` row for a roadmap task whose turn has come, and deletes that row again when the task falls back behind an earlier one. A place set on the made row would be lost on that round trip. So the place is kept where the task is planned, and the card reads it through `checklist_items.roadmap_group_task_id`, the way it already reads `asks_for_photo`. **The sync function is not touched.**

## What it does

The same six nullable columns as the task's own place, on `checklist_tech_tree_group_tasks`: `place_name`, `place_lat`, `place_lng`, `place_accuracy_m`, `place_set_by` (`users.id`, set null when the user goes), `place_set_at`. And the same three checks: `…_place_point_check`, `…_place_whole_check`, `…_place_accuracy_check`.

No row is changed and no default is stored.

## Who may do what

The row's own policies, unchanged. Whoever may read the roadmap reads the place, and a task's assignees may read their roadmap (`20260825001101`). Whoever may edit the roadmap's structure writes it. No new table, so no fence calls.

## Locks

`ADD COLUMN` with no default does not rewrite the table. The foreign key takes a brief lock on `users`, and each check scans the roadmap tasks, a few hundred rows. `SET lock_timeout = '3s'` makes a busy moment fail fast.

## Release order

Merge, then `bash scripts/db-push.sh`. The client reads these columns in a read of its own and writes them only when a planner sets a place, so nothing breaks before the push: a place set on a roadmap task simply says it did not save.

## Verify

Read-only on prod after the push:

- `select count(*) from information_schema.columns where table_name = 'checklist_tech_tree_group_tasks' and column_name like 'place_%'` reads `6`.
- `select conname from pg_constraint where conname like 'checklist_tech_tree_group_tasks_place_%'` lists three.
