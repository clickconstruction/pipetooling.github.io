# 20260914220000_list_job_account_strip.sql (2026-09-14, v2.3424)

Job accounts at the counter, PR 2 — the one read behind the **Job accounts strip** on every job card the field opens.

`list_job_account_strip(p_job_ids uuid[])` → for every job in the list the caller can read (`can_read_job_activity(job, false)` — office, the job's master, adopted / shared assistants, primaries, the crew on the team): one row per supply house with `job_accounts = 'expects'` (`status` NULL = none yet) **plus** one row per `job_supply_house_accounts` row the job has at any other house; each row carries the house name and policy, the account's status / reference / how and when it was opened / when it was asked for and whether from the counter / note, and the house's **job-accounts rep** (first unarchived `role = 'job_accounts'` contact, default first: id, name, phone).

`SECURITY DEFINER`, `STABLE`, gate inside — the crew cannot read `supply_houses` directly (its SELECT policy stops at dev / master / assistant / estimator / primary / superintendent). `REVOKE … FROM PUBLIC, anon`; `GRANT EXECUTE TO authenticated, service_role`. Idempotent (`CREATE OR REPLACE`).

Depends on `20260914210000_job_supply_house_accounts.sql` (the table and the two columns). Apply order: push any time after the client merge — the hook treats an RPC error as "no strip" so a client ahead of the push shows nothing.
