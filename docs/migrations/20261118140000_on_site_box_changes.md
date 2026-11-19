# 20261118140000_on_site_box_changes.sql (2026-11-18, v2.7825)

Materials on site: who changed a box, and who took an answer off. The second PR of the train that reads a site's presses by person. Database only; the By person look reads these in the PR after the push.

- **`job_container_changes`**: one insert-only row for each of a box retired, brought back, or its kind, where line or words changed, with the old value, the new one, who and when. Written by `job_containers_keep_changes`, an AFTER UPDATE trigger on `job_containers`, in the caller's own name (`auth.uid()`, `box_sticker_caller_name()`). A box's name stays in `job_container_names` and a move between places in `job_container_moves`.
- **`on_site_removed_answers`**: one insert-only row for a part tie (`on_site_part_ties`) or a site price (`on_site_prices`) deleted: which, its scope, the row as it stood (`was`, jsonb), who took it off and when. Written by `on_site_keep_removed_answer`, a BEFORE DELETE trigger on both tables. A row that goes with its job or development (the cascade) is not kept.
- **Who reads.** `job_container_changes` by the on-site gate on the box's job, as `job_container_names` is. `on_site_removed_answers` by `on_site_can_tie_parts()` and `on_site_can_read_ties()`, the rule of the rows it describes. Neither has an INSERT, UPDATE or DELETE policy.
- Nothing here changes what anyone may do. Additive and idempotent. Ends with the four fences.

Apply: `supabase db push` after the merge. No client reads the tables yet, so there is no order to keep.

**Applied** to prod by 2026-11-18: the dev seat's `check_migration_ledger` read 1,380 versions applied against 1,381 local files, this version among them and `20261118190000` alone still to push (read in the docs pass after #8710).
