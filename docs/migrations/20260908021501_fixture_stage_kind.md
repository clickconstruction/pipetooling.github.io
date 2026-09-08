# 20260908021501_fixture_stage_kind.sql (2026-09-08, v2.3083)

Stage Plan PR 1 ([`to-dos/stage-plan/`](../../to-dos/stage-plan/README.md)): the line item is the stage.

- **`jobs_ledger_fixtures.stage_kind`** (text, default `'any'`, check `order` / `any` / NULL) — `order` is a numbered stage that waits for the one above it to pass inspection and becomes a draw when it passes; `any` has its own dates and bills when its work is done (the default for a hand-added line item and for every change order); NULL is a plain line item, not a stage, riding the final draw.
- **`jobs_ledger_fixtures.shared_with_gc`** (boolean, default false) — the eye: this row shows on the GC portal's stage sequence. The job-level `jobs_ledger.gc_shares_stage_dates` switch stays the master.
- **Backfill**: every existing line item becomes `any` (owner decision 2026-09-07 — no job is put in order by the migration); a line item whose `job_stage_windows` row was `offered_to_gc` is marked shared.

No new table, so no read-only fence appliers; no RLS change (the columns ride on the table's policies).

Apply order: **push first, then the client that reads and writes the columns (PR 2)** — the client only selects them once they exist. Until PR 2 lands, the Job form's save (delete + reinsert of the job's fixtures) resets both columns to their defaults on every save; nothing reads `shared_with_gc` before PR 4, and the PR that starts reading it re-runs the backfill from `offered_to_gc`.
