# Job Summary: the follow-ups the view train left behind

Status: not started · sources: fragments v2.2828, v2.2832, v2.2840; open PR #2591 (first-look polish) is the current tail of the train

## The ask

The Job Summary train (v2.2817–v2.2832: Compare, Months, Cycle, Scatter, Capacity, Ahead, Rework, leakage flags) noted several pieces it could not build honestly yet.

## The items (validated 2026-09-05)

1. **Capacity: PTO / holidays off available hours** — `src/lib/jobs/jobSummaryCapacity.ts` has no PTO/holiday handling; needs the salary work-schedule day overrides as the source.
2. **Capacity: overtime as its own slice** — needs per-person hours per week; the day ledger does not carry it.
3. **Needs you: "under 60% three weeks running"** — no such card in `src/lib/dashboardNeedsYou.ts` (card keys checked); the Capacity kernel can feed it.
4. **Travel on Days** — deferred: `job_travel_times` has pairs for ~55 jobs but the day ledger has no per-session start times, so a per-day windshield figure cannot be honest yet.
5. **Bid vs actual** — blocked on jobs not linking to bids broadly. `jobs_ledger.bid_id` exists and the job form reads it; the gap is a "job from bid" flow that writes it routinely. Cost estimates exist for ~259 bids, so the view is cheap once the link is there.
6. **% provenance badge (#5(b))** — v2.2840 added `pctSource` to the enriched row but nothing renders it yet; a small badge on the % cell ("paid invoices" / "crew report" / "office") closes it.
7. **Review vs Job Summary parts cost disagree on J963** (v2.2688 "Next": Review $1,465 vs Job Summary $710) — finding-11 territory: card charges and PO-priced tally lines counted on one surface and not the other. Reconcile the two loaders before trusting either margin.

## Where it plugs in

- Kernels `src/lib/jobs/jobSummary*.ts` (Capacity, Months, Ledger view), `src/lib/jobSummaryPercentComplete.ts`; views `src/components/jobs/JobSummary*View.tsx`; the Needs-you card list in `src/lib/dashboardNeedsYou.ts`.

## The plan

Smallest first: (6) badge → (3) Needs-you card → (1) PTO from schedule overrides → (5) job-from-bid link, then Bid vs actual → (2) and (4) only if the ledger grows the fields.

## How to verify

- Capacity view on a week with a known day off shows the reduced available hours; the badge tooltip names the % source on J523 (paid progress bill, crew report 77).
