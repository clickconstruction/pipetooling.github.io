# 20261118233000_combine_carries_job_held_trip.sql (2026-11-18, v2.7884)

The combine carries a trip its job holds.

A trip is kept on a development, or on a job that has no development (`trips.job_id`, `20261117234500_trips.sql`). The combine (`migrate_job_ledger_costs_and_delete`) deletes the source job once its rows are moved, and `trips.job_id` is `ON DELETE CASCADE`. So a trip the source job held by itself went with the job. Since [`20261118100000`](./20261118100000_trips_deleted.md) it was kept in `deleted_records_archive`, where only a dev could reach it.

No screen makes such a trip and prod held none on 2026-11-18. Only the dev seat files one. This closes the gap before one exists. It is the part [`20261118213000`](./20261118213000_combine_carries_trip_jobs.md) left as its own change.

## What it changes

Two functions restated. No table, column or index.

### `trips_take_number`, the trigger behind a trip's number

From [`20261118040000`](./20261118040000_trip_numbers.md). A trip's number stood through every update, whatever the update did. Now:

- **While the trip's home stands, so does the number.** The home is the development, or the job when the trip has no development. An update that names another number still leaves it as it was.
- **A trip that moves home takes a number at the new home.** It keeps the one it has when the new home has never handed that number out, and the new home's counter moves up to it. Otherwise it takes the new home's next number.

So *Trip 2* stays *Trip 2* when it can. A number is still never given to two trips of one home. A number a deleted trip may ask back on **Put back** is never handed to a trip moving in. The home it left keeps its counter, so the number it had there is not given out again.

The insert path is unchanged.

### `migrate_job_ledger_costs_and_delete`, the combine

From its newest body (`20261118213000`), with one variable and one block added ahead of the trip links:

1. Each trip the source job holds by itself goes to the kept job's home, one at a time in the order of their numbers.
   - The kept job is in a development: the trip becomes the development's (`development_id` set, `job_id` cleared) and names the kept job in `trip_jobs`.
   - The kept job is in no development: the trip's `job_id` becomes the kept job.
2. A development's trip that also carries the source job in its own `job_id` column carries the kept job instead. It keeps its site and its number.

Nothing else in the body changes. The file was generated from the newest body by a script, and a diff of the two bodies shows the variable, the block and one shortened comment. The carry it calls (`on_site_carry_job`) is not restated. `CREATE OR REPLACE` keeps each function's owner and grants.

## What needed no change

- A trip's people and the jobs it names go with the trip's row: nothing deletes them.
- A trip's line on a job (`jobs_ledger_fixtures.trip_id`) moves with the job's lines and keeps its trip.
- Nothing is written to `deleted_records_archive`, since no trip is deleted.

## Not moved

- A *Not a trip* answer kept on the source job alone (`trip_dismissals.job_id`) still goes with its job. The Looks like a trip finder runs on a development, so no screen reads such an answer.
- The words on a line a trip was put on. A line named *Trip 1* keeps that name when its trip takes another number at the new home. The line's tie is the trip's id, not its number.

## Locks

No DDL beyond the two `CREATE OR REPLACE`. The file starts with `SET lock_timeout = '3s'`.

## Tests

`supabase/tests/combine_rows/20_scenario.sql` (`npm run test:pg:combine-rows`):

- on the first combine, two trips the source held by itself are the target's, each with the target's next number in their own order, with their people, and nothing kept as deleted;
- on the second, a development's trip that carried the source job carries the target, on its site, under its number;
- on a third, a source's own trip goes to the target's development, names the target as the job its work goes on, and takes the development's next number.

`supabase/tests/trips/40_numbers.sql` (`npm run test:pg:trips`), step 9: a trip moved to a home that has handed out its number takes the next one, a trip moved to a home that never did keeps it and the home counts on from it, a trip that stays home keeps its number whatever else changes, and the home it left keeps its count.

Both beds apply this file a second time, which must change nothing.

## Applied

2026-11-19 (06:05 UTC), by `scripts/db-push.sh` from a clean checkout at the PR's merge commit, after a dry run that listed this file alone. The drift check after it read every file applied.

## Verified on prod

A read of both functions' own text on prod found the combine's new block and the trigger's rule for a trip that moves home. No combine was run: prod held no trip that day, and a combine is not undone. The two beds hold the behaviour.
