# 20261010080000_gc_general_conditions_job.sql

GC mode, Owner Billing's O11b-1: the Pipeline job a GC project's general conditions are spent on (v2.5151). The plan is `to-dos/gc-mode/mockups/owner-billing-o11.md` on branch `spike/gc-mode`, whose SQL block is this file byte for byte but for the version. O11b-2 (the picker on Our number, the read, the margin's general conditions, Closeout's line) follows once the types regenerate.

**Why:** Money's margin counts general conditions at their budget, so a superintendent kept three extra weeks costs us nothing on the screen. They are really spent on the Pipeline: the superintendent's time, the trailer, temporary power, the dumpsters. Naming the Pipeline job they land on lets the margin read that spend the Costs tab's own way (O11b-2), at their budget until it passes it and at their real cost once the job closes (the lead approved the plan 2026-10-10 with its six defaults).

## What it does

`gc_project_money.general_conditions_job_id`: a nullable `uuid`, a foreign key to `jobs_ledger(id)`, `ON DELETE SET NULL`. Null: general conditions count at their budget, as before. No policy changes: `gc_project_money_team` (`gc_money_team()`: dev, the leaders, the controller) already reads and writes the row, and the read-only and twin fences already hold the table. No table is created, so no fence calls.

## The lock note

`ALTER TABLE … ADD COLUMN` with no default takes a brief lock on `gc_project_money`, a small table the GC page reads, and checks the foreign key against `jobs_ledger` (all null, so nothing to scan). `SET lock_timeout = '3s';` fails the push fast if either is busy.

## Verify after the push

Read only:
1. `SELECT data_type, is_nullable FROM information_schema.columns WHERE table_name = 'gc_project_money' AND column_name = 'general_conditions_job_id'` gives `uuid`, `YES`.
2. Its key: `SELECT confrelid::regclass, confdeltype FROM pg_constraint WHERE conrelid = 'public.gc_project_money'::regclass AND contype = 'f' AND conkey = ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid = 'public.gc_project_money'::regclass AND attname = 'general_conditions_job_id')]` gives `jobs_ledger`, `n`.
3. `SELECT count(*) FROM public.gc_project_money WHERE general_conditions_job_id IS NOT NULL` gives 0.

## The SQL beds

`scripts/pgtest-gc-owner-billing.sh` re-applies this migration right after it runs and plays `94_gc_job.sql`, 12 checks:
- the column, its key and a new project's number naming no job;
- the controller names a job, reads it back and clears it, and our number keeps its three inputs;
- the owner and a dev name one;
- an estimator reaches no row and reads no number;
- the owner in training mode and a controller who is a digital twin are stopped;
- deleting the job lets go of it, and our number stays whole.

It ran on a local Docker copy of the whole schema with every migration applied; all twelve Owner Billing files passed. Four mutants were each caught, both with the column check and with it taken out: the key `ON DELETE CASCADE` (deleting the job dropped our number), the column `NOT NULL` (a new project's number could not be made), a policy opening the table to the office team (the estimator named a job), and the column on `gc_projects` (our number had no column to name).

## Status

Cut 2026-10-10 by Helper 5 (the Owner Billing lane). The lead pushes it once the PR merges; types regenerate after, and O11b-2 cuts on them.
