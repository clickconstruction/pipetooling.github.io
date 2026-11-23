# 20261123075925_working_hours_door.sql (2026-11-23, v2.8345)

`person_available_hours` can hold a person's working hours, and one function writes them. The first migration of punch list #429.

## Why

A person's week was described in three places that nothing held together: the seven hour numbers on pay, the workday template that always makes 8 hours, and the week a person says they can work. Only the last has a start and an end for each day, and neither pay nor the clock reads it. A helper who works 6:00 AM to 12:00 PM could not be given those hours anywhere.

## What changes

- **`kind text NOT NULL DEFAULT 'answer'`**, checked to `answer` or `set`. Adding it rewrites nothing: every row reads `answer`.
- **`working_week_ok(jsonb) → boolean`**, immutable. A week is seven arrays, Sunday first, each of at most two `[start, end]` pairs of whole minutes on a quarter hour, inside the day, in order with a break between, and no more than 960 minutes in all. Every way out is true or false, never null and never an error.
- **`person_available_hours_set_week_check`**: `kind <> 'set' OR days IS NULL OR working_week_ok(days)`. An answer keeps its loose shape.
- **`hours_per_week`** goes from `numeric(4,1)` to `numeric(5,2)`, so a week can add up in quarter hours. This rewrites the table, which holds a handful of rows.
- **The insert policy** `person_available_hours_write` is made again with `kind = 'answer'` in front of what it had.
- **`working_hours_on(uuid, date) → jsonb`**, security invoker: the weekday's ranges from the set week in force, `[]` for a day off, null with no working hours. The week in force is the newest save among the rows that have started, so hours saved for next week and then changed for this week hold as changed, next week too.
- **`set_working_hours(uuid, jsonb, date, text, boolean) → jsonb`**, security definer.

## What the door refuses

- A caller who is not a dev or the controller (`is_dev()`, `is_controller()`), with SQLSTATE 42501.
- A person with no account, or an archived one.
- A start that is not this week's Sunday or next week's, by `app_today()`.
- A week `working_week_ok` refuses, or one over 80 hours.
- For a salaried person whose day changes its length: a start next week, since pay carries no date, and a missing reason.

## What it writes

One row, `kind = 'set'`, stamped with `auth.uid()` and the clock's own time, so two saves in one transaction still read newest last. When a salaried person's day lengths change, it also updates `people_pay_config.salaried_week_hours` and adds a `pay_admin_events` line under the action `set_pay_config`, with the before and after rows, the reason and `by: set_working_hours`. The pay row is found by the person's roster row first and by name after, as `self_salary_clock_state` finds it.

With `p_dry_run` it writes nothing and returns the same answer: the hours, the week before, and whether pay would move with its before and after numbers.

## Who reads it

Nobody yet. The readers arrive with the kernel, and the screen that calls the door after that.

## Order

Additive and idempotent: a second run finds the column, the two checks and the widened type and adds nothing. The old client never names `kind`, so its answers save as before. Push any time after the merge.

## Test

`npm run test:pg:working-hours` applies every migration, runs this one twice more, and plays `supabase/tests/working_hours/10_door.sql`.
