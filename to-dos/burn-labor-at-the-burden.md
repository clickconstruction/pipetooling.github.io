---
name: "A job's burn prices labor at the burden, so burn and budget are measured the same way"
number: 448
group: close
status: asked and decided 2026-11-27 · Taunya's *Yes, burn at the burden* to the sheet that asked *Should burn price labor at the burden too?* · read the same day from the code on main · a mock-up of the Costs tab drawn the same day with two homes for the one new line, and A picked, *Picks stand* · built the same day as v2.8731, client only, the multiply on the events before the burn's kernel · not walked live
summary: >
  A job's budget prices its labor hours at the crew rate, which is the average field wage times the
  burden factor, 1.20 today. The job's burn prices the hours actually worked at raw wages. So the two
  sides of one comparison use two rulers, and the burn reads about a sixth kinder than the bid. On the
  sheet's own example, 100 hours at a $30 wage are budgeted as $3,600 and burn as $3,000. Taunya's
  answer is to price the burn's labor at the burden too. The Costs tab keeps showing the wages paid.
next: A look that writes nothing, once v2.8731 is live. On a ZZ Test job with clocked hours and a price, open the Costs tab. Read **Where the money went**, Team labor, and the line on the **Spent so far** tile. The line's wages are the table's Team labor, and its result is the wages times 1.20. On Job Summary the same job's Burn agrees with the job's window, and its Labor column is the wages. Then this card is retired.
size: S, built as one PR; left: a look (XS)
mockup: to-dos/burn-labor-at-the-burden/mockup.html
ver: v2.8731
blocker: none
opinion: built as A — one multiply on the way into the burn, and the line that says so on the tile; retire it on a clean look
---

# A job's burn prices labor at the burden (#448)

## The ask

Taunya, 2026-11-27, on the close-out sheet's calls. The team scorecard's call 2 asked whether the burden
belongs on the scorecard. She asked first where the burden adds into the app, and whether office labor
already split out to overhead makes it a double count. The read of the code said it does not: office labor
is in the overhead pool, and the burden is a multiplier on field wages. Her answer on the scorecard was
*for the 1.2, leave it*.

She was then asked *Should burn price labor at the burden too?*, with the example of 100 hours at a $30
wage, budgeted as $3,600 and burning as $3,000. Her answer:

> Yes, burn at the burden

The option she picked read: a new small card, the burn's labor priced at wages times 1.20 so burn and
budget are measured the same way, and the Costs tab keeps showing real wages paid.

## What the app does today

- **The burden factor** is one setting, `app_settings.labor_burden_factor_v1`, seeded at 1.20 on
  2026-09-11 (v2.3291). The code's note says what it stands for: taxes, insurance and the truck, as a
  multiplier on a recorded field wage. It is held between 1 and 3 (`parseLaborBurdenFactor`).
- **The budget side uses it.** A bid's crew rate is the average recorded field wage over 90 days times the
  burden (`crewRate.ts`, v2.3294). A job's budget prices the award's hours at that rate
  (`awardBaseline.ts`, `lineBudgets.ts`).
- **The burn side does not.** `buildJobBurn` in `src/lib/jobs/jobBurn.ts` adds up the job's charge
  events as they are. A `team_labor` event is hours at the person's raw wage.
- **So one comparison uses two rulers.** Spent over percent done gives the cost at completion, and the
  budget it is held against is about a fifth larger per labor hour than what the burn counts.
- The superintendent scoreboard (v2.6666) and the team scorecard (v2.7325) already price labor at the
  burden. The Costs tab, Job Summary's Labor column, Crew P&L and pay stubs show raw wages.

## The decision

The burn's labor is priced at wages times the burden factor. Nothing else changes its ruler:

- **Changes:** the burn's spent, its burn a field day, its cost at completion, its projected margin and
  the verdict that reads them.
- **Does not change:** the Costs tab's labor lines and totals, which stay the wages paid. Job Summary's
  Labor column. Crew P&L. Pay stubs. The overhead pool. Subs and parts inside the burn.

## Where it plugs in

- **The kernel:** `src/lib/jobs/jobBurn.ts`, `buildJobBurn`. Team labor is the `team` bucket, chosen by
  `sourceBucket` from a charge event's `source`.
- **The edge copy.** `jobBurn.ts` is copied to `supabase/functions/_shared/gcKernels/lib/jobs/`. A change
  inside it changes the copy, and every function that reads the copy reads as behind until it is
  deployed. Scaling the `team_labor` events in the loader, before they reach the kernel, keeps the kernel
  as it is and the PR client only. The build picks one and says why.
- **The setting's read:** `readScorecardSettings` in `src/lib/scorecard/scorecardReads.ts` already reads
  the factor for the scorecard. The burn's loaders need the same read once.
