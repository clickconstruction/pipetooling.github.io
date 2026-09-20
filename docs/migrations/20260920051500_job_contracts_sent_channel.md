# 20260920051500_job_contracts_sent_channel.sql (2026-09-19, v2.3629)

Signing it on paper, PR 2 (`to-dos/contract-paper-lane`). `job_contracts.sent_channel text` with `job_contracts_sent_channel_check` (`NULL | link | pdf_email | handed`). NULL reads as a signing link — every send before the column, and `send-job-contract`'s two modes until a later PR stamps them — so there is no backfill. `handed` is written by the client's one hand-off write (`markJobContractHanded`): the draft becomes `sent` with no token and `next_reminder_at = NULL`. `pdf_email` is reserved for PR 3. Additive and idempotent; no table created, no RLS change (the office UPDATE policy already admits the writers).

**Apply order:** client first. Before the push the client's hand-off update names a column that does not exist and fails with a toast; nothing is half-written because the update is one statement.
