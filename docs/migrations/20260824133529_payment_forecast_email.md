# 20260824133529 — payment_forecast_email (v2.2223)

Payment forecast → email stream (REPORT_SUBSCRIPTIONS #10), schema half:

- **`payment_forecast_email_requests`** — one row per requested send (`send_at`, `recipient_user_id`, `repeat_weekly`, `sent_at`, `error`, `attempts`). RLS mirrors `billed_report_email_requests`: staff (dev/master/assistant-like) insert own; creators + devs read; creators delete own unsent; no client UPDATE (the dispatcher stamps). Partial index on due rows.
- **`get_payment_forecast_email_payload()`** — service-role-only SECURITY DEFINER. Returns `{generated_at, today, rows, pay_speeds, promises}`: rows = billed invoices on billed non-collections jobs with `remaining = GREATEST(0, amount − Σ payments)` (billed-report invoice branch; job-shells excluded — the forecast kernel skips them); `pay_speeds` = verbatim CTEs of `get_billed_customer_pay_speeds` v2 (20260821120000) minus the auth gate; `promises` = `list_job_promised_pay_dates` mirror minus the gate. Bucketing happens in the dispatcher via the client-kernel port (`supabase/functions/_shared/paymentForecastCore.ts`).
- **Cron** `payment-forecast-email-dispatch` at `4-59/5 * * * *` — co-rides weekly-money's lane; all five */5 lanes were taken by the v2.1919 stagger, and both co-tenants no-op cheaply on empty ticks.
- **`get_my_email_schedule()` / `get_global_email_schedule()`** rebuilt (live bodies from 20260820020000, verbatim) + `payment_forecast` one-offs branch (recipient-scoped) / `payment_forecast_requests` key.
- Ends with both read-only training-mode blocks (CREATE TABLE rule).