- **The screens that draw the burn**, each of which changes its numbers and none its layout:
  - a job's window, the Costs tab: the burn section (`JobCostsBurnSection.tsx`) and its charts
    (`JobCostsTabCharts.tsx`);
  - Job Summary: the Burn column and the header's words (`jobSummaryBurn.ts`, `JobsJobSummaryTab.tsx`,
    `jobSummaryHeaderWords.ts`);
  - the Pipeline: the overview and the money opportunities (`PipelineOverview.tsx`,
    `PipelineMoneyOpportunities.tsx`), which read the burn through `jobBurnForVerdict.ts`;
  - the printed costs packet (`jobsDocuments/jobCostsPacket.ts`);
  - GC mode's own-work cost (`lib/gc/ownWorkCost.ts`), which reads the same early thresholds. Check
    whether it reads the burn's spent before the build, and say in the fragment what it does.
- **The footings:** `useJobBudgetFootings.ts` and `jobBudget.ts` read the burn against the budget. Their
  tests hold numbers that will move.

## What is new

- One multiply: team labor in the burn times the burden factor.
- One line in the burn section, in plain words, saying its labor is priced at the burden and that the
  Costs tab above shows the wages paid. Without it the burn's labor and the Costs tab's labor are two
  numbers for one thing with no reason given.
- The same sentence in the guide that explains the burn.

## The plan

One PR, S.

1. Read the factor where the burn's inputs are loaded.
2. Price team labor at the burden for the burn alone, in the kernel or in the loader, by the edge copy's
   cost.
3. The burn section's one line, and the costs packet's.
4. The tests: the kernel's, the Job Summary burn's, the footings', the verdict's.
5. The guide, the release note, the fragment, and the glossary's line on the burn.

If the multiply goes inside the kernel, the PR also regenerates the edge copy and owes a deploy of each
function `npm run check:edge-drift` then names. That is the reason to try the loader first.

## How to verify

- **Unit:** a job with 100 labor hours at a wage of 30 and a burden of 1.20 burns 3,600 of labor, where
  it burned 3,000. Subs and parts are unchanged. A burden of 1 gives the old numbers. A setting that is
  missing or outside 1 to 3 falls back to 1.20, as the scorecard's does.
- **Render:** the burn section shows its one line, and the Costs tab's labor total above it is the wages
  paid, unchanged.
- **Live, a look that writes nothing:** on a ZZ Test job with clocked hours and a price, read the Costs
  tab's labor total and the burn's spent. The burn's labor is the tab's labor times the factor. On Job
  Summary the same job's Burn column agrees with the job's window.
- **A job that was reading on budget may read over.** That is the change working, not a fault. Say so in
  the release note.

## Is this the best we can do?

- **One factor for everyone.** The burden is one number for the company. A crew with a higher real
  burden reads kinder than it is, as it already does on a bid. Splitting the factor into tax, comp and
  benefits was left out of the scorecard on purpose (card #360), and nothing here needs it.
- **The truck.** The burden's note counts the truck. Fuel is a job cost of its own (card #52), and
  whether truck costs also reach the overhead pool was not settled by the read. The burn leaves overhead
  out by design, so the burn cannot count the truck twice, but the true margin at completion adds
  overhead and might.
- **The other way was to take the burden off the budget.** It would make the burn agree with the bid by
  cheapening the bid's labor, which is the wrong direction: the bid's rate is what the job was sold at.

## Where it stands

**Built 2026-11-27 as v2.8731, one PR, client only.** The fragment is `docs/recent-features/v2.8731.md`.

- **The mock-up came first**, `mockup.html` in this card's folder: the Costs tab's tiles, the by-section table and Where the money went, before and after, on a made-up job. It drew two homes for the one new line. The person at the keyboard that day picked **A**, *Picks stand*: the line on the **Spent so far** tile, and the wages and the factor in the Labor row of the by-section table.
- **The multiply is on the way in, not in the kernel.** `src/lib/jobs/burnAtBurden.ts` prices each `team_labor` event at its wage times the factor before the events reach `buildJobBurn`. `jobBurn.ts` and its edge copy are as they were, so no function is behind and nothing is deployed.
- **What this card called the burn section is the Costs tab's verdict now.** The four-tile Burn section of `JobCostsBurnSection.tsx` is no longer drawn by the tab; the tab draws the verdict (`JobCostsVerdict.tsx`), one chart and a folded detail. The line went on the verdict's **Spent so far** tile.
- **Where it reaches:** the Costs tab's tiles, by-section table, chart and daily bars; the printed costs packet; Job Summary's Burn column; the Pipeline's burn card; Bids → Bid Costs → Bid vs actual.
- **GC mode's own-work cost** was read, as this card asked. It adds up a job's charge events and does not read the burn, so it is a job's spend at wages paid and is left so.
- **Settings → Data & recovery → Labor burden factor (dev)** now lists a job's burn under *Where it reaches*.
- **Not changed, and worth its own read:** the line budgets under the verdict (`JobCostsLineBudgets`) still take labor at wages against a budget in hours at the crew rate.

**Not walked live.** The look in `next` is what is left.
