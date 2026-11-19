# 20261118200000_person_watch_notices.sql (2026-11-18, v2.7842)

A watch tells the people on its list. Ships with the edge function `watch-notify-dispatch`.

- **`person_watch_notices`**: one row a notice sent: the watch, the notice's key, its kind, day and words, and who was told. `(watch_id, key)` is unique. The function writes the key before its push goes, so two runs never send one notice twice. Devs alone read it (`is_dev()`); the service role writes it.
- **The cron job `watch-notify-dispatch`**: every five minutes (`2-59/5 * * * *`), `net.http_post` to the function with `X-Cron-Secret`, the vault's `PROJECT_URL` and `CRON_SECRET`, as the other dispatch jobs do. Unscheduled first, so a second apply leaves one job.
- Additive and idempotent. Ends with the four fences.

**Order.** Deploy the function first (`supabase functions deploy watch-notify-dispatch`), then `supabase db push`. Pushed first, the job calls a function that is not there every five minutes and gets a 404 each time until the deploy, which harms nothing and tells nobody.

**Applied** to prod on 2026-11-19 by `scripts/db-push.sh`, after #8788 merged and after the function was deployed. Read back: the table with RLS on, its dev-only select policy and the four fences, and the cron job active on `2-59/5 * * * *`. The job's first run, at 08:47 UTC, got a 200 from the function with `{"watches":0,"sent":0}`: no watch was set, so nothing was sent.
