# 20260907130000 — money rollups read the sheet → job link

v2.3059. Follow-up A + E of [`to-dos/sub-sheet-job-link-followups.md`](../../to-dos/sub-sheet-job-link-followups.md). Six functions re-created from their latest bodies with only the sheet ↔ job join changed to `people_labor_jobs.job_ledger_id`:

| Function | Was | Now |
|---|---|---|
| `get_paid_job_email_payload(uuid)` | `lower(trim(job_number)) = lower(trim(hcp_number))` | `plj.job_ledger_id = job.id` |
| `get_billed_aging_costs()` | same text join | `plj.job_ledger_id = t.id` |
| `get_paid_profit_stats()` | same | same |
| `partner_job_cost_buckets(uuid)` | same | same |
| `get_weekly_money_movement_payload(date)` | correlated `btrim() = btrim()` — case-sensitive, **oldest** job first | `lj.job_ledger_id` |
| `settle_step_commitment(uuid, boolean)` | step-anchored sheet on a one-job project wrote `hcp_number` only | writes `job_ledger_id` + the effective number |

No table changes; idempotent. The v2.3055 back-fill linked every sheet whose number resolved (70/70), so the rollups count the same sheets as before, except the weekly payload, which now agrees with the other four on case and picks the same (newest) job for a reused number.
