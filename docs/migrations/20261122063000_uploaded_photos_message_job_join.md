# 20261122063000_uploaded_photos_message_job_join.sql (2026-11-22, Documents → Photos reads again on All and on Texts & email, v2.8301)

Documents → Photos answered *The photos did not read: canceling statement due to statement timeout* on **All**, its first screen, and on **Texts & email**. The other chips read. Found on the live walk of punch list #306 PR 9, and older than that PR: the gateway's log shows the same read failing on 2026-11-17 and 2026-11-18.

- **The cause was one join in the view's `message` branch.** A text's picture finds its job with `LEFT JOIN jobs_ledger j ON j.id = COALESCE(m.jobs_ledger_id, gp.billing_job_id)`: the line's own job, or the billing job of the line's project. Postgres uses a join clause as an index condition on a table with row policies only when it can prove the clause leaks nothing, and it does not prove that of a `COALESCE`. So the job was not found by its key. Every job was walked under `jobs_ledger`'s policies, once per picture.
- **What it cost, read on prod on 2026-11-22.** 111 pictures at about 170 ms a walk. The `message` branch alone ran 14 seconds as a dev, and the whole list 29 seconds as an assistant, against `authenticated`'s 8 second limit. The `bid` branch ran in 8 ms, `job` in 3 ms and `box` in 330 ms.
- **The join is now a `CASE`**, which says the same thing and which Postgres does trust: `j.id = CASE WHEN m.jobs_ledger_id IS NOT NULL THEN m.jobs_ledger_id ELSE gp.billing_job_id END`. The job is found by `jobs_ledger_pkey`.
- **Nothing else changes.** The other six branches, the thirty columns and their order, `security_invoker`, the comment and the grants are as `20261121222237` wrote them. The `job_id` column still reads `COALESCE(m.jobs_ledger_id, gp.billing_job_id)`: a `COALESCE` in the select list costs nothing.

## Measured before it was written

All on prod, in a read-only transaction that set the caller's claims and role and then rolled back, with this file's `SELECT` in place of the view.

- **The same rows.** The old and the new `message` branch each hand back 111 rows, and `EXCEPT ALL` either way is empty.
- **The branch:** 14,125 ms before, 31 ms after, as a dev.
- **The whole list, newest 100:** 365 ms as a dev, 407 ms as an assistant, 396 ms as a controller, 299 ms as an estimator, 357 ms as a master technician, 279 ms as a superintendent, 273 ms as a helper, 266 ms as a subcontractor and 133 ms as a primary.

## How the view's security holds

Unchanged. The view is `security_invoker`, restated in this file, so every table under it is read under the caller's own policies. The new join condition names the same two columns as the old one and returns the same job.

## The bed

The SQL bed `bid-photos` (`scripts/pgtest-bid-photos.sh`, `supabase/tests/bid_photos/20_scenario.sql`) applies this file twice, after the bid branch's. It asserts two things as the office: a text on a job names that job, and a text on a project names the project's billing job; and the plan finds the job by its key, read off `EXPLAIN` with sequential scans, hash joins and merge joins priced out. With the `COALESCE` back, that plan has no index condition and the bed fails.

**No table is made**, so the fence calls are not needed; nothing here writes. `CREATE OR REPLACE VIEW` with the same thirty columns in the same order, so the file is safe to run twice.

Apply order: either way round. The client reads the same columns from the old view and the new one, so nothing breaks before the push; the list keeps timing out until it. Push after the merge. No types regen and no dev-mcp catalog rebuild: the view's columns are unchanged.

**Applied** to prod on 2026-11-23 at 00:13 UTC with `supabase db push` from a checkout at `origin/main`, a minute after #9409 merged. The migration drift check then read 1,448 versions applied against 1,448 files. Read back the same minute: the ledger lists this version, and the view's join reads `j.id = CASE WHEN (m.jobs_ledger_id IS NOT NULL) THEN m.jobs_ledger_id ELSE gp.billing_job_id END`, with thirty columns, `security_invoker` and no `anon` select. The live view's newest hundred read in 367 ms as a dev and 403 ms as an assistant, and its `message` rows alone in 103 ms as an assistant. Walked on clicktooling.com the same hour, signed in as a dev: **All** drew a hundred rows and **Texts & email** a hundred, with no red line.

## Seen while here, not changed

Two other `security_invoker` views on prod join through a `COALESCE`: `agreements_on_file` (three joins) and `people_hours_recorded` (one). Neither was measured.
