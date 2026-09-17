---
name: "Pipeline cell item 2: a visit report's 100%"
group: gated
status: item 1 shipped v2.3432 · item 2 is an owner decision (a / b / c)
summary: >
  What the *Where the Job Is* train (v2.3416–v2.3421) left: date a report- or back-fill-sourced
  percent on the row (`pct_set_at` of any source), and whether a service-visit report's 100%
  should feed Job Summary (owner decision).
next: >
  Pick a, b or c in the file: whole-job reports only · reports before the last Working entry are
  out of scope · leave it.
size: S
blocker: Your call (a / b / c).
ver: item 1 shipped v2.3432
opinion: build (pick b) — a service-visit report's 100% should not read as job-complete; reports before the last Working entry are out of scope, and it is S.
---

# Pipeline Progress & payment cell — what the Where the Job Is train left

## The ask, in the owner's words

"Add the two follow-ups to the to-do" (2026-09-14), after the train shipped.

## 1 · A percent that arrived through a report or the back-fill has no date on the row — SHIPPED v2.3432

Shipped 2026-09-14 as the decision below: `pct_set_at` + `pct_source` on the RPC, `newestPercent` dated by them, `percentClause` worded per source. Verify after the push.

`list_job_crew_position` returned `pct_manual_at` — the newest `job_pct_events` row with source `manual` only. A job whose percent came from a field report (source `service`, via `propagateReportPctToJob`) or from the 2026-08-07 back-fill (source `seed`) reads *40% typed* with no date, and the stale rule (`percentIsStale`) has to treat it as stale whenever a crew has clocked in since — right for Heron's seed, blunt for a report that landed yesterday.

- **Decision:** return the newest `job_pct_events` row of **any** source as `pct_set_at` (+ its `source`), keep `pct_manual_at` for the newest-wins reading, and let `newestPercent` date the typed number by `pct_set_at`. The words then read *40% set Aug 7* / *12% reported Sep 11* / *90% typed Sep 3* from the event's source.
- **Where it plugs in:** migration `CREATE OR REPLACE FUNCTION public.list_job_crew_position(uuid[], date)` (drop + recreate — the OUT list changes; `SET lock_timeout`), `docs/migrations/` fragment, `src/lib/jobs/jobCrewPosition.ts` (`JobCrewPositionRpcRow.pct_set_at`, `newestPercent`, `percentIsStale`), `src/lib/jobs/progressPaymentCell.ts` (`percentClause` wording per source), `gen-types:linked` after the push.
- **Verify:** dev login → Jobs → Pipeline → Working: Heron reads *40% set Aug 7* (the seed), SpaceX reads *12% reported Sep 11*; a hand-typed number still reads *typed <day>*.

## 2 · A service-visit report's 100% counts as the job's percent

J931 Heron's newest report that answered "How complete is the job?" is the Jun 23 Status Report on a toilet-and-sink visit — *100%* — on a $48,700 job in Top Out. The row hides it (the typed 40% wins, and a stale percent is not drawn), but `list_latest_report_completion_pct` still feeds Job Summary, Burn and the Ready-to-bill prompt with that 100 wherever no newer hand-set exists (v2.3372's rule).

- **Decision (owner's):** either (a) a report's percent only counts when the report is a whole-job report (a Status Report / Job Complete template, not a Note or a visit), or (b) a report filed **before the job entered Working the last time** (`job_status_events`) is out of scope for the current run, or (c) leave it — the row is right, Job Summary reads 100% on Heron until someone types.
- **Where it plugs in:** `list_latest_report_completion_pct` (SQL; the `reported_at` / `manual_at` columns from v2.3372), `src/lib/jobSummaryPercentComplete.ts` (`reportPctIsCurrent`), `useJobSummaryData`, `useQuickfillCompleteNoBillJobs`.
- **Verify:** Job Summary's % column and the Pipeline's burning-jobs card on J931 agree with the row's words.
