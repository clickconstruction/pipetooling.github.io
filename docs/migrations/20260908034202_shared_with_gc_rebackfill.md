# 20260908034202_shared_with_gc_rebackfill.sql (2026-09-08, v2.3128)

Stage Plan PR 4 ([`to-dos/stage-plan/`](../../to-dos/stage-plan/README.md)). Re-runs the v2.3083 backfill: a line item whose `job_stage_windows` row was `offered_to_gc` is marked `shared_with_gc`. Between the v2.3083 push and the v2.3100 client (the first to carry the column through the Job form's delete + reinsert save) a save reset the column on any job edited in that window; this PR is the first to *read* the eye, so it runs the backfill again. Data only, idempotent, no DDL.

Apply order: any time after merge (`bash scripts/db-push.sh`); the client works either way — the migration only restores eyes that a save in that window turned off.
