# 20261119160000_self_salary_clock_state_week.sql (2026-11-19, v2.7948)

`self_salary_clock_state()` hands the caller their own set week as a fourth column, `salaried_week_hours numeric[]`. It follows [`20261118160000_salaried_week_hours`](./20261118160000_salaried_week_hours.md), which made the week, and [`20261118190000_salaried_week_in_cost_functions`](./20261118190000_salaried_week_in_cost_functions.md), which put it in the cost functions and in `list_people_pay_flags`.

## Why

My Time's *Your hours* told a salaried person *Salaried: the schedule is 40 h a week*, whatever their week. The block reads the person's own rows, and a helper cannot read their own pay row or the pay flags. The dashboard already runs this probe once to learn whether the person is salaried. With the week on the same row, the block reads the person's own week, at no extra round trip.

## What changes

- The function returns `is_salary`, `record_hours_but_salary`, `has_template` and now `salaried_week_hours`, in that order.
- The week is found the way the two flags are: the pay row by the caller's roster person first, then by the name match. A caller with no pay row reads the default week, `{0,8,8,8,8,8,0}`.
- The week is hours, never pay, and only ever the caller's own.

A function's returned columns cannot be changed in place. It is dropped and made again inside this migration's one transaction, with the body of [`20260817012837_self_salary_clock_state_rpc`](../../supabase/migrations/20260817012837_self_salary_clock_state_rpc.sql) kept line for line and the new column after it. Its comment and grants are restated as they were: `anon` revoked, `authenticated` and `service_role` granted.

## Who reads it

- `fetchSelfSalaryClockState` (`src/lib/selfSalaryClockState.ts`), from the Dashboard and from the Clock In button. It reads the week through a row type of its own, so a server without the column reads the default week. The old client ignores the column.
- The three quick-add functions (`20260921042405`, `20260921174057`, `20260921181500`) read `is_salary` and `record_hours_but_salary` by name, so a column more changes nothing for them.

No order is needed between this push and the client deploy: either one alone reads as before.

## Test

The salaried-week bed (`npm run test:pg:salaried-week`) applies the migration twice more and runs `supabase/tests/salaried_week/30_self_clock_state.sql`. A helper whose roster person carries their login reads their 6-hour week. A person found by the name match reads the default week. A caller with no pay row reads the default week, not salaried. The columns are in order and a signed-in person may run it.

## Applied

2026-11-19 (21:13 UTC), two minutes after the merge, by `scripts/db-push.sh` from a clean checkout at main's tip (`8b9a2e8a0c`, which carries the merge), after the drift check listed this file alone as pending. The drift check after it read every file applied. The Pages deploy of that tip began its build at 21:14 UTC, after the push.

## Verified on prod

As the dev, through the dev seat's `call_read`: `self_salary_clock_state()` returned its four columns, the last one `salaried_week_hours` at `{0,8,8,8,8,8,0}`. The dev is not salaried, so that is the default week.
