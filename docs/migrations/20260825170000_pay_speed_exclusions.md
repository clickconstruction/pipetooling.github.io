# 20260825170000_pay_speed_exclusions.sql — exclusions + data-health drill-down (v2.2290)

1. **`pay_speed_exclusions`** — owner-curated per-payment opt-outs of the
   pay-speed math. `payment_id` PK → jobs_ledger_payments CASCADE,
   `excluded_by` → users SET NULL + denormalized name, `excluded_at`,
   optional `reason`. Toggle back = DELETE. RLS: pay-speeds gate roles
   (dev/assistant-like/master/primary) SELECT; devs + master techs
   INSERT/DELETE. Ends with both `apply_read_only_*` guards.
2. **`get_billed_customer_pay_speeds` v8** (v7 was `20260825160000`):
   `samples` and `quarantined` CTEs and the `unlinked` count skip excluded
   payments (`NOT EXISTS`); `quality` gains `excluded` (12-mo window).
3. **`get_pay_speed_transactions()`** (new, SECURITY DEFINER, same gate,
   anon revoked): every 12-month paid payment with amount/type/customer/job
   (`jobs_ledger_payments.job_id` join, so unlinked payments still know
   their job) + status bucket precedence excluded → unlinked → quarantined
   → measurable, plus the all-time undated-bills invoice backlog.
