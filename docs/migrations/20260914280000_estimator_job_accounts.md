# 20260914280000_estimator_job_accounts.sql (2026-09-14, v2.3451)

Job accounts from the bid — the estimator who won a bid gets the job-account tools on the job the win moment creates. Estimators read no `jobs_ledger` rows by design; every door here is gated on "the job carries a bid" (`jobs_ledger.bid_id`), which is theirs to read.

- **`estimator_can_reach_job_account(job_id)`** — `is_estimator()` and the job has a `bid_id`. SECURITY DEFINER, `authenticated` only.
- **`job_supply_house_accounts`** — the three policies gain that branch: SELECT (job readers or the estimator gate), INSERT (office, the estimator gate, or a requested-row-as-self by a job reader), UPDATE (office or the estimator gate). Estimators may therefore mark accounts opened / not needed on bid-linked jobs — the owner's decision of 2026-09-14.
- **`supply_house_job_accounts.bid_id`** (the send log) + an estimator SELECT policy (the gate) and `supply_house_job_accounts_insert_estimator_self` (the gate and `sent_by = auth.uid()`), for *Ask {rep} by email* sends logged from the bid.
- **`list_job_account_strip`** — same shape; its job gate is now `can_read_job_activity(job, false) OR estimator_can_reach_job_account(job)`.
- **`job_account_job_identity(job_id)`** (new) — id, numbers, name, address, bid for the after-create question, under the same two-way gate, so an estimator's prompt has a job to name without a `jobs_ledger` select.
- **`list_bid_job_account_strip(bid_ids)`** (new) — per bid (office set or estimator): the newest linked job, and one row per house that expects an account, quoted the bid (`bid_rfqs`), or holds an account on the job — with status and the house's job-accounts rep (id, name, phone, **email**). Only `vendor_kind = 'supply_house'` rows. Feeds the Job block's chips.

Idempotent (`CREATE OR REPLACE`, `DROP POLICY IF EXISTS`, `ADD COLUMN IF NOT EXISTS`). Apply order: push after the client merge — the new RPCs are called only by the new client, which treats an RPC error as "nothing to show".
