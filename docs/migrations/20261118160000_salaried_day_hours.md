# 20261118160000_salaried_day_hours.sql (2026-11-18, v2.7826)

A salaried day can be the person's own length. The owner asked on 2026-11-18, after a teammate on salary for a 30-hour week could only be entered as 8 hours a day at a lower wage. This is the database half. No screen reads or writes the column yet.

A salaried person was paid, costed and scheduled as a flat 8 hours on each weekday. The 8 was written into the payroll kernel, the cost readers, five functions and the workday template's checks. Entered as 8 hours at a lower wage, a 6-hour person's pay came out right, and the wage, the hours on a job and the end of the shift came out wrong.

## The column, on `people_pay_config`

| Column | Type | What it holds |
|---|---|---|
| `salaried_day_hours` | `numeric(4,2)`, not null, default 8 | The length of this person's salaried day in hours. A salaried person is paid and costed this many hours on each weekday at `hourly_wage`. It has no meaning on a row that is not salaried. |

Every row that exists reads 8, so nothing changes for anyone until a day is set.

## The check: `people_pay_config_salaried_day_hours_check`

`salaried_day_hours > 0 AND salaried_day_hours <= 16 AND salaried_day_hours * 4 = trunc(salaried_day_hours * 4)`. A day is above 0, at most 16 hours, and in quarter hours. Quarter hours match the workday template's 15-minute step, so a day and its template can always agree.

The constraint is added by name inside a `DO` block that looks for it first, so a second run adds nothing.

## Who reads and writes it

Nothing changes. The policies on `people_pay_config` are by row, so whoever may change a wage may change the day's length, and nobody else gains anything. `set_pay_config` and `list_people_pay_flags` do not name the column yet.

## What comes next

1. The shared rule (`src/lib/salariedEffectiveHours.ts`, `src/lib/salariedPayrollDays.ts`), payroll and the Pay & schedule card read and write the column.
2. The cost readers and the five functions that carry the 8 (`get_man_hours_by_job`, `keep_job_baseline`, `list_project_board`, `superintendent_scores`, `get_weekly_money_movement_payload`) read it, and `list_people_pay_flags` returns it.
3. The workday template takes its length from it. Its two checks pin a continuous day to 480 minutes and a split day to a sum of 480.

## Order

Additive and idempotent. No `CREATE TABLE`, so no fence calls. The lock is an `ALTER TABLE` on a small table, under the 3 second timeout. A column added with a constant default does not rewrite the table. The push can come any time after the merge. **The client that follows must not merge before the push**: it names the column in the read of the pay row.

No bed: the column has one check and no policy, trigger or function of its own. The kernels that read it are unit tested in the PR that follows.
