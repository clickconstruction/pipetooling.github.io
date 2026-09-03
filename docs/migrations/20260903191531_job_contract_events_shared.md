# 20260903191531_job_contract_events_shared.sql (2026-09-03, v2.2712)

**Signed agreement view, PR B** — adds `'shared'` to the `job_contract_events.event_type` CHECK so `share-job-contract` can log who received a signed copy (to, channel, by whom). Drop-and-re-add of the constraint (no data rewrite; existing values all satisfy the wider set).

**Apply order**: push before deploying `share-job-contract` — until then the function's event insert fails and it falls back to logging only the job-activity row.
