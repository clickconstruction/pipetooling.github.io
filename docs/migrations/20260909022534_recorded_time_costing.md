# 20260909022534_recorded_time_costing.sql (2026-09-08, v2.3179)

Job costing counts **recorded time** — every clock session that is not rejected or revoked, approved *or* awaiting approval — instead of approved time only. Payroll (`people_hours`, pay stubs, Draft Payroll, the overhead pool, the week close) is untouched and keeps reading approved time. Owner decision 2026-09-08 after the J1007 / Malachi question (see `docs/recent-features/v2.3179.md`).

## What it creates / replaces

- **View `public.people_hours_recorded`** (`security_invoker = true`, SELECT granted to `authenticated`): `people_hours` (approved + manual) `FULL OUTER JOIN` the per-(person, day) sum of closed-unapproved sessions. Columns `person_name, person_id, work_date, hours, approved_hours, pending_hours`. `person_id` falls back to `people_pay_config.person_id` for days that exist only as pending sessions.
- **`sync_crew_jobs_from_clock` / `sync_crew_bids_from_clock`** — same bodies as `20260903153903` (shared denominator) with the predicate `approved_at IS NOT NULL AND clocked_out_at IS NOT NULL` replaced by `rejected_at IS NULL AND revoked_at IS NULL`; an **open** session counts to `now()` (floored at one minute) so a fresh clock-in already lands its job in the day split.
- **Trigger `clock_sessions_sync_crew_recorded_tr`** (`AFTER INSERT OR DELETE OR UPDATE OF clocked_in_at, clocked_out_at, approved_at, rejected_at, revoked_at, job_ledger_id, bid_id, work_date, user_id`) → `clock_sessions_sync_crew_recorded_tr()` (**SECURITY DEFINER** — `people_crew_jobs` INSERT is pay-access-only under RLS, and a helper's own clock-in must never fail on it). Resyncs the new person/day and, on a day/person move or a delete, the old one. A no-op guard skips UPDATEs where none of those columns actually changed. **Drops** the old `clock_sessions_sync_crew_assignments_tr` (job/bid change on an approved session only) — superseded.
- **`get_man_hours_by_job()`** — the Pipeline board's man-hours RPC — joins `people_hours_recorded` instead of `people_hours` (body otherwise verbatim from `20260714120000`).
- **Backfill `DO` block**: resyncs every person-day in the last 90 days that holds a closed unapproved job/bid session (14 punches / ~61 h when written), so the pending backlog shows on its jobs immediately.

## Apply order

Either order is safe. The client (`src/utils/teamLabor.ts`) probes the view once per session and falls back to `people_hours` when it is missing, so a client deployed ahead of the push shows the old approved-only figures rather than an empty Labor column. After the push, regenerate types (`npm run gen-types:linked`) so the `as 'people_hours'` casts in `teamLabor.ts` can go.

## Verify after push

```sql
select count(*) from public.people_hours_recorded where pending_hours > 0;   -- ≈ the pending person-days
select tgname from pg_trigger where tgrelid = 'public.clock_sessions'::regclass and tgname like '%crew%';  -- only the _recorded_ trigger
```

Then open a job with a closed-unapproved punch: the Job tab's Team labor row and Job Summary's Labor column include it, with "includes N h awaiting approval" on the row.

## Rollback thinking

Reverse migration: recreate the two sync functions and `get_man_hours_by_job` from `20260903153903` / `20260714120000`, drop the new trigger and recreate `clock_sessions_sync_crew_assignments_tr` from the baseline, drop the view, then resync the affected person-days (the backfill loop with `approved_at IS NOT NULL`). Nothing here writes `people_hours` or `clock_sessions`.
