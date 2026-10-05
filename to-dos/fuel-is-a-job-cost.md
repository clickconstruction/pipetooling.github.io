---
name: "Fuel is a job cost: one rule, its own line, by day, and who is spending"
number: 52
group: ready
status: PRs 1–3 shipped (v2.4059, v2.4068, v2.4104) · PR 4a shipped v2.4106 (migration 20260929001119 — the office roles read the tags; on prod, drift check clean 2026-09-29) · PR 4b-1 (the read + the kernel) on feat/card-charges-window, v2.4594, migration 20261005212106 · PR 4b-2 (the tab) on feat/people-spending-tab, v2.4602, merges after the push · PR 5 (Review follows the job) not started
summary: >
  What a job cost, fuel included, the same on every screen, with fuel as its own line and dated
  to the day it was bought, so a long multi-day job shows whether it is making or losing money
  while it runs; then who is spending what; then Review follows the job numbers.
next: >
  PR 4b, People → Spending, per the mock-up; then PR 5, Review follows the job.
size: M for PRs 1–3 · M for the spend view
blocker: None.
ver: v2.4059 · 4068 · 4104 · 4106
opinion: build — the owner asked for it (2026-09-28).
mockup: fuel-is-a-job-cost-spending.html — People → Spending (PR 4b); PRs 1–3 change figures and add a line or a stream in the existing layout
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
2. **Who sees spend by person** — the office roles (the owner, 2026-09-28): dev, master technician, assistant, controller — the roles that can already read card charges.
3. **Order** — the train below, the Job window fix first as its own PR.
4. **The spend view** (the owner, 2026-09-28, on the mock-up): its home is **People → Spending**; it counts **card charges only** (debit and credit card purchases — no ACH or checks); and the office roles **read the fuel tag** (PR 4a), so an assistant sees fuel on a job too. Editing tags stays with Banking.

## The plan

