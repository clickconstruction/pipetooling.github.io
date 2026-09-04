# 20260904202939_statement_round_client_row_keys.sql (v2.2771)

Re-creates `get_statement_round_for_user(p_user_id)` (from `20260904201238`, same PR) so the certification snapshot diff uses the **client's** row keys.

- The GC Review rollup keys a job with exactly one billed invoice by **job id** (`buildBilledStageRows` → `job_with_merged_billed`), a job with none by job id (shell), and only jobs with two or more billed invoices by invoice id. The statement payload's `row_key` is the invoice id for every invoice row.
- New `group_rows` CTE re-keys: `row_key = job_id` → job id; one row for that job in the group → job id; else the invoice id. Row-count and key+remaining-cents checks now run over `group_rows`.
- Caught by the pre-first-dispatch fidelity check: with invoice keys, Malachi read 0 ready / 3 held against a panel showing 2 in his round.

Body otherwise identical to the first cut; `CREATE OR REPLACE`, additive.
