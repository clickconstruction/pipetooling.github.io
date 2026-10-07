# 20261003150500_paid_job_email_months_in_app_tz.sql (2026-10-03, v2.4474)

One of the instant-day fixes that follow v2.4452. Replaces `get_paid_job_email_payload` so its `timeline` (the monthly labor, parts and payments table the paid-job email draws when no cost or payment event carries a day) buckets by the company's month. The session zone is UTC, so the three month expressions put anything on the last evening of a month (after 7 pm CDT, 6 pm CST) in the next month:

| Bucket | Was | Now |
|---|---|---|
| labor | `date_trunc('month', cs.clocked_in_at)` | `cs.clocked_in_at AT TIME ZONE 'America/Chicago'` |
| parts | `COALESCE(mt.posted_at::timestamptz, a.created_at)` | the same `AT TIME ZONE 'America/Chicago'` |
| payments | `COALESCE(p.paid_on::timestamptz, p.created_at)` | `COALESCE(p.paid_on::timestamp, p.created_at AT TIME ZONE 'America/Chicago')` |

`paid_on` is a `date` and keeps its own month: `::timestamp` (not `::timestamptz`) leaves it at its own midnight. The payload's v4 date keys already read every instant in `America/Chicago`.

The body is the newest definition (`20260916190000_card_refunds_net_sql_readers.sql`) with only those three expressions changed; no signature, table or grant change, so `CREATE OR REPLACE` keeps the existing grants. Checked on a local bed of the whole schema (every migration applied in order, this one twice): a session, a card charge and an undated payment at 7:30 pm CDT on Sep 30 bucket into 2026-09, a payment dated Oct 1 into 2026-10; without this migration all three read 2026-10.

Apply order: independent of the client; push after merge with `bash scripts/db-push.sh`. No edge function redeploy: `paid-job-email` calls the RPC at send time.
