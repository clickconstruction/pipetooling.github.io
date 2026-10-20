# 20261014200000_salary_sync_continuous_open_punch_guard.sql (2026-10-13, v2.5509)

The owner's case of 2026-10-13 ([`docs/recent-features/v2.5509.md`](../recent-features/v2.5509.md)): a salaried person on a continuous 8:00 day clocked in by hand at 7:10, the sync opened the day's row at 8:00 beside it, and the team strip read 16.75 h with Overlap. Push any time after merge; the client does not change.

## What it does

- **`salary_sync_one_user_clock_sessions(uuid, date, timestamptz)`**, rewritten from its newest body (`20260922001000`) with one change in the **continuous** branch: when no canonical NULL-index `salary_schedule` row exists, the insert (open inside the window, closed at catch-up) is skipped while any of the user's non-rejected, non-revoked sessions overlaps `[t_start, t_end)` in half-open form, `clocked_in_at < t_end AND (clocked_out_at IS NULL OR t_start < clocked_out_at)`, on the day by `work_date` or by the clock-in's civil date in the template's zone. The indexed-children guard stays. The split branch is untouched; it has had the same test since `20270403180000`.
- The function's comment names the change.

Idempotent (`CREATE OR REPLACE` + `COMMENT`); no table, so no read-only block re-apply. `SECURITY DEFINER`, grants unchanged.

## Checked before the push

The SQL bed `salary-sync-open-punch` (`npm run test:pg:salary-sync-open-punch`) runs every migration, then this one a second time, then the scenario: an open early punch at the 8:03, noon and 16:30 ticks (one row, the punch, still open); a punch closed at 9:30 (no row inside the window, none at catch-up); a punch ending exactly at 8:00 (the day opens and closes as before); a plain day; a late tick's closed catch-up row; an indexed split child still blocking the canonical row; a weekend adding nothing; the function a definer whose comment names v2.5509. Docker is not on the dev's Mac, so the bed first runs in CI.

## Verify after the push

```sql
-- The body carries the guard and the comment names it.
SELECT obj_description('public.salary_sync_one_user_clock_sessions(uuid, date, timestamptz)'::regprocedure, 'pg_proc');
SELECT prosrc LIKE '%t_start < sess.clocked_out_at%' FROM pg_proc
WHERE oid = 'public.salary_sync_one_user_clock_sessions(uuid, date, timestamptz)'::regprocedure;
-- From the next morning's ticks on: nobody with two open rows on the day.
SELECT user_id, count(*) FROM public.clock_sessions
WHERE work_date = (now() AT TIME ZONE 'America/Chicago')::date AND clocked_out_at IS NULL
  AND rejected_at IS NULL AND revoked_at IS NULL
GROUP BY user_id HAVING count(*) > 1;
```

Expect the comment to end with the v2.5509 sentence, `true`, and no rows from the third query once the next day's ticks have run. Days doubled before the push stay until someone fixes them in the day editor.

## Rolling back

Re-run `20260922001000_roster_people_view.sql`'s `CREATE OR REPLACE FUNCTION` for this function (its body is the previous one) and its `COMMENT`. Nothing else to undo.
