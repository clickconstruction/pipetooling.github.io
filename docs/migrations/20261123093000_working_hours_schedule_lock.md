# 20261123093000_working_hours_schedule_lock.sql (2026-11-23, v2.8357)

The insert and the update policies on `salary_work_schedule_templates` narrow to a dev and the controller. It is the last lock of working hours (punch list #429), after [`20261123075925_working_hours_door`](./20261123075925_working_hours_door.md), [`20261123082812_working_hours_lock`](./20261123082812_working_hours_lock.md) and [`20261123083429_working_hours_clock`](./20261123083429_working_hours_clock.md).

## Why

A person's standing hours are a dev's or the controller's to set. The usual day of the workday schedule is a standing week a clock reads, and both policies let the person themself and anyone with payroll access write it (`user_id = auth.uid() OR salary_schedule_staff_or_self_target(user_id)`).

## What changes

`ALTER POLICY salary_template_insert … WITH CHECK (is_dev() OR is_controller())` and `ALTER POLICY salary_template_update … USING (…) WITH CHECK (…)` with the same predicate. The policies are altered in place, so neither is ever absent and a second run changes nothing. The table's comment says the rule.

## What stays

- `salary_template_select`: the person, pay staff and a team lead read the row.
- `salary_template_delete`: deleting sets no hours. A person who is no longer salaried removes their own leftover row from Settings, and a person's leave clears it.
- Every policy on `salary_work_schedule_day_overrides`: a custom schedule for one date is the person's own for today and pay staff's for any day.
- The definer functions that move a row's job or bid when jobs are combined or migrated, and `pay_staff_clear_salary_schedule_by_person_name`. RLS does not reach them.

## Order

Deploy the client first. The Workday schedule window's one Save press wrote the usual day and then the date. An older client would stop at the usual day for anyone but a dev or the controller.

## Test

`npm run test:pg:working-hours` plays `supabase/tests/working_hours/40_schedule.sql` under the tables' own policies.

## Applied

Not yet.
