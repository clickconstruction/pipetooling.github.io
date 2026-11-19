# 20261118213000_combine_carries_trip_jobs.sql (2026-11-18, v2.7861)

The combine carries a trip's job link.

A trip names the jobs its work goes on in `trip_jobs` (`20261117234500_trips.sql`). The combine (`migrate_job_ledger_costs_and_delete`) moves a job's rows to the job that is kept and then deletes the source job. `trip_jobs.job_id` is `ON DELETE CASCADE`, so the link went with that delete. After a combine the trip no longer said which job its work was on, the Job window's *Trips on this job* line left the kept job, and nothing recorded the loss.

## What it changes

One function restated: `migrate_job_ledger_costs_and_delete(p_from, p_to, p_allow_billed)`, from its newest body ([`20261109160000`](./20261109160000_on_site_move_job.md)), with one block added before the source job is deleted:

1. Each trip that names the source job gets a link to the target. A trip that already names the target keeps its one link (`ON CONFLICT DO NOTHING`).
2. The links to the source job are deleted. The trip is still there, so nothing of this is kept as a deleted trip's ([`20261118100000`](./20261118100000_trips_deleted.md)).

Nothing else in the body changes. The file was generated from the newest body by a script, and a diff of the two bodies shows the block alone. The carry it calls (`on_site_carry_job`) is not restated. `CREATE OR REPLACE` keeps the function's owner and grants.

## What needed no change

A trip's line on a job (`jobs_ledger_fixtures.trip_id`). Lines move by `job_id` and keep their trip, as [`20261118060000`](./20261118060000_trip_bill_line.md) says.

## Not moved

A trip the source job holds by itself (`trips.job_id`, for a job with no development) still goes with its job. No screen makes one, and prod held none on 2026-11-18. It is kept in `deleted_records_archive`. Moving it means a number in the target's own run of trip numbers, which is its own change.

## Locks

No DDL beyond the `CREATE OR REPLACE`. The file starts with `SET lock_timeout = '3s'`.

## Tests

`supabase/tests/combine_rows/20_scenario.sql` (`npm run test:pg:combine-rows`), on the second combine:

- a trip that named the source job alone names the target;
- a trip that named both jobs keeps one link;
- both trips are still there, and no link was kept as a deleted trip's.

The bed applies this file a second time, which must change nothing.

## Applied

Not yet. `supabase db push` after the merge.
