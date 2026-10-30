# 20261030070000_photo_save_cron_all_sources.sql (2026-10-30, a checklist per stage, punch list #164 PR 3)

The `photo-save` cron with every source's clause. The sweep files four kinds of photo, and its cron calls it every five minutes only while one of them waits, one `EXISTS` clause each:

- a job's tick is on (`photo_saves.on_since`), for the Messages pass;
- a box photo waits (`job_box_photos`, punch list #209);
- a saved report's photo waits (`report_photos` with a `report_id`, punch list #189);
- a checklist photo waits (`stage_checklist_answers` with a `photo_storage_path` and no `photo_filed_at`, punch list #164).

**Why a migration of its own.** `20261029210000_stage_checklists.sql` (#164 PR 2) scheduled the cron with the checklist clause. `20261029220000_report_photos.sql` (#189 PR 5b), written beside it the same evening, re-scheduled it an hour later with the report clause and without the checklist one. Pushed in order, the second wins, so a checklist photo alone would wait in its bucket until some other photo woke the sweep. This writes all four again. It is unscheduled first, so a second run leaves one row, and it makes no table, so it has no house calls.

**A later source** re-schedules the cron with every clause here plus its own; the function's header says so too.

Apply order: after `20261029220000_report_photos.sql`, with a plain `supabase db push` from the main checkout once PR 3 (#6455) is on main. Nothing is lost before it: a checklist photo waits in the bucket with its row and files on the first run that some other photo wakes. The function's fourth source deploys with the same PR (`supabase functions deploy photo-save`).
