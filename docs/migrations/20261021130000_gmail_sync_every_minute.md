# 20261021130000 — the inbox reader every minute (v2.5719)

**What it does**: reschedules the `gmail-sync` cron from `*/3 * * * *` to `* * * * *`. The job's statement is unchanged from `20261013080000_messages_email_in.sql`: it posts to `/functions/v1/gmail-sync` with the vault's `CRON_SECRET` only while `app_settings.gmail_sync_on_v1` is `'true'`. Unschedule by name, then schedule, so a second run is harmless.

**Why**: the owner, 2026-10-21, switching Messages on: an email that comes just before a call should be in the thread by the time the phone rings. Three minutes was the first safe setting, not a limit; a minute halves the average wait from 90 seconds to 30. The reader takes at most 40 emails a run, and `email_write_line` holds the `Message-ID`, so two runs at once write one line.

**Tables**: none. **RLS**: none. **Fences**: none (no table).

**Applied to prod on 2026-10-21**: the ledger carries `20261021130000 gmail_sync_every_minute` (read over the session pooler the same day, read-only, after #5967 merged); the function is unchanged, and `npm run check:edge-drift` read all 162 functions current. A DDL-only push, so the hour is not dated.

**Apply**: `supabase db push` from a clean checkout of `main` after this merges; the client's words (the Read bids@ card, its dialog and toast, the guide) say *every minute* from the same version, and read right either way.

**Check**: `select schedule from cron.job where jobname = 'gmail-sync'` reads `* * * * *`; `gmail_sync_state.last_run_at` moves every minute while the switch is on.
