# Pipeline Progress & payment cell — what the Where the Job Is train left

Status: not started · low · source: the *Where the Job Is* train (v2.3416 legend · v2.3417 recognition · v2.3418 crew feed · v2.3419 the cell · v2.3421 the Set stages door), all on main 2026-09-14; both items surfaced in the live pass on that day's Working rows

## The ask, in the owner's words

"Add the two follow-ups to the to-do" (2026-09-14), after the train shipped.

## 1 · A percent that arrived through a report or the back-fill has no date on the row

`list_job_crew_position` returns `pct_manual_at` — the newest `job_pct_events` row with source `manual` only. A job whose percent came from a field report (source `service`, via `propagateReportPctToJob`) or from the 2026-08-07 back-fill (source `seed`) reads *40% typed* with no date, and the stale rule (`percentIsStale`) has to treat it as stale whenever a crew has clocked in since — right for Heron's seed, blunt for a report that landed yesterday.

- **Decision:** return the newest `job_pct_events` row of **any** source as `pct_set_at` (+ its `source`), keep `pct_manual_at` for the newest-wins reading, and let `newestPercent` date the typed number by `pct_set_at`. The words then read *40% set Aug 7* / *12% reported Sep 11* / *90% typed Sep 3* from the event's source.
- **Where it plugs in:** migration `CREATE OR REPLACE FUNCTION public.list_job_crew_position(uuid[], date)` (drop + recreate — the OUT list changes; `SET lock_timeout`), `docs/migrations/` fragment, `src/lib/jobs/jobCrewPosition.ts` (`JobCrewPositionRpcRow.pct_set_at`, `newestPercent`, `percentIsStale`), `src/lib/jobs/progressPaymentCell.ts` (`percentClause` wording per source), `gen-types:linked` after the push.
- **Verify:** dev login → Jobs → Pipeline → Working: Heron reads *40% set Aug 7* (the seed), SpaceX reads *12% reported Sep 11*; a hand-typed number still reads *typed <day>*.

## 2 · A service-visit report's 100% counts as the job's percent

J931 Heron's newest report that answered "How complete is the job?" is the Jun 23 Status Report on a toilet-and-sink visit — *100%* — on a $48,700 job in Top Out. The row hides it (the typed 40% wins, and a stale percent is not drawn), but `list_latest_report_completion_pct` still feeds Job Summary, Burn and the Ready-to-bill prompt with that 100 wherever no newer hand-set exists (v2.3372's rule).

- **Decision (owner's):** either (a) a report's percent only counts when the report is a whole-job report (a Status Report / Job Complete template, not a Note or a visit), or (b) a report filed **before the job entered Working the last time** (`job_status_events`) is out of scope for the current run, or (c) leave it — the row is right, Job Summary reads 100% on Heron until someone types.
- **Where it plugs in:** `list_latest_report_completion_pct` (SQL; the `reported_at` / `manual_at` columns from v2.3372), `src/lib/jobSummaryPercentComplete.ts` (`reportPctIsCurrent`), `useJobSummaryData`, `useQuickfillCompleteNoBillJobs`.
- **Verify:** Job Summary's % column and the Pipeline's burning-jobs card on J931 agree with the row's words.
