---
name: "A cost timeline for a development: the site's cost, cash and value over time, for devs and controllers"
number: 257
group: ready
status: built 2026-11-04 · PR 1 the view, the cost and cash lines, the job chips, the job-naming tooltip and the batched reads v2.6493 on claude/site-cost-timeline-e043ae, walked live on the real site as the dev at three widths · PR 2 the amber overhead band v2.6498 · PR 3 value created and Print v2.6499 · walked on prod in the owner's Chrome 2026-11-08 at desktop and 375, two defects noted below · the owner's two picks from the mock-up 2026-11-08: the phone's view switch stays A, and the jobs with no dated event get the ledger strip · PR 4 the ledger strip v2.6711 on claude/257-ledger-strip-pr4-f031bd, walked on the dev server as the dev on the real development at 1280 and 375 wide, light and dark, 2026-11-08 · the two walk defects fixed, v2.6718 on claude/257-end-labels-cent-pr5 (stacked on PR 4), the end labels measured apart at both widths
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
next: nothing left to build. Once v2.6711 and v2.6718 are on main, delete this card.
size: M (PR 1 the view, the two lines, the chips, the reads) + S (PR 2 the overhead band) + M (PR 3 value created, Print / Save as PDF) + S (PR 4 the ledger strip, one kernel change, one view block, the print's rows, the guide's words)
blocker: None.
mockup: site-cost-timeline-before-after.html — the owner's two calls drawn (2026-11-08): the jobs with no dated charge or payment, today's count line beside a grey ledger strip under the chart, and the phone's view switch, A as built beside B, at 375 wide and on a computer; the build itself needed none, the chart is the Job Summary's at the site's scale and the owner approved the written draft in chat on 2026-11-03
ver: v2.6493 · v2.6498 · v2.6499 · v2.6711 · v2.6718
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
  the chart's end plus the strip is the Scoreboard's cost before overhead; it says why not a bar at
  the right edge or the kernel's "No date" bucket. **The owner picked the strip on 2026-11-08**, and
  PR 4 built it the same day (v2.6711): the strip, a name press opening the job, the sum line, the
  print's rows and the count line's new words.
- **The phone's view switch.** With three chips, *Where the money is* stacked four lines tall at 375
  wide. PR 1 lays the three on one full row in the card's head with the GC Review link under them
  (placement A, built); the other placement, a chip row at the top of the card's body at every
  width (B), was mocked live. The mock-up (part 2) drew A and B at 375 wide and on a computer, where
  B costs one more row inside the card, about 30 px, before the job chips. **The owner picked A on
  2026-11-08**: the built placement stays, nothing to build.
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
4. **PR 4 (v2.6711)** · the ledger strip under the chart for the jobs with no dated charge or
   payment, the owner's pick from the mock-up 2026-11-08. The brief it was built to is the next section.

## PR 4, the ledger strip (built 2026-11-08, v2.6711)

Built as written below, with two small departures: the reason's nouns are *sub labor sheet*, *team
labor day* and *fuel charge* where the source's name alone would not read, and the strip holds to the
whole site's end (`siteEndExpense` on the model) when a chip narrows the chart, the simpler of the two
ways offered. The picture is part 1's AFTER panel
of `site-cost-timeline-before-after.html` (open it from the repo, or at
`clicktooling.com/to-dos/site-cost-timeline-before-after.html`): a grey strip under the chart's key,
one row per left-out job, a sum line that reconciles to the Scoreboard. What ships today is the one
count line, *N jobs with no dated charge or payment are left out.*

