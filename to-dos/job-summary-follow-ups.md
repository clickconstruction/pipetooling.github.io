---
name: "Job Summary: what is left"
group: ready
status: >
  items 3, 7 and the badge date shipped v2.3439 / v2.3428 / v2.3441 · time off on Capacity shipped
  v2.3523 · left: overtime, travel, the earned-revenue kernel
summary: >
  Days delta strip, the under-60% Needs-you card, PTO / overtime on Capacity, the J963 loader
  reconcile, the earned-revenue kernel.
next: >
  PTO from the schedule overrides (M); the earned-revenue kernel (M). Overtime and travel wait on
  ledger fields.
size: M
blocker: None for the kernel.
ver: 4 of 8 shipped
---

# Job Summary: the follow-ups the view train left behind

## The ask

The Job Summary train (v2.2817–v2.2832: Compare, Months, Cycle, Scatter, Capacity, Ahead, Rework, leakage flags) noted several pieces it could not build honestly yet.

## Shipped since the 2026-09-05 sweep

- **% provenance badge** — v2.2852 renders `pctSource` on the % cell with the report date once the row is expanded.
- **The job-from-bid link** — v2.2859 ("Open the job" on every Won moment) writes `jobs_ledger.bid_id` routinely; v2.2904 logs the birth row. **Bid vs actual** itself shipped v2.3342 (2026-09-11).

## The items (validated 2026-09-06)

1. ~~**Capacity: PTO / holidays off available hours**~~ — shipped v2.3523: recorded time off (`user_time_off`, mapped through `people.account_user_id`) comes off that weekday's available hours; a Time off tile and a dashed cap on the bar say how much. Holidays still have no record in the app (nothing to subtract) — a holidays table would be its own small train.
2. **Capacity: overtime as its own slice** — needs per-person hours per week; the day ledger does not carry it.
3. ~~**Needs you: "under 60% three weeks running"**~~ — shipped v2.3439: `capacity-under` card from `capacityUnderStreak` over the three complete weeks before this one (`useCapacityUnderNudge`), opening Job Summary → Capacity.
4. **Travel on Days** — deferred: `job_travel_times` has pairs for ~55 jobs but the day ledger has no per-session start times, so a per-day windshield figure cannot be honest yet.
5. ~~**Bid vs actual**~~ — shipped v2.3342 (Bids → Bid Costs → Bid vs actual reads the Burn train's `job_budgets` snapshots against recorded hours).
6. ~~**Review vs Job Summary parts cost disagree on J963**~~ — fixed v2.3394: the difference was card charges only (Review counted internal transfers and double-counted invoice-linked card purchases; tally lines were priced identically everywhere). Review now applies Job Summary's one card rule. Still on their own conventions: Job Detail's profit band (gross card charges) and Crew P&L (no parts).
7. ~~**Days tiles have no delta strip**~~ — shipped v2.3428: the strip moved to a shared `JobRunDeltaStrip`; Days renders it under the tiles from week chips (1 wk … 8 wk) over `jobDaysDelta.ts`.
8. **v2.2852 follow-ups**: ~~extend `list_latest_report_completion_pct` to return `created_at` (migration) so the badge carries the date before the row is expanded~~ — the RPC has returned `reported_at` since v2.3372; the client reads it for the collapsed-row badge since v2.3441; one shared earned-revenue kernel for Job Summary, Crew P&L and the board (Tier-1 #5(c) remainder — Crew P&L still credits gross bill by hours); optionally stamp `job_pct_events.source = 'field_report'` from `set_job_pct_from_field`.

## Where it plugs in

- Kernels `src/lib/jobs/jobSummary*.ts` (Capacity, Months, Ledger view), `src/lib/jobSummaryPercentComplete.ts`, `src/lib/bridge/earnedRevenue.ts`; views `src/components/jobs/JobSummary*View.tsx`; the Needs-you card list in `src/lib/dashboardNeedsYou.ts`.

## The plan

Smallest first: (7) Days delta → (3) Needs-you card → (8) report date on the badge → (1) PTO from schedule overrides → (8) earned-revenue kernel → (2) and (4) only if the ledger grows the fields.

## How to verify

- Capacity view on a week with a known day off shows the reduced available hours; Bid vs actual on a job opened from a bid shows the bid's cost estimate beside the job's actuals.

## The mock-up

**Before / after, drawn from the real screen** (also on the design canvas https://claude.ai/artifact/JHb3f7Tr7LVPfjMg6sdNLf): [`job-summary-follow-ups-earned-revenue.html`](./job-summary-follow-ups-earned-revenue.html) — the earned-revenue kernel on the Jobs view (J963 moves from contract × % to hours-earned), drawn 2026-09-16.
