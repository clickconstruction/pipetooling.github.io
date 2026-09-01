# 20260901120000_money_waiting_email.sql — Money waiting weekly email (v2.2565)

The Pay speeds "Money waiting" list on the payment-forecast email rails
(`20260824133529` skeleton, cloned + renamed):

- **`money_waiting_email_requests`** — one row per requested send; staff
  insert their own (dev/assistant-like/master), creators read/cancel unsent,
  no client UPDATE (the edge function stamps). pg_cron `4-59/5` (co-riding
  the :04 lane) posts to `money-waiting-email-dispatch`; `repeat_weekly`
  re-enqueues +7d.
- **`get_money_waiting_email_payload()`** (service-role only) — the forecast
  payload's billed-invoice rows **plus `job_address`** (emails print full
  addresses, city included) and a pay-speed mirror upgraded to the **v10
  samples rules** (COALESCE billed/est clock, HCP same-day quarantine, owner
  exclusions, No Count Date). Promises dropped (the money view doesn't use
  them).
- **`get_my_email_schedule` / `get_global_email_schedule`** — bodies verbatim
  from `20260824133529` + a `money_waiting` one-offs branch / requests key.

Ends with both `apply_read_only_*` guards (CREATE TABLE rule).
