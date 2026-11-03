# 20261102163008_project_board_read.sql (2026-11-02, v2.6352)

The Projects board's one read (punch list #242). The board drew each card from what the viewer's own RLS returned, which holds only for the payroll roles. Measured on the sample accounts:

| Role | Working jobs | Crew rows | Wage rows |
|---|---|---|---|
| Controller | all | all | all |
| Assistant | all | all | none |
| Master, not pay-approved | all | none | none |
| Superintendent | none | none | none |

So a superintendent's board was empty and his phone card could not draw, and an assistant read $0 beside every person with a money line short of the leader's. The owner's rule is that the office's page and the phone never disagree. His older rule (`showJobCostBreakdownTeamLabor`) is that nobody outside payroll sees labor dollars they could divide by hours to get a pay rate.

## What it does

**`list_project_board(p_job_ids uuid[] DEFAULT NULL)`**: `SECURITY DEFINER`, gated by `can_read_project_board()`, refused with 42501 for anyone else. With no ids it answers every Working job, which the client's gate narrows to the projects; with ids, those jobs (the phone's one). The wages stay inside it. What leaves it per job: the job's own facts, its lines with the five budget columns, the baseline's kind and labor hours, **`labor`** (hours per person per day), **`values`** (a report's percent and the office's hand-set ones, by day) and **`spent_pct`**, the blended spend of team labor, subs, cards, supply houses, tally parts and billed materials as a whole percent of the money budget. No labor dollar leaves it for anyone. **`reads_wages`** (`has_payroll_access()`) says only whether this viewer's own RLS-bound read of a day carries dollars, so the client asks for them only then.

**The arithmetic mirrors the job window's Costs tab**: `fetchTeamLaborBreakdownForJob` (each crew row's share of the day's recorded hours by person id then name, eight hours on a weekday for a salaried person), `laborJobSubCost`, the one card rule (no Internal Transfers, a charge on a supply-house invoice counted under the invoice), `supplyLinesFromRows`, `tallyLinesFromRows`.

**The money budget** is the Burn's (`budgetForBurn`, v2.3847): the baseline's direct cost only when it carries both a labor and a materials figure, else the price at the Burn default of 35% margin. One company figure: no device's own Job Summary target moves it.

**`job_expected_hours_select`** becomes `can_read_project_board() OR` the job's own read, so a superintendent reads every target and its reason.

**`can_read_project_board()`**: dev, master, assistant, controller, superintendent, the client's `canSeeProjectsBoard`.

## What stays

No table changes. Nothing writes. `set_job_expected_hours` and `clear_job_expected_hours` keep their setters. A payroll viewer's dollars on a day still come from `loadJobChargesTimelineInputs` under his own RLS.

## Checked before the push

The function's body ran read-only on prod (`BEGIN READ ONLY … ROLLBACK` through the management API, no DDL) against the Costs tab's own client read, as the dev in a browser, for every Working job:

- **Components, 35 of 35 jobs equal to the cent**: team hours, team dollars, subs, cards, supply houses, billed materials, and every day's hours. Live rows exercised team labor on 20 jobs, cards on 20, subs on 10, supply on 10, billed on 1. Tally parts had no live row on a Working job, so that branch is mirrored but unproved by data.
- **`spent_pct`, 37 of 37 jobs equal** to the percent `buildBurnForVerdict`'s budget gives (two jobs had turned Working between the runs).
- About 480 ms and 45 KB for all of them, where the client's read is several requests per job.

`projectBoardRead.test.ts` reads this file and fails if a dollar field is added to what the function returns (proved by adding one per job and one per person), if the 35% drifts from `JOB_BURN_DEFAULT_TARGET_MARGIN_PCT`, or if the gate's roles change.

## After the push

`check:calls-ahead` labels the PR *push right after the merge*: the client calls what only this creates. Pushed 2026-11-03 at 01:40Z, under two minutes after the merge, with `--include-all`, since three later-stamped migrations had reached prod first and none of them names this function or policy. Drift read 1074 of 1074 applied.

The read as each sample account, read only and rolled back, counts only:

| Sample role | Answer | Working jobs | Crew rows | Report points | `reads_wages` | A dollar field |
|---|---|---|---|---|---|---|
| Superintendent | read | 38 | 378 | 49 | false | none |
| Assistant | read | 38 | 378 | 49 | false | none |
| Master, not pay-approved | read | 38 | 378 | 49 | false | none |
| Controller | read | 38 | 378 | 49 | true | none |
| Estimator, helpers, primary, subcontractor | 42501 | | | | | |

Every role on the board reads the same rows, where before the push the superintendent read none of them. A call with one job's id answers with that one job, the phone card's read: about 730 bytes on the ZZ test job, which has no crew rows. Both functions are definer with `search_path=public`, and `anon` cannot execute them.

The types landed with #6883, another session's regeneration, which matched this push's exactly. The hook dropped its cast right after, and a whole-board read now sends no `p_job_ids` at all, so the function's default stands.
