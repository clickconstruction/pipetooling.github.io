# 20260921193000_lien_notice_months_keep_unrecorded.sql (2026-09-21, v2.3680)

`CREATE OR REPLACE` of `public.list_lien_notice_months(integer)` — same signature, same
return shape, no client change. Follows v2.3679 (the missed-window alarm), whose
Dashboard line and desk strip could only live as long as the RPC returned the closed
month: seven days after its deadline (`deadline >= app_today() - 7`), after which the
loss aged out of every client-side computation.

The `WHERE` now keeps a closed month that is **unnoticed** (no live `job_lien_filings`
notice names it) **and unrecorded** (no `job_lien_desk_items` row with `status = 'missed'`
names it — a skip, or a noted miss) for as long as its deadline is on or after
`2026-09-14`, the day the desk went live. Months whose window closed before the desk
existed were never its to catch and are not swept in. A recorded closed month keeps the
old seven days, then drops — its record lives on the desk item and shows under *Earlier
months* from there.

`noticed` moved from the outer `SELECT` into a `flagged` CTE beside the new `recorded`
flag so the filter can read both; the returned columns are unchanged.

Apply with `supabase db push` after the PR merges (a function replace; `lock_timeout` is
set). No order dependency on the client: v2.3679's client is already live and reads the
same columns.
