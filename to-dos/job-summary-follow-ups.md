# Job Summary: the follow-ups the view train left behind

Status: not started · sources: fragments v2.2828, v2.2832, v2.2840, v2.2852; the train's tail (PR #2591, v2.2844) is merged

## The ask

The Job Summary train (v2.2817–v2.2832: Compare, Months, Cycle, Scatter, Capacity, Ahead, Rework, leakage flags) noted several pieces it could not build honestly yet.

## Shipped since the 2026-09-05 sweep

- **% provenance badge** — v2.2852 renders `pctSource` on the % cell with the report date once the row is expanded.
- **The job-from-bid link** that Bid vs actual was blocked on — v2.2859 ("Open the job" on every Won moment) writes `jobs_ledger.bid_id` routinely; v2.2904 logs the birth row. The view itself is still unbuilt (below).

## The items (validated 2026-09-06)

1. **Capacity: PTO / holidays off available hours** — `src/lib/jobs/jobSummaryCapacity.ts` has no PTO/holiday handling; needs the salary work-schedule day overrides as the source.
2. **Capacity: overtime as its own slice** — needs per-person hours per week; the day ledger does not carry it.
3. **Needs you: "under 60% three weeks running"** — no such card in `src/lib/dashboardNeedsYou.ts`; the Capacity kernel can feed it.
4. **Travel on Days** — deferred: `job_travel_times` has pairs for ~55 jobs but the day ledger has no per-session start times, so a per-day windshield figure cannot be honest yet.
5. **Bid vs actual** — now cheap: `jobs_ledger.bid_id` is written by the v2.2859 flow and cost estimates exist for ~259 bids. Nothing renders it yet.
6. **Review vs Job Summary parts cost disagree on J963** (v2.2688 / v2.2691 "finding 11": Review $1,465 vs Job Summary $710) — card charges and PO-priced tally lines counted on one surface and not the other. Reconcile the two loaders before trusting either margin.
7. **Days tiles have no delta strip** — v2.2817 promised deltas on Days and Timeline; `JobSummaryTimelineView.tsx` has `DeltaStrip`, `JobSummaryDaysView.tsx` has none.
8. **v2.2852 follow-ups**: extend `list_latest_report_completion_pct` to return `created_at` (migration) so the badge carries the date before the row is expanded; one shared earned-revenue kernel for Job Summary, Crew P&L and the board (Tier-1 #5(c) remainder — Crew P&L still credits gross bill by hours); optionally stamp `job_pct_events.source = 'field_report'` from `set_job_pct_from_field`.

## Where it plugs in

- Kernels `src/lib/jobs/jobSummary*.ts` (Capacity, Months, Ledger view), `src/lib/jobSummaryPercentComplete.ts`, `src/lib/bridge/earnedRevenue.ts`; views `src/components/jobs/JobSummary*View.tsx`; the Needs-you card list in `src/lib/dashboardNeedsYou.ts`.

## The plan

Smallest first: (7) Days delta → (3) Needs-you card → (8) report date on the badge → (5) Bid vs actual → (1) PTO from schedule overrides → (6) loader reconcile → (8) earned-revenue kernel → (2) and (4) only if the ledger grows the fields.

## How to verify

- Capacity view on a week with a known day off shows the reduced available hours; Bid vs actual on a job opened from a bid shows the bid's cost estimate beside the job's actuals; J963's parts cost reads the same on Review and Job Summary.
