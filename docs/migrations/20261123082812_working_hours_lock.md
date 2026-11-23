# 20261123082812_working_hours_lock.sql (2026-11-23, v2.8353)

The two old doors onto a week's days and hours close, with the screen that replaces them. It follows [`20261123075925_working_hours_door`](./20261123075925_working_hours_door.md).

## Why

The owner's rule for working hours is that only a dev or the controller sets them. The door from the first migration holds that for a set row. Two older doors still let others change the same fact:

- whoever may write a pay row, an owner with pay approval among them, could change `people_pay_config.salaried_week_hours`, the days and hours a salaried person is paid;
- a person, or the office for them, could answer the hours they can work under a set week, leaving a second week nobody reads.

## What changes

- **`check_salaried_week_set_by_dev_or_controller()`**, a trigger function, and **`people_pay_config_week_dev_or_controller`**, `BEFORE INSERT OR UPDATE OF salaried_week_hours`. It passes a write that leaves the week as it was, a new row on the default week `{0,8,8,8,8,8,0}`, a write with no sign-in (a migration, a cron, the service role), a dev and the controller. Anyone else is refused with SQLSTATE 42501 and the words *A dev or the controller sets the days and hours of a week.*
- **`has_working_hours(uuid) → boolean`**, security definer: true when the newest set row that has started holds a week. It answers yes or no and nothing of the week.
- **The insert policy** `person_available_hours_write` is made again with `AND NOT has_working_hours(user_id)`.

## What still works

- An owner changes a wage, or saves **Edit pay setup** with the week as it stands.
- The Hire form and the Pay lens make and edit pay rows without naming the week.
- `set_working_hours` writes the week for a salaried person, since only a dev or the controller reaches its write.
- A person with no working hours answers as before, and so does the office for them.

## Order

The client that hides the old doors ships in the same PR and deploys on the merge. Push after it. The other way round, an owner's save of a changed week would be refused with nothing on the screen to say why.

## Test

`npm run test:pg:working-hours` runs this migration twice more and plays `supabase/tests/working_hours/20_lock.sql`.
