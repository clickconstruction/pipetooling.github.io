# 20261116020000_jobs_ledger_crew_reads.sql (2026-11-15, v2.7375)

Punch list #355 ([`to-dos/job-window-phone.md`](../../to-dos/job-window-phone.md)), the fault found on the crew's job window: the Plans section answered *Could not read the job* for the sample superintendent on a job he is on the crew of.

- **`"Crew can read jobs ledger for team or schedule"`** on `jobs_ledger`, `FOR SELECT TO authenticated USING (helper_on_job(id))`. A person on the job's crew reads the job's row: the team table, or a schedule block on the job this week or last, as `helper_on_job` (`20261014220000`) already answers for thread notes, plan parts and the checklists.
- Before it, the row opened to a field role three ways: a subcontractor on the team or schedule (`subcontractor_can_read_jobs_ledger_row`), anyone through a clock session of their own on the job, and the office. A helper, a superintendent or an estimator on the crew read nothing of the job until their first clock-in there.
- `helper_on_job` is `SECURITY DEFINER` with `row_security = off` and reads the team table and the blocks, never `jobs_ledger`, so the policy does not come back into itself.
- Read only. No write policy moves. The restrictive fences (`archived_fence`, `primary_scope_jobs_ledger`) stand over it as they do over every other read.
- No table is created, so the four fence calls are not needed.

**What it opens.** The whole row, as the clock-session rule and the subcontractor's rule already do. The crew's screens select the columns they draw; the row itself holds the job's revenue, as it does for a helper who has clocked in there once.

**Read on prod before the PR** (2026-11-15, counts only): 926 rows in `jobs_ledger`; on working jobs 20 of the helpers' 58 crew rows and 13 of the superintendents' 23 had no clock session of that person on that job, so those windows read no customer, no status and no plans. A subcontractor's 12 were already open by their own rule.

**The bed.** `plan_sets_author` gains two lines: Hal, a helper on job A's crew with no clock session, reads job A's row and not job B's.

**Apply order**: push any time after the merge. No client names it; the crew's window and the Plans section read the row they already ask for.

**Applied** to prod by 2026-11-16: `npm run check:migration-drift` read 1326 local files against 1326 applied, this version among them (run in the docs pass after #8111).
