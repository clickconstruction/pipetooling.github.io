# 20261126033215_pay_config_log_screen_changes.sql (2026-11-26, v2.8629)

A wage changed on a screen leaves a line on the pay log. Punch list #389, the second half of the brief the walk of 2026-11-25 raised; the person's yes of 2026-11-26 (*"All picks stand"*, the row reading *a wage changed on a screen gets a pay-log line by a database trigger, its push asked separately*).

## Why

The pay log is `pay_admin_events` ([`20260918100000_pay_person_admin`](./20260918100000_pay_person_admin.md)). One function writes a `set_pay_config` line, `set_pay_config`, with the reason it is given, and its only callers are the dev seat's pay verbs. Every screen that saves a wage writes `people_pay_config` directly with a plain upsert: Bring back, the hire and end windows, the desk's Pay section and People → Pay's cells. So a wage the office changes on a screen left a pay row and no line, and the one-dollar wage saved on a ZZ Test sub on 2026-11-25 at 23:04 UTC has none.

## What it makes

- **`people_pay_config_log_change()`**, a `SECURITY DEFINER` trigger function. After an insert or an update of one pay row, when a pay column changed (`hourly_wage`, `office_hourly_wage`, `is_salary`, `record_hours_but_salary`, `show_in_hours`, `salaried_week_hours`), it writes one `pay_admin_events` line of action `set_pay_config`: `payload.changes` the changed columns with their new values, `payload.before` and `payload.after` the row (less `person_id`), `payload.by` `screen`, `reason` *Changed on a screen. No reason was asked.*, `actor` the signed-in user. A new row with a wage or Salaried on is a line with no `before`; a new row with no pay, and a write that changes no watched column, write none.
- **`people_pay_config_log_change`**, a `CONSTRAINT TRIGGER`, `DEFERRABLE INITIALLY DEFERRED`, `FOR EACH ROW`: it fires at the end of the transaction. `set_pay_config` and `set_working_hours` write their own line after their `UPDATE`, so at the end of their transaction the trigger finds a `set_pay_config` line for the person written at `now()`, this transaction's time, and writes none. A change through a door still leaves exactly one line; a screen's write, which has no such line, gets one.

## What stays

Who reads the log (`has_payroll_access()`). The two doors and their lines. The pay row's other triggers. `vehicle_arrangement` and `vehicle_rate_override` are not watched.

## What it does not do

It makes and changes no table, so the four closing calls of a `CREATE TABLE` migration do not apply. It backfills nothing: the one-dollar wage of 2026-11-25 stays without a line, and the walk's pay log reads as it did until the next change.

## Locks

`CREATE OR REPLACE FUNCTION`, `DROP TRIGGER IF EXISTS`, `CREATE CONSTRAINT TRIGGER` and `COMMENT`: the trigger statements take a short `SHARE ROW EXCLUSIVE` lock on `people_pay_config`, a small table. `SET lock_timeout = '3s'` opens the file.

## Order

The client calls nothing new and changes nothing: either order. Until the push a screen's wage change leaves no line, as today.

## Test

`npm run test:pg:pay-log-screen` applies this migration a second time after every migration, which must change nothing, and plays `supabase/tests/pay_log_screen/20_scenario.sql`, with `SET CONSTRAINTS ALL IMMEDIATE` standing in for the end of a request's transaction: a screen's wage change leaves one line with the wage before and after; a write that changes no pay, and a column the log does not watch, leave none; the salaried switch leaves a line; a change through `set_pay_config` leaves exactly the door's own line; a new row with a wage leaves a line with no before; a new row with no pay leaves none. No Postgres runs on the Mac that built this, so the SQL beds job on the PR is the proof of the SQL.
