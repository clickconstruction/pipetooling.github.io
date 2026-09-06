# 20260906050000_step_commitment_picks.sql (2026-09-06, v2.2928)

Subs pick their start inside the window (PR 2 of the three-party scheduling plan, artifact 3a540149).

- **`step_commitments.work_days`** (integer 1–120, nullable) — working days the office expects the stage to take; a start pick implies the end.
- **`step_commitments.picked_start` / `picked_end`** (dates, `picked_end >= picked_start`), **`picked_at`**, **`picked_by`** (`sub` | `office`) — the answer to the offered span. `proposed_start/end` keep the span the office typed; the stage window (`stage_window_id`) wins over it as the span to pick inside.
- Partial index on `picked_start`.

No RLS change: the columns ride on the order's existing policies. Written only by the `submit-sub-portal` function (service role) on `accept_offer` and `pick_dates`; mirrored onto `people_labor_jobs.job_date` and, for step-anchored orders, `project_workflow_steps.scheduled_start_date/end_date`.

Apply order: **client first, then push** (the portal renders without the fields; a pick posted before the push fails with a plain error and the sub can retry).
