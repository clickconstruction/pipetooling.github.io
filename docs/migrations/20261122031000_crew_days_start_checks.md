# 20261122031000_crew_days_start_checks.sql (2026-11-21, v2.8243)

Before we start: the crew on a job is who is on it now. Punch list #382, call C from the audit of PR 10, on Taunya's word of 2026-11-21. It replaces one function, `start_checks_crew`, with the same signature and the same grants. No table, so no closing calls.

## What it changes

`start_checks_crew(job)` is the gate for the look on arrival. It decides who is asked **Is it as told?**, who may answer, and who reads a stage's bullets on them and their yeses.

It counted anyone who had ever clocked in on the job, with no limit of days. A helper who worked one day on a job months ago was still its crew, and could answer for a stage today. PR 10 (`20261120100000_start_check_arrive.md`) was the first write through the gate.

A clock-in now counts for 14 days: today and the fourteen days before it, by the session's `work_date`.

Two ways onto the crew are as they were, with no limit of days:

- the job's team (`jobs_ledger_team_members`)
- a sub who reads the job (`subcontractor_can_read_jobs_ledger_row`)

A primary is still never the crew, and a job shut by its papers is still shut.

## The file's name

The name ends in `_start_checks.sql` on purpose. `scripts/pgtest-start-checks.sh` applies the tables' migration a second time to prove it changes nothing, and that puts the first gate back. The script finds its files by their ending, so it catches this one and applies it after.

## Deploy

No client change needs it and no client is misread by it. A person it holds out is asked nothing, as anyone off the crew is. Pushed on 2026-11-22, right after the merge, after a dry run that listed it alone.

## Tested

`supabase/tests/start_checks/30_arrive.sql`, two new checks: a helper on no team with a clock-in on the job fifteen days ago is told nothing, and with one fourteen days ago is asked. Docker does not run on the Mac this was written on, so the SQL beds workflow is the bed's first run.

**Applied** to prod by 2026-11-23: `npm run check:migration-drift` read 1,454 versions applied against 1,454 local files, this version among them (read in the docs pass after #9274).
