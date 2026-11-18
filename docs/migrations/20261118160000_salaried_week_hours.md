# 20261118160000_salaried_week_hours.sql (2026-11-18, v2.7826)

A salaried week can be the person's own shape. The owner asked on 2026-11-18, after a teammate on salary for a 30-hour week could only be entered as 8 hours a day at a lower wage, and then asked for different hours on different days. This is the database half. No screen reads or writes the column yet.

A salaried person was paid, costed and scheduled as a flat 8 hours on each weekday and nothing on a weekend. The 8 and the weekend were written into the payroll kernel, the cost readers, five functions and the workday template's checks. Entered as 8 hours at a lower wage, a 6-hour person's pay came out right, and the wage, the hours on a job and the end of the shift came out wrong. A short Friday, four ten-hour days or a Saturday could not be entered at all.

## The column, on `people_pay_config`

| Column | Type | What it holds |
|---|---|---|
| `salaried_week_hours` | `numeric(4,2)[]`, not null, default `{0,8,8,8,8,8,0}` | The paid hours of each day of this person's salaried week: seven numbers, Sunday first, 0 for a day off. A salaried person is paid and costed that day's hours at `hourly_wage`. It has no meaning on a row that is not salaried. |

Every row that exists reads 8 hours on the five weekdays, so nothing changes for anyone until a week is set.

One field holds the whole week, in place of a day length with a week added beside it later. Two fields could disagree.

| Week | Sunday to Saturday |
|---|---|
| The rule until now | 0, 8, 8, 8, 8, 8, 0 |
| 30 hours on five days | 0, 6, 6, 6, 6, 6, 0 |
| Four tens | 0, 10, 10, 10, 10, 0, 0 |
| A short Friday | 0, 8, 8, 8, 8, 4, 0 |
| A Saturday worker | 0, 0, 8, 8, 8, 8, 8 |

## The check: `people_pay_config_salaried_week_hours_check`

`public.salaried_week_hours_ok(salaried_week_hours)`. A week is one row of seven numbers starting at index 1, none missing, each from 0 to 16 in quarter hours. Quarter hours match the workday template's 15-minute step, so a day and its template can always agree.

The function wraps its answer in `coalesce(…, false)`. A check passes on null, and an empty array's dimensions are null, so without it an empty week would be taken.

A week of all zeros is allowed here. The card asks for at least one day.

The constraint is added by name inside a `DO` block that looks for it first, so a second run adds nothing.

## The rule: `salaried_hours_on(week, day)`

The one place SQL asks how many hours a salaried person is paid on a day: that weekday's number, Sunday being the first. A week that is missing reads as the old rule, 8 on a weekday and 0 on a weekend. The five functions that carry the 8 will call it, so the rule lives once.

Both functions are immutable, with an empty search path. Signed-in people and the service role may call them. Nobody signed out may.

## Who reads and writes it

Nothing changes. The policies on `people_pay_config` are by row, so whoever may change a wage may change the week, and nobody else gains anything. `set_pay_config` and `list_people_pay_flags` do not name the column yet.

## The bed

`supabase/tests/salaried_week/10_scenario.sql`, run by `scripts/pgtest-salaried-week.sh` with this migration applied twice more first. A new row's week, seven weeks the check takes, ten shapes it refuses (six days, eight days, an empty week, no week, a day missing, below zero, over sixteen, off the quarter hour, two rows, another starting index), each day of a week read through the rule, and who may call it.

## What comes next

1. The shared rule (`src/lib/salariedEffectiveHours.ts`, `src/lib/salariedPayrollDays.ts`), payroll and the Pay & schedule card read the column.
2. The cost readers and the five functions that carry the 8 (`get_man_hours_by_job`, `keep_job_baseline`, `list_project_board`, `superintendent_scores`, `get_weekly_money_movement_payload`) call `salaried_hours_on`, and `list_people_pay_flags` returns the week.
3. The card sets the week and the weekly pay, and the workday template takes each day's length from it. The template's two checks pin a continuous day to 480 minutes and a split day to a sum of 480.

## Order

Additive and idempotent. No `CREATE TABLE`, so no fence calls. The lock is an `ALTER TABLE` on a small table, under the 3 second timeout. A column added with a constant default does not rewrite the table. The push can come any time after the merge. **The client that follows must not merge before the push**: it names the column in the read of the pay row.