1. **The Job window counts card charges by Job Summary's rule** (v2.4059) — `jobCardChargesCountedFromLines` / `jobCardLineStatus` in `supabase/functions/_shared/jobMaterialsCostLines.ts`; the snapshot loads the rule's lookups; the Card charges total, the profit band and the Job tab's Costs card follow; a line left out says why. Edit Job's Parts Cost section too. Delete / migrate / combine still list every line attached — they move rows, not cost. dev-mcp's `get_job` still sums every line (an edge deploy; a follow-up).
2. **Fuel as its own line** in the Job window (v2.4068) — `lib/jobs/jobCardCostLines.ts` (`jobCardCostLines`, and `clampCostLinesToCounted`, which Job Summary now shares); the snapshot reads each charge's bank category, the accounting labels and the tags, and splits the counted card charges by cost-line tag. The Job tab's Costs card draws ⛽ Fuel & gas after Parts (Parts less the fuel), Where the money went draws it beside *Other card charges*, and each fuel charge in the card list carries a ⛽ marker. Job Summary already draws the line under Parts; its print does not (and does not take off the invoice-linked charges) — a follow-up.
3. **The job by day** — the day-by-day view already exists on the Job window's Costs tab (Burn's daily spend for the last 14 working days, the cost-to-date timeline, *spent so far*), so no new screen: those views count card charges by the one card rule, with refunds netting (today they add every line as a positive amount), and fuel becomes its own ⛽ stream in the timeline, dated to the day it was bought (v2.4104 — `lib/jobs/jobCardChargeEvents.ts` for both the Job window's and Job Summary's timeline; the fuel family's tag is `pickFuelTag`, shared with Wheels). Burn's daily spend keeps fuel inside its parts bars. The Months view still spreads parts by field hours — dating fuel there is a follow-up if the owner wants it.
4. **Who is spending what** — (a) the office roles read the tags (shipped v2.4106, migration `20260929001119` — reading follows `is_office_staff()`; editing stays with Banking); (b) **People → Spending**, per the mock-up: any period (presets or a custom range); one row per person — card spend, ⛽ fuel, other (desktop only), on jobs, not on a job, and Office and Payroll where the period has any — plus *Company cards* and *Not tied to anyone*, everyone listed; a person opens to their jobs, their charges on supply invoices and the charges not on a job yet, each with *Put on a job*. Card charges only. Who a charge belongs to is its attribution (a person record with a login is that login), else *Company cards* on a company card, else the card's holder ("by card"), else *Not tied to anyone*; fuel is the job window's rule; on-a-job is the job splits — a charge is all on jobs or on none, since both split writes refuse splits that do not add up to the charge. A charge on a supply-house invoice counts On jobs and is listed under the invoice, so each job cell is the Job window's card line; the Office job is Office, not job cost; a payroll mark is its own column, not work to do, for the roles with payroll access (for the others the read leaves those charges out, as the Team purchases queue does, so totals differ by role by exactly them); a charge before Tally's sorting floor is labelled *before sorting began*, with no button. *Put on a job* opens today's Assign window: a held card saves as Team purchases does (`replace_mercury_job_splits_for_linked_card_as_staff`, for the holder), any other card through Banking's write; where the write would refuse (a master or assistant outside the holder's circle) there is no button and one line says who can. The data: `list_card_charges_window` (PR 4b-1, v2.4594) — every card charge in the window, all people, one read, shared with #72's team queue as its history.
5. **Review follows job cost** — Review stops taking vehicle-deal fuel off jobs; the person's vehicle charge covers only what is not already on jobs, so nothing counts twice; the per-person panel's fuel line comes with it.

## Found along the way

- **The cost timeline, Burn and "spent so far"** (the Job window's and Job Summary's) read every card line as a positive amount (`Math.abs`): no Internal Transfer or invoice rule, and a refund did not come off. Fixed in v2.4104.
- **Follow-up: Job Summary's print** (`jobSummaryCostBreakdown.ts`) does not take off card charges already on a supply invoice, so the printed parts can read higher than the table, and it folds fuel into parts.
- **Follow-up: dev-mcp `get_job`** still sums every card line (no Internal Transfer or invoice rule) — an edge deploy.
- **Follow-up: Review** takes a vehicle-deal person's fuel off the jobs (v2.2735) — PR 5.
- **Payroll-marked fuel — measured, not the problem feared.** A Tally payroll mark settles a card charge with no job (`tallyPayrollRules.ts`), so fuel the payroll rules marked would never reach a job's cost. #72's replay measured Jul 7 – Oct 5: 196 payroll-marked card charges, $82,630, exactly one of them fuel ($52), none with a job split — the payroll rules do not keep fuel off jobs. That slice is what People → Spending leaves out for a viewer without payroll access (the read's rule), so the tab says so in one line. A read of our own after the push repeats the count.
- **Follow-up: Wheels** (People → Vehicles) adds fuel by person with `Math.abs`, so a refund counts as more fuel, and by attribution only. It should read the Spending kernel (`lib/people/spendingRollup.ts`) for the same window.
- **Follow-up, naming: the Job window's "Card charges"** counts every Mercury allocation on the job, ACH included (`fetchJobMaterialsCostSnapshot` has no kind filter); People → Spending is card purchases only.
- **Follow-up: a job whose refunds outweigh its other card charges** — the Job window and Job Summary floor its card line at $0 (`jobCardChargesCountedFromLines`, `Jobs.tsx`), Review's `netCardChargesByJobId` keeps the net credit, and so does Spending (pinned in `spendingRollup.test.ts`).
- **Follow-up: fuel on a supply-house invoice** — the ⛽ line's slice (`tagSliceForOneJob`) keeps an invoice-linked fuel charge that the card total leaves out (clamped to it); Spending lists it under the invoice.
- **Card refunds were dropped from the Spending read — fixed v2.4611.** Mercury files a refund to a card as kind `other`, still carrying the card; the first read kept only the card kinds, so refunds did not come off (27 refunds, $1,083.34 over 90 days). Found by the comparison against the Job window: J667 matched to the cent on Spending, the Job window and Job Summary, and J363 (16¢), J1033 ($168.06) and J583 ($1,045.69) differed by exactly their refunds. Migration `20261005235207` keeps a card kind or any transaction carrying a card.
- **Follow-up: Wheels misses card refunds.** `splitFuelFamily` (`lib/people/wheels.ts`) counts a charge as card fuel only when `kind === 'debitCardTransaction'`, so a fuel refund (kind `other`) lands in the off-card label check and adds to it with `Math.abs`.
- **Follow-up: Review's vehicle-deal fuel rule misses card refunds.** `loadTeamReviewUnion.ts` takes a vehicle-deal person's fuel off jobs only when `kind === 'debitCardTransaction'`, so their fuel refunds stay on the jobs while the purchases leave — PR 5 replaces the rule, and should use the card rather than the kind.

## How to verify

- PR 1: a job with an Internal Transfer or an invoice-linked card charge allocated to it reads the same parts cost in the Job window as its Job Summary row, and the left-out lines carry their note.
- PR 2: a job with fuel on the card shows ⛽ Fuel & gas on the Job tab's Costs card and in Where the money went, for the same amount as the grey fuel line under its Job Summary Parts cell; Parts + fuel on the card equals the Job Summary Parts figure.
- PR 4b-1, after the push: `list_card_charges_window` for 90 days returns in well under a second; for three people, each job cell equals the card lines attributed to them in that job's Job window (⛽ marks included), and one job summed over everyone, with the period covering its life, equals its Card charges and ⛽ Fuel & gas (pick a job with no ACH allocation).
