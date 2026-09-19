# 20260919161056_supervisor_reviews.sql (2026-09-19, v2.3614)

Supervision, PR 4 — Rate my crew ([`docs/recent-features/v2.3614.md`](../recent-features/v2.3614.md)).

- **`team_member_reviews.source` gains `'supervisor'`** (the CHECK is re-created as `office | crew | supervisor`). A supervisor's monthly ratings are ordinary review rows — one per (subject, reviewer, month, source), the three sliders + comments — by name.
- **`supervised_days_with(p_subject, p_month) → integer`** (SECURITY DEFINER, STABLE): how many job-days in the month the caller shared with the subject while able to run a job (a master, or a helper / sub with `needs_supervision` off), from `job_schedule_blocks` and `clock_sessions`. 0 for anyone who cannot run a job.
- **Policies**: SELECT admits `source IN ('office','supervisor')` to prospects staff (dev and the reviewer's own rows as before); INSERT / UPDATE gain the branch `source = 'supervisor' AND subject <> reviewer AND supervised_days_with(subject, review_month) >= 1` — the write is gated on the schedule and the clock, not on a list. Crew rows unchanged.
- **`get_supervisor_review_deck(p_month) → jsonb`** (SECURITY DEFINER, STABLE): `supervisor`, `month`, `people` — everyone the caller supervised on **two or more** job-days that month (never themselves; archived accounts out), with `days`, the `jobs` (`"J258 · Oak St"`-style labels) and `reviewed` (a supervisor row exists for the month).

Additive and idempotent. Apply order: push while the PR is open (the deck calls the RPC with an `as never` cast until the types are regenerated), then `npm run gen-types:linked`.
