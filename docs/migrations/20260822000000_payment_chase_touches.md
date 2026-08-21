# 20260822000000 — payment chase touches (v2.2025)

New table `job_payment_chase_touches`: the call log behind the Pipeline's payment follow-up queue — one row per recorded chase outcome (`promised` / `cant_reach` / `resend` / `dispute` / `note`) on a customer, optionally pinned to a job. `promised_date` mirrors what the client also writes to `job_promised_pay_dates`; `snooze_days` drives can't-reach re-entry; `resolved_at`/`resolved_by` close disputes.

Access mirrors `job_promised_pay_dates` (v2.1944): table RLS is dev-only; all traffic through gated SECURITY DEFINER RPCs — `add_payment_chase_touch` (write), `resolve_payment_chase_dispute`, `list_payment_chase_touches` (last 180 days, newest first, with recorder names; NULL outside dev/master/assistant-like). Ends with both read-only-block applies. The queue itself is derived client-side ([`src/lib/jobs/paymentChase.ts`](../../src/lib/jobs/paymentChase.ts)) — a paid bill leaves the loop with no cleanup.
