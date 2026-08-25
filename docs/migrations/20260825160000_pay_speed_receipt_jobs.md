# 20260825160000_pay_speed_receipt_jobs.sql — receipts carry their job (v2.2288)

`get_billed_customer_pay_speeds()` v7 (v6 was `20260825001052`). The
`samples` CTE now carries `j.id / j.job_name / j.job_address` through
`recent_samples`, and each receipt object gains `jobId` / `jobName` /
`address` — so the Pay speeds drill-down can name the job behind every
payment and open its job detail on tap. Everything else (gate, quarantine,
quality block, 12-receipt cap) unchanged from v6. CREATE OR REPLACE only —
no table DDL, no RLS changes.
