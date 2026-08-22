# 20260822215500 — partner_auto_threshold (v2.2107)

Automatic §3 threshold for the Partnerships → Job review tab.

- `partnerships.auto_threshold_pct integer` — CHECK 1–100 or NULL (off). Set by the office on the Job review tab; the office client fires the rule on tab load.
- `jobs_ledger.partner_confirmed_auto_pct integer` — NULL = the majority call was a person's; set = made by the rule, at this percent (UI shows "auto ≥ N%"). Cleared with the flag.
- `jobs_ledger.partner_auto_exempt_at timestamptz` — stamped on every explicit clear; the rule never re-adds an exempted job (enforced in the RPC). Cleared by a manual re-confirm.
- `set_job_partner_majority(p_job_id, p_person_id, p_auto_pct)` — 3-arg replaces the 2-arg (old overload dropped to avoid ambiguity; PostgREST named-arg calls from deployed clients resolve fine). Clear branch stamps the exemption; auto branch silently skips exempted/already-assigned jobs and never errors; manual branch clears the exemption.
- `get_partner_job_review_queue` — rows gain `confirmed_auto_pct` and `auto_exempt`.

No new tables (no read-only-block calls needed). Idempotent ADD COLUMN IF NOT EXISTS + CREATE OR REPLACE.
