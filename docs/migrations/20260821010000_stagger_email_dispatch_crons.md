# 20260821010000_stagger_email_dispatch_crons.sql (2026-08-20, v2.1919)

Part 2 of the Aug 19–20 OOM-crash-loop remediation. The four `*/5` email
dispatchers (`billed-report-email`, `gc-statement-email-dispatch`,
`weekly-movement-email-dispatch`, `weekly-money-email-dispatch`) plus
`sync-salary-sessions` all fired in the same second, and `paid-job-email`
joined the volley every 15 minutes — five simultaneous `net.http_post` calls
whose edge functions all queried back at once. Several of the incident's
crashes landed seconds after this volley.

Each dispatcher moves to its own minute lane: billed-report `:01/…`,
gc-statement `:02/…`, weekly-movement `:03/…`, weekly-money `:04/…` (all
5-minute cadence), paid-job `:07/:22/:37/:52`. `sync-salary-sessions` stays at
`*/5` on `:00` (payroll anchor, mirrored in `supabase/seed.sql`).

- Re-schedule convention: `cron.unschedule(jobid) … WHERE jobname = …` then
  `cron.schedule` — **jobids change**; nothing keys off them.
- Command bodies copied verbatim from each job's source migration (uppercase
  Vault `PROJECT_URL`/`CRON_SECRET`).
- Worst-case email lateness grows ≤4 minutes; no documented SLA is tighter
  than the cron tick (`docs/REPORT_SUBSCRIPTIONS.md`).
- Possible follow-up (not done here): the archive-registered `*/15` jobs
  (`send-scheduled-reminders`, `recurring-job-report-dispatch`,
  `schedule-day-email-dispatch`, `schedule-share-dispatch`) still co-fire at
  `:00/:15/:30/:45`.
