# 20260907170000 — shadow teacher attribution + plans-readable-by-robots probe

v2.3080. Additive and idempotent (`ADD COLUMN IF NOT EXISTS`, guarded `UPDATE`s).

- `users.calibration_standard boolean NOT NULL DEFAULT false` — the estimator(s) whose sent numbers are the twin program's calibration standard. Sets Wendi (`cda62e3a-…`) true; nobody else.
- `twin_shadow_runs.teacher_user_id uuid`, `teacher_name text` — whose number a shadow scored against; `score_shadows` stamps it, and already-scored runs are backfilled from the reference bid (`estimator_id` → `bid_date_sent_attested_by` → `created_by`).
- `bids.plans_robot_readable boolean`, `plans_robot_probed_at timestamptz`, `plans_robot_probe_note text` — the plan-fetch probe's verdict on whether the Drive intake service account can read the file behind `plans_link`. NULL = never probed.
- `list_shadow_runs()` is **dropped and recreated** (the return type grows by `teacher_name text, teacher_standard boolean`) inside the same transaction, grants re-applied unchanged. The seal on money columns is untouched; the teacher shown before scoring is the reference's assigned estimator.

Deploy after the client (the kernels tolerate missing columns), before redeploying `plan-fetch` and `twin-mcp` (which write the new columns).
