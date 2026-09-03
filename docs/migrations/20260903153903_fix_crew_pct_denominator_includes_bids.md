# 20260903153903_fix_crew_pct_denominator_includes_bids.sql (2026-09-03, v2.2691)

Finding 1 of the 2026-09-03 Review math audit — the one defect that reached every labor surface at once.

## What was wrong

`sync_crew_jobs_from_clock` wrote each job's `people_crew_jobs.job_assignments[].pct` as its share of the day's approved sessions **that had a job**; `sync_crew_bids_from_clock` wrote each bid's pct as its share of the sessions **that had a bid**. `approve_clock_sessions` adds *every* approved session's hours to `people_hours`. Every consumer multiplies pct × the day's hours (Convention 1, v2.539), so a day split 4 h on a job and 4 h on a bid credited **8 h to the job** and separately counted 4 h of bid overhead: 12 h of labor for an 8 h day. Salaried people got the same through the 8 h/weekday credit. Affected: People → Review (period labor, lifetime job labor, revenue shares), Jobs → Job Summary team labor (`utils/teamLabor.ts`), pay-report breakdowns, Quickfill / Moneyfill unallocated-time queues.

## What it does

- Redefines both functions (same signatures, same owner/grants, same `search_path`) with **one shared denominator**: every approved, closed session that day with a job **or** a bid. Job pcts and bid pcts now sum to 100 across the two tables. Unassigned sessions stay out of the denominator, exactly as before. The office job remains a job assignment (consumers skip it), so office time still lowers field pct as it did.
- Keeps the "last row takes the remainder" rounding, now against the **bucket's** share, so a job-only day still sums to exactly 100 and a mixed day lands on exactly its share.
- **Resync** (in the same migration, idempotent): re-runs both functions for every person-day in the last two years that has at least one approved closed job session *and* one bid session — the only rows whose values change. Logs the count with `RAISE NOTICE`.

## Apply order / coordination

- No client change; no type regeneration; no edge function.
- Push any time. Pay **amounts** do not depend on these tables (payroll pays `people_hours` × wage); the crew split is allocation only, so the resync cannot alter a pay stub. It does change the *breakdown* lines on pay reports and the labor figures on Review / Job Summary for the affected days.
- Known edge left as-is: a session carrying both a `job_ledger_id` and a `bid_id` counts once in the denominator but appears in both numerators (v2.2674 measured zero such sessions).
