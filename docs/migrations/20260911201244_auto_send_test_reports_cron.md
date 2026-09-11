# 20260911201244_auto_send_test_reports_cron.sql (2026-09-11, v2.3316)

Test reports dial B (fragment `docs/recent-features/v2.3316.md`).

- `cron.schedule('auto-send-test-reports', '*/10 * * * *', …)` → `net.http_post` to `/functions/v1/auto-send-test-reports` with the vault `PROJECT_URL` and `CRON_SECRET` (the `billed-report-email` pattern, `20260803100000`). Unschedules any earlier job of the same name first.
- No tables, no policies. The function is a no-op until Settings → Test reports → Sending is set to *Send PASS reports automatically*, so the schedule is safe on its own.

Apply order: merge, `supabase db push`, then `supabase functions deploy auto-send-test-reports` (and redeploy `send-test-report`, which now shares `_shared/testReportSend.ts`).
