# 20260905070000_crew_reviews_three_bars

**Team feedback on the three bars (v2.2824)** — crew ratings become `team_member_reviews` rows tagged `source = 'crew'`, anonymous to everyone but dev.

## What it does

- `team_member_reviews.source text NOT NULL DEFAULT 'office'` + check (`office` | `crew`); the 3-column unique key (subject, reviewer, month) is dropped by catalog lookup and replaced by `team_member_reviews_subject_reviewer_month_source_key` (subject, reviewer, month, source). Index on (source, review_month).
- RLS on `team_member_reviews`: SELECT = office rows for `user_has_prospects_staff_access()` OR `is_dev()` OR own rows; INSERT/UPDATE WITH CHECK = own reviewer id AND (office + staff access, or crew about someone else); DELETE = own or dev.
- `crew_review_teammates(p_lookback_days int = 14, p_extra_user_ids uuid[] = '{}')` — SECURITY DEFINER, STABLE: other active `users` sharing approved `clock_sessions` (same `job_ledger_id`, same `work_date`) with the caller in the lookback; `days_together`, up to 3 `jobs` labels (same format as `list_team_member_recent_jobs`); extra ids always returned. `authenticated` only.
- `crew_review_aggregates()` — SECURITY DEFINER, STABLE: per (subject, month) `ROUND(AVG(...),1)` of the three dimensions + `rater_count` over `source='crew'`; caller needs staff access or dev; `HAVING rater_count >= 2 OR is_dev()`. `authenticated` only.
- `team_feedback_submissions.open_anything text`.
- `team_feedback_settings`: `crew_lookback_days int NOT NULL DEFAULT 14`, `open_prompts jsonb`, `questions_retired_at timestamptz` (set to now() for row 1).
- No CREATE TABLE, so no read-only appliers needed. Idempotent throughout.

## Order

Push with (or right after) the v2.2824 client: the client upserts with `onConflict` including `source` and calls the two RPCs. Team feedback is switched off, so an old client in the gap only affects the office Rate deck's upsert — which fails loudly on the missing conflict target until the client reloads. Push promptly.

## Rollback

Drop the two functions and the three settings columns; drop the 4-column unique key and re-add `UNIQUE (subject_user_id, reviewer_user_id, review_month)` only after deleting `source = 'crew'` rows; restore the three original policies from `20260722252000_team_member_reviews.sql`; drop `source` and `open_anything`.
