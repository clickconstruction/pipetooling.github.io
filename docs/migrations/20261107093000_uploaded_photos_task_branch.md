# 20261107093000_uploaded_photos_task_branch.sql (2026-11-07, Documents → Photos reads task photos, punch list #273)

The last piece v2.6602 named: the gallery on Documents → Photos did not read a task card's photo, since the `uploaded_photos` view (`20261101084330`, the job branch `20261102171500`) had no branch for `task_photos` (`20261106230000`). Shipped as v2.6635; the rules are `src/lib/photos/uploadedPhotos.ts`.

- **`uploaded_photos`** gains a sixth branch, `source = 'task'`: a photo taken on a task card at a percent, at the finish or on a Done when… line. A card has no job, so `job_id` and the job columns are null and the card's own words ride the shape instead: `caption` is the card's title (so the server-side search finds it), `stage_name` the shot's own caption (*75%*, *finish*, the line's words) and `status` the shot's kind (`progress`, `finish`, `line`), the way a box photo's `status` and a line's `left_in_gmail` ride the same column. Only a shot with bytes somewhere (`storage_path` or `drive_file_id`). The other five branches are as `20261102171500` wrote them; the view's comment names the sixth.
- **The gate** is `task_photos`' own, `can_see_checklist_instance(instance_id)` (the office, an assignee, the card's writer); the joins on `checklist_instances` and `checklist_items` run under their own policies and are left joins, so a row the taker may see never disappears for a title they may not read.
- **No table is made**, so the fence calls are not needed; nothing here writes. The `photo-save` cron already names `task_photos` (`20261106230000`).

Apply order: the client reads only columns the view already has, so a client ahead of the push lists no task photos and breaks nothing; `check:calls-ahead` labels the PR for the view it replaces. Push after the merge; no types regen (the view's columns are unchanged).

**Applied** to prod on 2026-11-07, read the same day: `npm run check:migration-drift` from the docs worktree read 1153 local files and 1153 remote versions, fully applied, this file among them (a view with the same columns, so no types regenerated for it).
