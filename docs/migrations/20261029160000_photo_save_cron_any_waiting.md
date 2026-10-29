# 20261029160000_photo_save_cron_any_waiting.sql (2026-10-29, v2.6049)

The `photo-save` cron (`20261014090000`, re-scheduled by `20261029020000`) called the sweep while a box photo waited only when its row carried no `fail_why`. The sweep now writes the reason a shot could not be filed on the row (*That job has no Drive folder yet.*) so the office can read it on the box, and keeps trying each run; the cron therefore calls while any box photo waits, `filed_at IS NULL AND storage_path IS NOT NULL`, with or without a reason. Unscheduled first, so a second run leaves one row.

Apply order: after the function's deploy, as the first cron was. Harmless either way.
