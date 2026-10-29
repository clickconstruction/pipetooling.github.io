# 20261029020000_photo_save_cron_box_photos.sql (2026-10-29, v2.6045)

The `photo-save` cron (every 5 minutes, `20261014090000_photo_save_cron.sql`) called the sweep only while some job's Messages tick was on. Materials on site (punch list #209) gives the sweep a second source, the box photos a crew shoots on the On site tab (`job_box_photos`, `20261029010000_materials_on_site.sql`), so the cron now also calls while a box photo waits in the `box-photos` bucket: `filed_at IS NULL AND storage_path IS NOT NULL AND fail_why IS NULL`. Unscheduled first, so a second run leaves one row.

Apply order: after `20261029010000` (the table) and after the function's deploy, as the first cron was. Harmless either way: with no waiting photo and no tick the cron makes no call; the sweep itself reads the table only when it exists.
