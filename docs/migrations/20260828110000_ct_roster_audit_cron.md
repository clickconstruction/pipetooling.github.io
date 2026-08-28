# 20260828110000 — ct-roster-audit weekly cron (v2.2438)

Schedules `ct-roster-audit` (pg_cron job `ct-roster-audit`, Mondays 13:00 UTC = 7am
CST/8am CDT) — the CT↔PT bridge's weekly drift audit. Vault `PROJECT_URL` +
`CRON_SECRET` pattern, same as the email dispatchers; weekly cadence needs no
5-minute-lane coordination. Idempotent: unschedules an existing job first.

Apply via `supabase db push` after merge. The edge function must be deployed too
(`supabase functions deploy ct-roster-audit`).
