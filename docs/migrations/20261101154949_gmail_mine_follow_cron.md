# 20261101154949_gmail_mine_follow_cron.sql (2026-11-01, v2.6279)

**What it does**: schedules the cron `gmail-mine-follow`, `*/5 * * * *`, the follow of Messages → My email (punch list #230 PR 4, `to-dos/messages-my-email/README.md`, "3 · Who tags" → The conversation follows): later mail in a conversation a person tagged from their own box lands on the job by itself. Every five minutes it posts `{"action":"follow"}` to `/functions/v1/gmail-mine` with the vault's `PROJECT_URL` and `CRON_SECRET` in `X-Cron-Secret`, as the `gmail-sync` row posts. The function reads, as each person whose switch is on, the conversations they tagged that were read (or tagged and not yet read) in the last 60 days, 100 a run, and lands each mail no line holds yet as a tag lands it ([`docs/EDGE_FUNCTIONS.md` → gmail-mine](../EDGE_FUNCTIONS.md#gmail-mine), the `follow` bullet).

**The gate**: the post goes out only `WHERE EXISTS (SELECT 1 FROM public.email_tag_threads WHERE coalesce(last_read_at, tagged_at) > now() - interval '60 days')`, so nothing posts while nothing is tagged. A run that finds every person's switch off posts and reads nothing.

**Tables**: none. **RLS**: none. **Fences**: none (no table). Idempotent: unschedule by name, then schedule, so a second run leaves one job.

**Tried before the PR** on a throwaway local Postgres 15 with stubs for `cron.schedule` / `cron.unschedule` / `cron.job`, `net.http_post` and `vault.decrypted_secrets`, and an `email_tag_threads` with its two dates: the file applied twice in a row and left one job, `*/5 * * * *`; the job's statement posted nothing with no rows and nothing with one last read 61 days ago, and posted once each with one last read 59 days ago and one tagged yesterday and never read, to `<PROJECT_URL>/functions/v1/gmail-mine` with the secret, `Content-Type: application/json` and `{"action": "follow"}`.

**Apply**: `supabase db push` from a clean checkout of `main` after this merges, and redeploy `gmail-mine` (`supabase functions deploy gmail-mine --no-verify-jwt`). Either order is harmless: before the redeploy the function refuses the cron's post as a call with no session (401) and nothing follows; before the push nothing posts.

**Check**: `select schedule from cron.job where jobname = 'gmail-mine-follow'` reads `*/5 * * * *`; once a conversation is tagged, its `email_tag_threads.last_read_at` moves every five minutes and `last_error` stays null, and the function's log carries one `gmail_mine_follow` line a run.