- **Kernel** `src/lib/developments/siteTimeline.ts`, pure, tested. `buildSiteTimeline` keeps
  `leftOut` and adds `leftOutJobs: SiteTimelineLeftOutJob[]`, one per job `siteJobHasDatedEvent`
  refuses, in the order given (the Money look's order): `{ jobId, label, endExpense, undated: { source:
  JobChargeSource; count: number }[] }`, `endExpense` the `round2` sum of the job's charges, undated
  ones included (a job with only an undated sub sheet holds its cost here and nowhere on the chart
  today). `siteTimelineLeftOutReason(job)`: with undated charges, the counts by source joined with
  *and* over `JOB_CHARGE_SOURCE_META[source].name` lowercased, then *with no date · date it and the
  job joins the chart* (*1 sub labor sheet and 2 card charges with no date · date them and the job
  joins the chart*; *it* for one, *them* for more); with no charge at all, *nothing charged yet*.
  `siteTimelineLeftOutWords(n)` changes to *N jobs have no dated charge or payment. They are listed
  under the chart.* (*1 job has … It is listed …*). `siteTimelineStripSum(model)` returns `{ chartEnd:
  data.endExpense, offChart, together }` with `offChart` the sum of the left-out jobs' `endExpense`;
  `together` is the Scoreboard's Labor + Subs + Parts, its Cost tile less Overhead, by the parity the
  existing test holds (the events sum to `jobCostsFromRows`' totals). A selection narrowing the chart
  does not change the strip: the left-out jobs are the site's, and the sum line then reads the
  narrowed chart's end honestly, so name the sum line *All jobs' chart ends at* when the chart is
  narrowed, or simpler, hold the strip's sum to the whole site's end (`buildSiteTimeline` with an empty
  selection) and say so in the test.
- **View** `src/components/developments/DevelopmentTimeline.tsx`: under the chart's key, above the
  *Print or save as PDF* row, when `leftOutJobs.length > 0`, a strip on `var(--bg-subtle)` with a
  `var(--border)` edge and 6 px radius, font 0.76rem: a head row *Not on the chart · N jobs* left and
  *no dated charge or payment* right in `var(--text-muted)`; one row per job, the job's label as a
  `LinkButton` calling a new prop `openJob?: (jobId: string) => void` (the page passes its `openJob`,
  the one `DevelopmentMoney` takes), the reason words muted, the cost tabular and right-aligned with
  `$0.00` muted; a last line over a `var(--border-strong)` rule, right-aligned, *Chart ends at $X ·
  Not on the chart $Y · Together $Z, the Scoreboard's cost before overhead*. Nothing is drawn when no
  job is left out, so a site where every job is dated reads as today. On a phone the reason wraps
  under the label (two columns, the reason on its own line); nothing past the edge at 375. Test ids
  `timeline-strip`, `timeline-strip-row-<jobId>`, `timeline-strip-sum`. The scope line keeps the new
  words from the kernel.
- **Print**: `siteTimelinePrintHtml` gains `stripLines?: readonly string[]`, drawn under the key lines
  in the `.key` size, left-aligned: the head, one line per job *JP617 · 1 sub labor sheet with no date ·
  $3,480.00*, the sum line; the view builds them from the model with `formatCurrency`.
- **Tests**: `siteTimeline.test.ts` (the left-out jobs in order with cost and reason; a job with only
  undated charges carries its cost; a job with no event is $0 *nothing charged yet*; the sum and that
  `together` equals the jobs' `jobCostsFromRows` total; the new words, singular and plural; the print's
  strip lines), `DevelopmentTimeline.render.test.tsx` (the strip's rows and sum; a label press calls
  `openJob` with the id; no strip when every job is dated; the print html carries the rows; the scope
  line's new words, which changes the existing expectation *2 jobs with no dated charge or payment are
  left out.*), and `DevelopmentPage.timeline.render.test.tsx` only if the prop wiring needs a line.
- **Guide** `src/content/help/see-everything-on-a-development.md` → *Read the timeline*: replace *A
  job with no dated charge or payment is not a chip. One line counts how many were left out.* with
  *A job with no dated charge or payment is not a chip. It is listed under the chart with its cost and
  why it is off the chart. Press the job's name to open it. The last line adds the chart's end and
  the list. That sum is the Scoreboard's cost before overhead.* Plain words hold (no sentence over 20
  words, no dashes, parentheses or semicolons); `helpGuidePlainWords.test.ts` checks.
- **Docs**: the release note `src/content/releaseNotes/v2.NNNN.ts` (title *The site's cost timeline
  lists the jobs it cannot draw*, bullets in user words) and `docs/recent-features/v2.NNNN.md`; this
  card's `ver`, status, next and The decision; the mock-up page's picks box; `docs/GLOSSARY.md`'s
  *Development page* entry if its Timeline sentence names the count line. Keep the two defects under
  Where it stands listed, they are not this PR's.
- **Verify live** as the dev on the real site (the 2026-11-08 walk saw seven jobs left out there): the
  strip lists seven with their reasons, the sum line's *Together* equals the Scoreboard's Cost tile
  less its Overhead to the cent, a label press opens the job, the print carries the rows; 375 and
  1280 wide with nothing past the edge, light and dark.

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

## Where it stands

2026-11-08: walked on prod (v2.6691) in the owner's Chrome, signed in as the owner, on the real development's Money look. The Timeline chip opens the view; the red cost and green cash lines draw every dated job; the job chips narrow the chart (one chip's end read its own cost); the tooltip names the job and the source on a step (*JP603 · 4 card charges*, with Cost, Paid and Cash position under it); the amber band sits on the red line from where office cost begins and the end reads *true cost*; **Value created (right axis)** adds the blue line and the right scale; **Print or save as PDF** opens one landscape page with the site's name, the scope line, the four ends in words, the chart as the screen drew it, the key and the printed-by stamp. At 375 wide the three view chips share one row (placement A as built), the job chips wrap to four rows, and nothing runs past the edge. Screenshots, in the walking session's scratchpad: `257-timeline-1400`, `257-timeline-value-created-1400`, `257-tooltip-names-job-1400`, `257-chip-narrowed-JP1091-1400`, `257-key-and-print-press-1400`, `257-print-page-captured`, `257-money-card-375-placement-A`, `257-end-labels-zoom-1400`.

The owner's two calls, with what the screenshots show: (1) the jobs with no dated event are only a count in the line under the chips (*7 jobs with no dated charge or payment are left out*), and the value line adds every job with no dated percent as one step at the chart's end, a cliff on the last day; (2) placement A at 375 puts the three chips on one row with *Where the money is* on two lines inside its third and the GC Review link under them. The owner picked A from the mock-up on 2026-11-08, so (2) is closed and nothing is built for it; on 2026-11-08 he also picked the ledger strip for (1), specified above under Ready to build.

2026-11-08, PR 4 (v2.6711) walked on the dev server as the dev on the same development at 1280 wide: the strip sits under the chart's key with *Not on the chart · 7 jobs* and lists the seven, JP958, JP957, JP956, JP955, JP954, JP568 and JP467, each *nothing charged yet* at $0.00 (none of this site's undated jobs carries a charge, so the strip's cost column is all zeros here; the undated-cost case is held by the tests); the sum line reads *Chart ends at $1,031,650.16 · Not on the chart $0.00 · Together $1,031,650.16*, and the Scoreboard's tiles agree, Labor $136,012 + Subs $0 + Parts $895,638 and Cost $1,054,120 − Overhead $22,470, both $1,031,650 (the tiles show whole dollars; the cent is the parity test's); pressing JP958 opened its Job window; **Print or save as PDF**, with the window captured, carried the head, the seven lines and the sum line under the key. At 375 wide the strip is two columns, the reason under the name, nothing past the edge; the dark theme draws it on the subtle surface with the strong rule. Left as the chart draws them: the two defects below, the next PR's.

Two defects the walk found, fixed the same day as v2.6718 (`docs/recent-features/v2.6718.md`): the end labels crowded at the right edge at every width, the *true cost* label over the cash and cost labels and the red label half under the icons, and at 375 the three overlapped each other, so the shared chart now draws every end label in one layer as a column placed by `src/lib/jobs/chartEndLabels.ts`, apart from each other and from the marks their text reaches (measured on the dev server from the drawn SVG at 1280 and 375: no label touches another or an icon; on the phone the cost labels stand above the end's icon rows); and a chip's title (*JP1091: $8,838.88 of cost so far*) read a cent under the chart's own end label for the same job ($8,838.89), a sum of rounded folded lines against the sum rounded once, so the fold keeps the exact sum and the kernel rounds once (the site's end moved from $…650.16 to $…650.15, the strip's sum with it).
