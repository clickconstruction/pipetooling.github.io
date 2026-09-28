---
name: "Fuel is a job cost: one rule, its own line, by day, and who is spending"
number: 52
group: ready
status: PR 1 building — claude/job-window-card-rule (v2.4059)
summary: >
  What a job cost, fuel included, the same on every screen, with fuel as its own line and dated
  to the day it was bought, so a long multi-day job shows whether it is making or losing money
  while it runs; then who is spending what; then Review follows the job numbers.
next: >
  PR 1 (the Job window's card charges by Job Summary's rule) ships; then PR 2, fuel as its own
  line in Job Summary and the Job window.
size: M for PRs 1–2 · L for the daily view · M for the spend view
blocker: Step 3 needs the owner's call on who sees spend by person (devs only, or the office roles too).
ver: v2.4059
opinion: build — the owner asked for it (2026-09-28).
mockup: required for PR 3 (the daily cost view) and PR 4 (the spend view) — PRs 1–2 change a figure and add one line in the existing layout
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
2. **Fuel as its own line** beside Parts in Job Summary and the Job window, from the cost-line tag Job Summary already classifies by (`sumTagChargesByJob`).
3. **The job by day** — in the Job window, each day's labor, parts and fuel, fuel dated to the day it was bought, with a running total against the contract; the Months view dates fuel by purchase, not by hours. Mock-up first.
4. **Who is spending what** — fuel and card spend by person for any period, by job, and what is not on a job yet. Mock-up first; needs decision 2.
5. **Review follows job cost** — Review stops taking vehicle-deal fuel off jobs; the person's vehicle charge covers only what is not already on jobs, so nothing counts twice; the per-person panel's fuel line comes with it.

## How to verify

- PR 1: a job with an Internal Transfer or an invoice-linked card charge allocated to it reads the same parts cost in the Job window as its Job Summary row, and the left-out lines carry their note.
