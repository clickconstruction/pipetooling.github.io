# 20261006150000_legal_matter_lifecycle.sql (2026-10-05, v2.4645)

Punch list #85, item 16, PR 2: a legal matter's lifecycle.

- **Stages**: the stage CHECK is replaced by `legal_matters_stage_check_v2`, adding `post_judgment`, `payment_plan`, `uncollectible`, `dismissed` (added `NOT VALID`, then validated). The old inline CHECK (`legal_matters_stage_check`) is dropped by a lookup over `pg_constraint`.
- **Pull-back reason**: `pulled_at timestamptz`, `pulled_reason text NOT NULL DEFAULT ''`. `legal_pull_back` now refuses an empty reason, stamps both, and only pulls an open matter (`closed_at IS NULL`). `legal_mark_attorney_ready` clears them on a new release (its body is otherwise unchanged).
- **`legal_close_matter`** closes `uncollectible` and `dismissed` as well as `settled` and `written_down`.
- **`legal_set_stage(p_matter_id, p_stage, p_entry_id)`** — office roles: accept a firm step that would have moved the stage backward (v2.4631 records it with `meta.proposed`); moves the stage, acknowledges the proposal and writes a step entry.
- **`legal_matters_notify_stage`** reads every portal stage, and the `pulled` payload carries `reason`.

**Apply order:** the client that knows the new stages shipped first (v2.4631). Push this after the v2.4645 PR merges (its desk requires the reason; the old desk's optional note would be refused with a clear message). Then deploy `submit-legal-portal`, `legal-portal`, `legal-notify-dispatch`.
