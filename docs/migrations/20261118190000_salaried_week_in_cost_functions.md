# 20261118190000_salaried_week_in_cost_functions.sql (2026-11-18, v2.7840)

The five functions that carried the flat 8 read the person's salaried week. The second database step of the per-person week, after the column ([`20261118160000_salaried_week_hours`](./20261118160000_salaried_week_hours.md)). No screen changes.

A salaried person was costed as 8 hours on a weekday and nothing on a weekend, and each function wrote that rule out for itself. They now ask `salaried_hours_on(week, day)` for the day's hours in the person's own week, so the rule lives once.

## The functions

| Function | What it answers | The pay row it reads |
|---|---|---|
| `get_man_hours_by_job` | The man-hours on each job | `people_pay_config` joined by name |
| `keep_job_baseline` | The labor a job's baseline keeps | `people_pay_config` joined by name |
| `list_project_board` | The labor on the project board | Two lists, by person id then by name. The week joins both. |
| `superintendent_scores` | The labor behind the superintendent scores | The same two lists |
| `get_weekly_money_movement_payload` | Crew labor on bids and on jobs, two places | A lateral read per crew row. The week joins it. |

In each, `CASE WHEN <weekday is Monday to Friday> THEN 8 ELSE 0 END` becomes `public.salaried_hours_on(<the pay row's week>, <the work date>::date)`. Where a function reads the pay row through a named list of columns, `salaried_week_hours` joins the list.

## Copied by a script

Each body is the newest one on file, found by filename order, with only those lines changed. A script copied them, so nothing was retyped. Its line-by-line report is in the PR. `CREATE OR REPLACE` keeps each function's grants, and no later migration alters any of the five.

## `list_people_pay_flags`

This function hands the office the pay flags without the wages. It returns the week as a last column, `salaried_week_hours numeric[]`, so the app's own cost readers can see it.

A function's returned columns cannot be changed in place. It is dropped and made again inside this migration's one transaction, so no caller meets a gap. `20260715120000` did the same. The function has carried no grants of its own since then, so it takes the schema's defaults again. Its access rule and its two reads are otherwise as they were.

## Who is affected

Nobody, until a week is set. Every pay row reads 8 hours on the five weekdays, so each function answers exactly what it answered before. No screen sets a week yet.

## The bed

`supabase/tests/salaried_week/20_cost_functions.sql`, a second scenario in the salaried week bed, with both migrations applied twice more first. All five functions are `plpgsql`, which checks a statement only when it runs, so the scenario runs each once as a dev. A person on 6 hours with a 4-hour Friday and a person on the default week share a job on a Monday, a Friday and a Saturday. The man-hours read 10 and 8. The job's baseline keeps 18 hours and $180. The board, the scores and the money movement answer. The pay flags carry each week. None of the five still writes the 8 out.

## Order

Needs `20261118160000` first: the functions call `salaried_hours_on` and name the column. A push applies them in filename order. Idempotent. No `CREATE TABLE`, so no fence calls. No table is locked: the statements replace functions.

**Applied** to prod by 2026-11-20: the dev seat's `check_migration_ledger` read 1,410 versions applied against 1,410 local files, this version among them (read in the docs pass after #8832); its functions keep their names, and the week `list_people_pay_flags` returns reached `database.ts` in #8833.
