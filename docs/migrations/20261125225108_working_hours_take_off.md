# 20261125225108_working_hours_take_off.sql (2026-11-25, v2.8607)

Taking working hours off a salaried person puts the standard week back on their pay row. It replaces `set_working_hours`, first written by [`20261123075925_working_hours_door`](./20261123075925_working_hours_door.md). Punch list #429.

## Why

The door writes a salaried person's seven hour numbers (`people_pay_config.salaried_week_hours`) with the week it sets, so pay and the hours never part. A take-off, `p_days` null, wrote its row and nothing on pay. The seven numbers stayed where the last set put them, so a person with no working hours was still paid the week of hours nobody held them to. The live test of 2026-11-24 set 6 hours a day, took the hours off, and pay still read 6.

The owner's two answers of 2026-11-25. Asked what taking the hours off should leave: *"Clear the week's hours too"*. Asked the same day whether that is the standard week or no paid hours, the pick *The standard week* stood: *"Yes, all picks"*.

## What changes

`CREATE OR REPLACE` of **`set_working_hours(uuid, jsonb, date, text, boolean) → jsonb`**. The arguments, the answer's keys, the grants and the definer are as they were, so the generated types do not change.

- **The new rule.** A take-off for a salaried person who has a set week in force on the Sunday asked for writes `{0,8,8,8,8,8,0}` on their pay row, when the row holds another week.
- **The standard week** is the column's own default. The column is `NOT NULL`, so the default is written and never a null. `salaried_hours_on` in the database and `salariedWeekOf` in the app already read it as 8 hours Monday to Friday.
- **It is a change to pay like any other.** It starts this week, since pay carries no date: a take-off from next week that would move pay is refused with *Start it this week.* It needs a reason: without one it is refused with *Say why.* The reason goes on the set row and on one `pay_admin_events` line, with the pay row before and after, as a set's line has them.
- **A dry run** answers `pay.moved` and `pay.after` for a take-off too, and writes nothing.

## What stays

- A take-off with no set week in force takes nothing off, so it moves no pay. A week typed on pay for a person nobody set hours for still stands. That covers hours saved for next week and taken off before they start.
- A salaried person already on the standard week has no pay side to a take-off: no reason, no pay log line, and it may start next week.
- A person who is not salaried has no pay side at all. A week left on their pay row is not touched.
- Who may call the door, the shape of a week, the Sundays it takes and every rule of a set.

## What it does not do

It makes and changes no table, so the four closing calls of a `CREATE TABLE` migration do not apply. It corrects no row. Read on prod through the dev seat on 2026-11-25: no salaried person had a set row at all, so no pay row was in the fault's state.

## Locks

`CREATE OR REPLACE FUNCTION`, `REVOKE`, `GRANT` and `COMMENT` on one function. No table is locked. `SET lock_timeout = '3s'` opens the file as every migration's does.

## Order

The client calls nothing this migration creates. Its **Take working hours off** window says pay goes back to the standard week and asks why, in the same PR. The old window would misread the new door: it sends no reason, so a salaried person's take-off would be refused in the door's words with no box to answer in. So the client deploys first, on the merge, and the push follows as soon as that deploy ends. Between the two, the new window's words are ahead of the door, which still leaves the week. Nobody on prod can meet either gap today, since no salaried person has working hours set.

## Test

`npm run test:pg:working-hours` runs this migration twice more after the door's, and plays `supabase/tests/working_hours/50_take_off.sql`: a take-off with nothing in force, hours stopped before they start, the dry run, the two refusals, an owner at the door, the take-off with its pay log line, a second take-off, hours set again from the standard week, a salaried person already on the standard week, and an hourly person. `10_door.sql`'s case 11 and `20_lock.sql`'s take-off now give the reason a change to pay asks for.

**Applied** to prod by 2026-11-26: the dev seat's `check_migration_ledger` read 1,504 versions applied against 1,504 files on `origin/main`, this version among them (read in the docs pass after #9830); no new name in `database.ts`, since the function is replaced under its own name.
