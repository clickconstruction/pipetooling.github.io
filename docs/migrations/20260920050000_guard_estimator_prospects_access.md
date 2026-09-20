# 20260920050000_guard_estimator_prospects_access.sql (2026-09-19, v2.3628)

An estimator can no longer grant themselves Prospects ([`docs/recent-features/v2.3628.md`](../recent-features/v2.3628.md)).

- **`users_guard_privileged_columns()`** gains an eighth rule — only a dev may change `users.estimator_prospects_access` — and the trigger fires on that column too (`BEFORE UPDATE OF role, read_only, archived_at, is_sample, needs_supervision, team_prospects_access, trial_prospect_id, estimator_prospects_access`). The column feeds `user_has_prospects_staff_access()`, and "Users can update own profile" is row-scoped, so without the rule an estimator could PATCH their own row to `true` and read and write the Prospects tables.
- The function body is `20260920033000_helper_trial.sql`'s, verbatim, plus the one check (diffed mechanically before commit). **A later rewrite of this function copies from this file.**
- No table, column, policy or grant change. Service-role writes still pass (`auth.uid()` IS NULL).

**Requires `20260920033000_helper_trial.sql`** — the body reads `users.trial_prospect_id`, and `CREATE TRIGGER … UPDATE OF trial_prospect_id` fails (whole migration rolls back) if that column is missing. `supabase db push` applies them in filename order, so pushing both together is fine.

Additive and idempotent. Apply order: any time after merge; no client change depends on it — the only writer of the flag (Active accounts → Edit) is dev-only and keeps working. Check after the push, signed in as an estimator: `PATCH /rest/v1/users?id=eq.<own id>` with `{"estimator_prospects_access": true}` answers `P0001 Only a dev can change an estimator's Prospects access`; the same PATCH with the value unchanged (what the dev Edit form sends for every estimator save) passes.
