# 20261123083429_working_hours_clock.sql (2026-11-23, v2.8356)

`salary_sync_one_user_clock_sessions` takes a day's start and end from the person's working hours. It follows [`20261123075925_working_hours_door`](./20261123075925_working_hours_door.md), which made them.

## Why

The function made every salaried day from the workday template: one start and a fixed 8 hours, or two blocks that add to 8. A person on a shorter set week who had a template got 8-hour sessions, so the clock read two hours more a day than pay did.

## What changes

The body is the one in [`20261014200000_salary_sync_continuous_open_punch_guard`](../../supabase/migrations/20261014200000_salary_sync_continuous_open_punch_guard.sql), copied by a script, with three changes and nothing else:

1. After the template and the day's override are read, the day's ranges are read from `person_available_hours`: the newest `set` row with `effective_from` on or before the day and `created_at` before the day began in the template's zone. A meaningful override skips this read.
2. An empty list of ranges deletes the day's unapproved `salary_schedule` rows and returns, as an excluded weekend does. The template's `exclude_weekends` test runs only when there is no set week.
3. With ranges, the mode is `continuous` for one and `split` for two, and the start and the length of each slot come from the range. Without them the template's and the override's values are used as before.

Everything after that point, the continuous branch, the split branch, the open-punch guard and the closes, is unchanged.

Two checks on `salary_work_schedule_day_overrides` are dropped, `salary_override_continuous_duration` and `salary_override_split_sum`. They held one day's move to 480 minutes. The per-column checks stay: a positive multiple of 15.

## Why the day must have begun

A row saved at 9:00 AM for this week would otherwise change today under a session that opened at 6:00. The start of that session cannot be moved, and a mode change from one range to two would leave the open row with nothing to close it. So today keeps the week it began on, and the new hours hold from tomorrow.

## Order

Deploy the client that reads the same rule first (`workingDayForClock`). The push can follow at any time. Until someone has both a template and working hours, the function answers as it did.

## Test

`npm run test:pg:working-hours` runs this migration twice more and plays `supabase/tests/working_hours/30_clock.sql`. The bed `salary-sync-open-punch` still plays the body it was written for.
