---
name: "A cost timeline for a development: the site's cost, cash and value over time, for devs and controllers"
number: 257
group: close
status: built 2026-11-04 · PR 1 the view, the cost and cash lines, the job chips, the job-naming tooltip and the batched reads v2.6493 on claude/site-cost-timeline-e043ae, walked live on the real site as the dev at three widths · PR 2 the amber overhead band v2.6498 · PR 3 value created and Print v2.6499 · left: the owner's two calls below
summary: >
  The owner saw the Job Summary's Charges & Value chart, the step chart of one job's cost to date and
  cash position with an icon on every charge, and asked for the same chart over a whole development,
  for devs and controllers only. It is the Money look's third view, Timeline, beside Where the money
  is and the Scoreboard: every job's charge events merged in date order on one red line, the cash
  position in green, the overhead day share as the amber band, value created on the opt-in right
  axis, and a tooltip that names the job behind each step. Chips above the chart narrow it to one or
  more jobs. The kernel is the Job Summary's own, with a job id on its events, so the red line ends at
  the sum of the jobs' Job Summary costs by construction; the reads are the site's batched reads,
  never one round per job.
next: the owner's two calls, the jobs with no dated event and the phone's view switch; then delete this card.
size: M (PR 1 the view, the two lines, the chips, the reads) + S (PR 2 the overhead band) + M (PR 3 value created, Print / Save as PDF)
blocker: None.
mockup: site-cost-timeline-before-after.html — the owner's two calls drawn (2026-11-08): the jobs with no dated charge or payment, today's count line beside a grey ledger strip under the chart, and the phone's view switch, A as built beside B, at 375 wide and on a computer; the build itself needed none, the chart is the Job Summary's at the site's scale and the owner approved the written draft in chat on 2026-11-03
ver: v2.6493 · v2.6498 · v2.6499
opinion: build — the kernel, the chart view and every read exist; the work is a job id on the events, one batched read per source over the site's jobs, and a chip row
---

# A cost timeline for a development (#257)

## The ask

The owner, 2026-11-03:

> In jobs, job summary, there is this visual chart that shows the timeline of expenses and profit, I
> would like to create one for a new devs and controllers only section of the Development pages.

He approved the written draft the same day and asked for it in its own session.

## The decision

- **Where.** Inside the Money look as its third view, **Timeline**, beside *Where the money is* and
  the Scoreboard (punch list #250 drew the three chips and named the timeline as the third). The
  device remembers the view, as it does the Scoreboard. Dev and controller only (`canSeeSiteCosts`):
  a master, an assistant or an estimator sees two chips, never a third.
- **What it draws**, all summed over the site's jobs, in the Job Summary chart's own colours:
  **red** cost to date, every job's charge events merged in date order, each step with its source
  icon (supply-house invoices, card charges, fuel, tally parts, other charges, sub labor, team labor);
  **green** cash position, payments received minus cost, rising only on a payment; **amber** (PR 2)
  overhead landed so far, stacked on cost so true cost reads on top, from `useSiteOverhead`'s day
  lines; **blue** (PR 3) value created, each job's percent times its revenue, behind the existing
  opt-in right-axis toggle.
- **The tooltip names the job**: one line per job and source on the day, *JP603 · 3 card charges*,
  biggest first.
- **Job chips** above the chart narrow it to one or more jobs; *All jobs* is the default, the chips
  in the Money look's section order. A job with no dated event is left out, and one line counts how
  many. Open question for the owner: whether those jobs should be shown another way. The mock-up
  (`site-cost-timeline-before-after.html`, part 1) draws today's count line beside the strongest other
  way, a grey ledger strip under the chart that lists each such job with its cost and its reason, so
  the chart's end plus the strip is the Scoreboard's Cost figure; it says why not a bar at the right
  edge or the kernel's "No date" bucket. Awaiting the owner's pick.
- **The phone's view switch.** With three chips, *Where the money is* stacked four lines tall at 375
  wide. PR 1 lays the three on one full row in the card's head with the GC Review link under them
  (placement A, built); the other placement, a chip row at the top of the card's body at every
  width (B), was mocked live. Open question for the owner: A or B. The mock-up (part 2) draws A and
  B at 375 wide and on a computer, where B costs one more row inside the card, about 30 px, before
  the job chips. Awaiting the owner's pick.
- **Reads start only when the view opens**, as the Scoreboard's do, and every one is batched over
  the site's jobs and paged: the cost rows are the ones `useSiteCosts` already reads for the Costs
  column and the Scoreboard (with their dates), so the Timeline, the column and the board say one
  number; the clock's rows are `useSiteLabor`'s, kept by day; the fuel split reads the tags and
  labels once for the site's card charges; PR 3 reads the reports and the hand-set percents by job
  id in one chunked read each.
- **Parity by construction**: `siteTimeline.test.ts` proves the site's end expense equals the sum of
  each job's own end expense, and that the events built from the cost rows sum to `jobCostsFromRows`'
  totals, the Costs column's figures, which are the Job Summary's cost columns.

## Where it plugs in

- The kernel `src/lib/jobChargesTimeline.ts`: `JobChargeEvent`, `JobPaymentEvent` and `JobValueEvent`
  gain an optional `jobId`; nothing the Job Summary chart draws changes.
- The site kernel `src/lib/developments/siteTimeline.ts` (new, pure, tested): the events per job from
  the site's cost rows and the clock's days, the fold per job and source, the merge, the chips' order,
  the jobs left out, the chart data through `buildJobChargesTimelineChartData`.
- The reads: `useSiteCosts` keeps the rows it read (dates added to the sheet and other-charge
  selects, the bank category on the card embed); `siteLabor.ts` keeps each person's days;
  `useSiteTimeline` (new) reads the fuel ids; `useSiteValueEvents` (new, PR 3) the reports and hand-set percents by job id.
- The view: `DevelopmentTimeline.tsx` (new) over the shared `JobChargesTimelineChartView`; the third
  chip and the view's state in `DevelopmentPage.tsx`; `MoneyView` gains `timeline`.
- No migration. No edge function.

## The PR train

1. **PR 1 (v2.6493)** · the view, the red and green lines, the job chips, the job-naming tooltip, the batched
   reads, the parity test, the guide's words, the glossary and access-control lines.
2. **PR 2 (v2.6498)** · the amber overhead band from `useSiteOverhead`'s lines (the hook keeps them), the true
   cost on top, the tooltip's overhead lines.
3. **PR 3 (v2.6499)** · value created on the right axis from the site's reports and hand-set percents, and
   Print / Save as PDF.

## How to verify

- `npm test` on `siteTimeline.test.ts`: the parity above; events merged in date order; the fold per
  job and source; the chips narrowing; the jobs with no dated event counted and left out; a job's
  team labor by day.
- Render smokes: `DevelopmentTimeline.render.test.tsx` (the chips, All jobs the default, narrowing,
  the count line, reading and failed states); the page tests hold that a master sees no Timeline
  chip and that the view opens for a dev.
- Live, as the dev on the real site through the dev server: the view draws; the red line's end
  equals the sum of the jobs' Costs figures on the Jobs & bids table; a chip narrows to one job and
  its end equals that job's Job Summary cost; a master, an assistant and an estimator see no Timeline;
  screenshots at 375, 768 and 1280 wide with nothing past the edge.
