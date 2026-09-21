# 20260921203000_lien_notice_months_restore_window.sql (2026-09-21, v2.3683)

Same-day fix for [`20260921193000_lien_notice_months_keep_unrecorded.sql`](./20260921193000_lien_notice_months_keep_unrecorded.md)
(v2.3680), which was written from the v2.3405 body of `list_lien_notice_months` and, once
pushed, silently undid v2.3412's widening in `20260914190000_lien_desk_affidavits.sql`:
a job counts when billed **or** with a billed invoice, and once any of its months is inside
the look-ahead window every unnoticed month with an open window rides along (so June's
notice can name July and August). Seen live on job 258 within the hour: August vanished
from the Months card and gate 4.

This body is v2.3412's again with v2.3680's rule kept: a closed month that is unnoticed
and unrecorded (no skip, no noted miss) stays since the desk went live (2026-09-14), and
such a month brings its job into the window on its own (`silent` CTE, unioned into `w`).

Pushed 2026-09-21 the moment it was written. Lesson, recorded in the fragment: a
`CREATE OR REPLACE` must start from the **newest** definition in the migrations folder,
not the file that first created the function — grep the name across every migration first.
