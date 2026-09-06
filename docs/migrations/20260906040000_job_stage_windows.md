# 20260906040000_job_stage_windows.sql (2026-09-06, v2.2927)

Stages get a window (PR 1 of the three-party scheduling plan, artifact 3a540149).

- **New table `job_stage_windows`** — one row per (job, line item): `window_start` / `window_end` (dates), `window_by` (`office` now; `gc` when a GC ask is accepted in a later PR), `note`, `created_by`, timestamps. `UNIQUE (job_id, fixture_id)`; `window_end >= window_start`; cascades with the job and the line item.
- **`step_commitments.stage_window_id`** (nullable FK, `ON DELETE SET NULL`) — the stage a work order fulfils. Partial index on non-null values.
- **RLS**: select for dev / master / assistant / controller / estimator / superintendent; insert / update / delete for the office set (dev / master / assistant / controller / estimator). Mirrors `jobs_ledger_fixtures` and `step_commitments`. Both read-only fence appliers run.

Apply order: **client first, then push.** The Subs → Work view tolerates the table being absent (it logs and paints the board without stages), so a client that lands before the migration only lacks the stage rows; a migration that lands before the client changes nothing visible.
