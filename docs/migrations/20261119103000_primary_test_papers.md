# 20261119103000_primary_test_papers.sql (2026-11-19, v2.7926)

A primary reads the test papers of their own jobs (punch list #400 PR 4, `to-dos/primary-job-doors.md`). It stands on `20260823172141_primary_scope_jobs.sql` (`primary_can_access_job`), long live. Push after the PR merges. No client change.

## What it does

`can_reach_job_for_test_report(job)` is its live definition with **one change**: the primary leg takes `AND public.primary_can_access_job(j.id)`. The function is the job check of all four `job_test_reports` policies and of the `job-test-reports` bucket's read policy, so the table and the PDFs follow with no policy rewritten.

## Why the shape

- `job_test_reports` was made on 2026-09-11, after the `primary_scope_*` fences of 2026-08-23. It took the `jobs_ledger_fixtures` job predicate without the restrictive policy that sits on top of it there. So a primary on no job read every job's test paper and its file. The audit of 2026-11-19 proved it on a copy of the whole schema.
- `primary_can_access_job` and not a wider predicate: a test paper is a job document, and it is the rule every other job child table asks. Documents already shows a primary their own jobs only.
- The fix is in the function and not a new restrictive policy, because the bucket's policy asks the same function. One edit holds both.
- A primary only ever read here. The insert, update and delete policies never named the role.

## Verify

Read-only on prod after the push, as the dev: `select pg_get_functiondef('public.can_reach_job_for_test_report(uuid)'::regprocedure) like '%primary_can_access_job(j.id)%'` reads true. The SQL bed `npm run test:pg:primary-test-papers` (`supabase/tests/primary_test_papers/20_scenario.sql`) reads the gate, the table and the bucket as a primary on their own job, a primary on nothing, the assistant, the master and a helper on the crew. CI runs it from `scripts/sql-beds.txt`.

**Applied** to prod by 2026-11-20: the dev seat's `check_migration_ledger` read 1,410 versions applied against 1,410 local files, this version among them (read in the docs pass after #8832); no new name in `database.ts`, since `can_reach_job_for_test_report` is replaced under its own name.
