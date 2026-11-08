# 20261107130000_hours_statement_drive_copy.sql (2026-11-07, v2.6634)

Signed hours statement (punch list #212, residual C): two nullable columns on `hours_statements` — `drive_file_id` (the Drive file id of the signed PDF's copy in the job's *Team only → Sent by us* folder, put there through `drive-link`'s `put` by the Hours statements section's **Put in Sent by us**) and `drive_filed_at`. No new table, so no fence calls; the table's own policies (`can_touch_hours_statement`) cover the update.

Apply from the main checkout after the PR merges (`supabase db push`), then `npm run gen-types:linked` as its own `chore(types)` PR. The client reads the row with `*`, so before the push the two columns are simply absent (the press shows on every signed row) and **Put in Sent by us** fails at its last step with the column's name as the reason; the Drive copy is made before that step, so a press before the push leaves one file in Sent by us with no record of it — push right after the merge.

**Applied** to prod on 2026-11-07, read the same day: `npm run check:migration-drift` from the docs worktree read 1153 local files and 1153 remote versions, fully applied, this file among them; the #212 card's note (#7267) records the residuals' push done.
