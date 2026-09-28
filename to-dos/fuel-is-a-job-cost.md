---
name: "Fuel is a job cost: one rule, its own line, by day, and who is spending"
number: 52
group: ready
status: PR 1 in review (#3959, v2.4059) · PR 2 building — claude/job-window-fuel-line (v2.4068)
summary: >
  What a job cost, fuel included, the same on every screen, with fuel as its own line and dated
  to the day it was bought, so a long multi-day job shows whether it is making or losing money
  while it runs; then who is spending what; then Review follows the job numbers.
next: >
  PR 1 (the Job window's card charges by Job Summary's rule) ships; then PR 2, fuel as its own
  line in Job Summary and the Job window.
size: M for PRs 1–3 · M for the spend view
blocker: Step 3 needs the owner's call on who sees spend by person (devs only, or the office roles too).
ver: v2.4059 · 4068
opinion: build — the owner asked for it (2026-09-28).
mockup: required for PR 4 (the spend view) — PRs 1–3 change figures and add a line or a stream in the existing layout
---

# Fuel is a job cost

## The ask

The owner, 2026-09-28, asked what to do about the Review tab's fuel difference and answered with the intent instead:

> most important is knowing how much jobs cost and when fuel is applied to a job this helps us tell how much we are making or losing on large multi day jobs and is very important, the review is secondary and I would like to know how much everyone is spending

Then: "build it" — which takes the recommended answer to the first decision below.

## What was true on 2026-09-28

- **Every job screen counts all fuel** (Job Summary, the Job window, the charges timeline, the Bridge). Only People → Review's team table takes a vehicle-deal person's fuel off the job (Wheels on Labor, v2.2735), and the vehicle rate it charges instead reaches no job.
- **The Job window summed every card line** — Internal Transfers and charges already on a supply-house invoice included — where Job Summary drops the first and counts the second once. The same job read two parts costs.
- **Fuel is folded into Parts** everywhere but Job Summary, where it is a muted sub-line.
- **Nothing dates fuel on a job by day** apart from the charges timeline, where it is one stream with every other card charge; the Months view spreads parts by field hours.
- **A card charge reaches a job only when someone allocates it** — no rule does it. Fuel nobody allocated is on no job.
- **Spend by person** exists only in the Wheels report (People → Vehicles, devs, a fixed 90 days, fuel only).

## The decisions

1. **Fuel stays on the job everywhere, Review included** — taken (the recommendation; "build it"). Reverses v2.2735's rule for Review in PR 5.
2. **Who sees spend by person** — open: devs only (like Wheels today), or the office roles (assistant, controller) too.
3. **Order** — the train below, the Job window fix first as its own PR.

## The plan

1. **The Job window counts card charges by Job Summary's rule** (v2.4059) — `jobCardChargesCountedFromLines` / `jobCardLineStatus` in `supabase/functions/_shared/jobMaterialsCostLines.ts`; the snapshot loads the rule's lookups; the Card charges total, the profit band and the Job tab's Costs card follow; a line left out says why. Edit Job's Parts Cost section too. Delete / migrate / combine still list every line attached — they move rows, not cost. dev-mcp's `get_job` still sums every line (an edge deploy; a follow-up).
2. **Fuel as its own line** in the Job window (v2.4068) — `lib/jobs/jobCardCostLines.ts` (`jobCardCostLines`, and `clampCostLinesToCounted`, which Job Summary now shares); the snapshot reads each charge's bank category, the accounting labels and the tags, and splits the counted card charges by cost-line tag. The Job tab's Costs card draws ⛽ Fuel & gas after Parts (Parts less the fuel), Where the money went draws it beside *Other card charges*, and each fuel charge in the card list carries a ⛽ marker. Job Summary already draws the line under Parts; its print does not (and does not take off the invoice-linked charges) — a follow-up.
3. **The job by day** — the day-by-day view already exists on the Job window's Costs tab (Burn's daily spend for the last 14 working days, the cost-to-date timeline, *spent so far*), so no new screen: those views count card charges by the one card rule, with refunds netting (today they add every line as a positive amount), and fuel becomes its own ⛽ stream in the timeline and the daily spend, dated to the day it was bought. The Months view still spreads parts by field hours — dating fuel there is a follow-up if the owner wants it.
4. **Who is spending what** — fuel and card spend by person for any period, by job, and what is not on a job yet. Mock-up first; needs decision 2.
5. **Review follows job cost** — Review stops taking vehicle-deal fuel off jobs; the person's vehicle charge covers only what is not already on jobs, so nothing counts twice; the per-person panel's fuel line comes with it.

## Found along the way

- **The Job window's cost timeline and "spent so far"** read every card line as a positive amount (`useJobChargesTimelineInputs.ts`, `Math.abs`): no Internal Transfer or invoice rule, and a refund does not come off. It is the running cost of a long job — fixed with PR 3.
- **Job Summary's print** (`jobSummaryCostBreakdown.ts`) does not take off card charges already on a supply invoice, so the printed parts can read higher than the table.

## How to verify

- PR 1: a job with an Internal Transfer or an invoice-linked card charge allocated to it reads the same parts cost in the Job window as its Job Summary row, and the left-out lines carry their note.
- PR 2: a job with fuel on the card shows ⛽ Fuel & gas on the Job tab's Costs card and in Where the money went, for the same amount as the grey fuel line under its Job Summary Parts cell; Parts + fuel on the card equals the Job Summary Parts figure.
