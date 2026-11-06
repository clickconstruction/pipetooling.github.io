# 20261106230000_task_cards_progress.sql (2026-11-06, v2.6592)

Punch list #273, PR 1 of six: the ground under task cards that carry a percent, Done when… lines and photos. Taunya's ask of 2026-11-06 on the Checklist and Roadmap pages. Nothing on screen reads it until PRs 2 to 4; pushed right after the merge so those PRs land on columns that exist.

## What it does

1. **`percent_complete`** (smallint 0 to 100, default 0) on `checklist_instances` and on `checklist_tech_tree_group_tasks`; **`asks_for_photo`** (boolean, default false) on `checklist_items` and on the roadmap task. No backfill: a done row reads 100 whatever is stored (the kernel's rule and the trigger below), so the ALTERs add a column with a default and nothing scans the table.
2. **The thread** (`checklist_instance_events`) takes two more kinds, `progress` and `criterion`, and a `percent` column for the progress event (its body the *what is left* words). The CHECK was inline on the CREATE TABLE, so it is found by what it constrains and written again. The insert policy keeps its name and admits the two kinds in the actor's own name, a progress event only with its percent.
3. **`task_criteria`**: the Done when… lines, on a card's definition (`checklist_item_id`) or on a roadmap task (`roadmap_task_id`), exactly one. A roadmap task's lines serve every card the sync makes from it, so nothing is copied. Read follows the parent's own policies through nested `EXISTS` (an item of mine that points at the task counts); written by `can_write_task_criteria(item, task)`: on a card whoever may write the card, on a roadmap task whoever edits the roadmap's structure.
4. **`task_photos`**: the `report_photos` shape keyed on the day row, with `kind` (`progress` · `finish` · `line`), `percent_at` and `criterion_id`; the bucket **`task-photos`** (2 MB, images, `<instance_id>/<photo_id>.jpg`). **`task_criteria_checks`**: a line's tick on one day row, who, when and its photo, `UNIQUE (criterion_id, instance_id)`.
5. **Two gates as functions**, `can_see_checklist_instance(uuid)` (the office, an assignee, the card's writer: the day row's read rule) and `can_work_checklist_instance(uuid)` (the office, an assignee: its update rule), so the new tables and the bucket read the day row from a column or a path. SECURITY DEFINER, EXECUTE to `authenticated`.
6. **Triggers.** `a_task_percent_keeps_done` (BEFORE UPDATE on `checklist_instances`, named to fire before `checklist_instance_transitions_trigger`): done is 100; a 100 set by hand sets `completed_at`, which the transitions trigger then logs as `completed` and the Review queue takes; a reopen sets 0 and clears the day row's ticks (the thread's criterion events keep who ticked what). `task_criteria_checks_recount_aiud` (AFTER INSERT OR DELETE on the ticks) recounts the day row's percent from its live lines, skipped at trigger depth 2 so the reopen's clearing does not update a row mid-update. `sync_roadmap_task_from_instance` is written whole again: it mirrors the percent beside `completed_at` and its trigger fires on either column, so a stage's bar adds the fractions.
7. **The photo-save cron** is re-scheduled with the seven clauses of `20261106050000` and the eighth: a task photo waiting.

The four fence calls close the three new tables.

## Order

Push right after PR 1's merge. PR 2 (the lines), PR 3 (the ring) and PR 4 (the photos) read these columns and tables from the client and are merged after the push. `photo-save` learns the eighth source in PR 4 and is deployed then; until that deploy the cron's eighth clause finds nothing to file and the function ignores the rows.

## Rollback

Nothing on main reads the new columns before PR 2. Dropping the three tables, the two columns on each of the four tables, the two gates, `can_write_task_criteria` and the two new triggers, and re-running `20261106050000`'s cron block and `20260820041532`'s mirror function, puts the schema back.
