---
name: "GC mode, Owner Billing O11: our own crew at its Pipeline cost, and general conditions at actual cost"
parent: to-dos/gc-mode/OWNER_BILLING_REAL_BUILD.md (PR 14, O11, the last two items of its "Later")
status: planned 2026-10-10 by Helper 5 at the lead's ask · read back to the lead before any code · cuts after Building's U8b is on main · nothing built · O11b's SQL below is its migration byte for byte but for the version and the stamp
---

# O11: what our own work really costs

## What it is

**What each job makes us** (Money's margin, `jobMargin` in `ownerBillingMargin.ts`, shown by `GcMoneyMargin.tsx`)
counts two things at a stand-in today. **Our own crew** counts at its price, so it never makes or loses anything.
**General conditions** count at their budget, so a superintendent kept three extra weeks costs us nothing on the
screen. The footnote says so: *Our own crews count at their price: their real cost is on their Pipeline jobs. General
conditions count at their budget.* O11 reads both from the Pipeline, where they are really spent.

- **O11a, our own crew at its Pipeline cost** (no migration). Building's U8 links each trade our own crew does to its
  Pipeline job (`gc_trade_packages.job_ledger_id`, U8a), and U8b lays that job's percent on the board
  (`selfPerform.pctDone`, `source`). O11a reads the same job's spend, the Costs tab's own way, and the margin counts
  our crew at what it will cost at today's pace.
- **O11b, general conditions at actual cost** (one migration, a press, the reads). Our number gains the Pipeline job
  where its general conditions are spent: the superintendent's time, the trailer, temporary power, the dumpsters. The
  margin counts them at that spend once it runs past the budget, and at their real cost once the job closes.

## What each reads

One read for both, from the Pipeline's own kernels, never a copy of them:

- **Per linked job**: `loadJobChargesTimelineInputs(job, includeTeamLabor)` (`useJobChargesTimelineInputs.ts`), then
  `buildJobChargeEvents` and `spendByComponent` (`jobChargesTimeline.ts`, `jobBudget.ts`): team labor (hours ×
  assignment × `people_pay_config.hourly_wage`), sub labor, card charges, fuel, supply-house allocations, tally parts
  and other job charges. That is the Costs tab's **spent so far**, to the dollar.
- **At today's pace**: `buildJobBurn`'s `eacUsd`, spent ÷ percent done, which is null below 10% or with fewer than 3
  field days. The percent is our crew's from U8b (`selfPerform.pctDone`), the same number Bill the customer bills.
- **Batched as Bid vs actual does it**: `useBidVsActualBurnInputs`' shape, one `jobs_ledger` read for every linked
  job, then the per-job loader 4 at a time. A GC project has one or two crews and one general-conditions job, so
  a page of building jobs reads a handful. A new `src/lib/gc/ownWorkCostIo.ts` (`loadOwnWorkCosts(jobIds)`) holds it,
  and a pure `src/lib/gc/ownWorkCost.ts` turns the rows into each job's spent and pace.
- **What we billed for it so far**: the last sent pay application's done to date on our crew's line (`doneToDate[pkg.id]`)
  and on the general conditions line (`doneToDate.gc`), already on the board (`ownerPayAppsSent`).

## The rules

**Our own crew** (a trade with `selfPerform`), per trade:

| Its Pipeline job | What it costs us in the margin | What the breakdown says |
|---|---|---|
| Linked, at least 10% done and 3 field days | `eacUsd`: what it will cost at today's pace; done (100%, or the Pipeline job billed), what it cost | *Plumbing · our own crew · signed for $26,000, about $22,100 at today's pace on Pipeline job J 1071 · $10,400 spent, 47% done* |
| Linked, too early | its price, as today | *…signed for $26,000 · $1,200 spent so far on Pipeline job J 1071, too early to say what it will cost* |
| Not linked | its price, as today | *…signed for $26,000, at its price: it has no Pipeline job yet* |
| Linked, and the reader cannot see pay | its price, as today | *…at its price: its labor cost is for those who see pay* |

**General conditions**, per project:

| Its Pipeline job | What they cost us in the margin | What the breakdown says |
|---|---|---|
| Linked, the job not closed | their budget, or what is spent once it passes the budget | *General conditions $138,000 · $61,200 spent so far on Pipeline job J 1080* (and *$4,300 over their budget* past it) |
| Linked, the job closed | what they cost | *General conditions cost $131,500 of their $138,000 budget* |
| Not linked | their budget, as today | *General conditions $138,000, at their budget: no Pipeline job yet* |

General conditions are time, not work done, so a pace from the percent would be a guess. An overrun counts the day it
happens; a saving counts when the job closes.

**Earned so far** stops being a share of a plan for our own work. Today it is the margin × the share billed. With
O11, the trades we hire and the fee stay as billed, and our own work is real money: what we billed for it less what it
cost so far. That is our crew's line billed less its Pipeline spend, and the general conditions line billed less theirs.

**Labor dollars only for those who see pay.** The Pipeline's labor dollars come from `people_pay_config`, which RLS
opens to `has_payroll_access()`: dev, the controller and a pay-approved leader. A leader who is not pay-approved
reads $0 labor with no error. So the page asks `has_payroll_access()` once, and without it our own work counts at
its price and budget, with the words above. Materials and the rest never count without the labor beside them.

**One job, counted once.** A Pipeline job linked to general conditions and to a crew, or to two crews, would count its
spend twice. The general conditions picker refuses a job a crew holds. The kernel counts a job once, in the first
place that holds it, and the breakdown says *also on Plumbing* where it shares.

## Who sees it

The money team (`canSeeGcMoney`: dev, the leaders, the controller), as today for Money and Closeout; labor dollars
within it only for `has_payroll_access()` (above). The link press for general conditions is the money team's, through
`gc_project_money`'s own policy (`gc_project_money_team`, `gc_money_team()`), with its training-mode and twin fences.
Our crew's link stays Building's (`gc_link_crew_job`, a dev's until Building's door).

## What changes on the screens

**Money's margin (`GcMoneyMargin.tsx`)**:
- The table gains **Our own work** between Change orders and Makes us: our crews' and general conditions' over or
  under, in the same signed form (*+$3,900*, *−$4,300*, *—*).
- The breakdown's crew lines and its general conditions line read as the tables above.
- The footnote becomes: *Our own crew counts at its Pipeline job's cost at today's pace, and general conditions at
  their Pipeline job's spend once it passes their budget. One with no Pipeline job counts at its price or budget, as
  before. A trade not bought out yet counts at what we carry for it.*
- The headline (*Across our 3 jobs we make $X on $Y*) and *earned so far* read the new margin and earned.

**Our number (`GcOurNumber.tsx`)**: under General conditions, *Its costs land on Pipeline job J 1080* with **Change**,
or **Name the Pipeline job its costs land on**, a picker (`search_jobs_ledger`, billing-only jobs left out), for the
money team.

**Closeout (`GcCloseoutWindow.tsx`)**, money team only as today:
- Our crew's line: *Plumbing: our own crew, 100% done. It cost $24,300 on Pipeline job J 1071, against $26,000
  signed. Nothing is held. Its closeout runs on the Pipeline.* (Not linked: today's words.)
- A general conditions line: *General conditions cost $131,500 of their $138,000 budget on Pipeline job J 1080.* or
  *General conditions have no Pipeline job, so they count at their budget.*
- Closed: *The job made us $X, Y% of the price, with our own crew and general conditions at what they cost.*

**The guide** `see-the-money-on-our-gc-jobs` gains *Our own work*: what the two lines read and when, the pay rule
and naming general conditions' Pipeline job. `close-out-a-trade-and-close-a-gc-job` gains the closed line.

## O11b's SQL (byte for byte at the cut, but for the version and the stamp)

```sql
SET lock_timeout = '3s';

-- GC mode, Owner Billing's O11b (v2.NNNN): general conditions at actual cost. Our number names the Pipeline job
-- where a GC project's general conditions are spent (the superintendent's time, the trailer, temporary power), and
-- Money's margin reads that job's spend the Costs tab's own way. The money team names it, through
-- gc_project_money's own policy and fences; deleting the job lets go of it. Additive and idempotent; no table is
-- created, so the three fence calls are not needed.

ALTER TABLE public.gc_project_money
  ADD COLUMN IF NOT EXISTS general_conditions_job_id uuid REFERENCES public.jobs_ledger(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.gc_project_money.general_conditions_job_id IS
  'GC mode (v2.NNNN, Owner Billing O11b): the Pipeline job our general conditions are spent on. Money''s margin and Closeout read its spend (labor, materials, other charges) as their actual cost. The money team names it (gc_project_money_team); null: they count at their budget.';
```

## Tests

**O11a (kernel and render)**:
- `ownWorkCost.test.ts`: the events to spent and pace; too early under 10% or 3 field days; done at 100% or billed;
  labor hidden; a job counted once.
- `ownerBillingMargin.test.ts`: our crew at its pace, too early, not linked and hidden; **Our own work** in the
  margin; earned so far as billed less spent; the sums across jobs.
- `GcMoneyMargin.render.test.tsx`: the column, each breakdown line, the new footnote.
- `GcCloseoutWindow.render.test.tsx`: our crew's cost line, today's words when not linked.

**O11b (the bed, the kernel, the render)**:
- SQL bed `supabase/tests/gc_owner_billing/94_gc_job.sql`:
  - the column, nullable, with its foreign key `ON DELETE SET NULL`;
  - the controller and the owner name a job and clear it;
  - an estimator does not;
  - a training account and a twin are stopped by the fences;
  - deleting the job lets go of it.
- Four mutants: the foreign key `ON DELETE CASCADE` (deleting the job would drop our number); the column `NOT NULL`
  (every project would need a job); a policy opening the write to the office team; the column on `gc_projects`
  (the office team would write it).
- `ownerBillingMargin.test.ts`: general conditions at budget until passed, then at spend; at cost once closed; not
  linked; the earned so far.
- `GcOurNumber.render.test.tsx`: the line and the picker; the picker refuses a job a crew holds.
- `GcCloseoutWindow.render.test.tsx`: the general conditions line and the closed line.

## The calls this adds

1. **Our crew at today's pace, not just spent so far.** Default: `eacUsd`, the Costs tab's own figure, so the two
   screens agree. Other ways: spent so far only, or the Pipeline job's bid budget (`job_budgets`).
2. **Direct cost only.** Default: no overhead share. The fee covers our overhead on a GC job, so the Pipeline's
   overhead share would count it twice. Other way: the Pipeline's true margin.
3. **General conditions: an overrun at once, a saving at close.** Default, since they are time and a pace from the
   percent would be a guess. Other way: spent ÷ the share billed.
4. **Where general conditions land: their own Pipeline job.** Default: one job per GC project, named on Our number.
   Other way: the billing job, which is billing-only, so no one clocks in on it and the pickers leave it out.
5. **Without pay access, at price and budget.** Default, so no screen shows a cost with its labor missing. Other way:
   the materials alone, marked as such.
6. **O11a waits for U8b**, which lays our crew's percent and source on the board. O11b can cut before it, since its
   job is ours to name.

## Seams

- **Building (gc 4)**: U8b's `selfPerform.pctDone` and `source` are this plan's percent. U8's picker should refuse a
  Pipeline job another crew trade holds, as this plan's general conditions picker does, so no job counts twice. Our
  crew's read takes O9's gate, as U8 amendment 2 already says.
- **The Pipeline**: the per-job loader reads `list_tally_parts_with_po` without paging. The Costs tab has the same
  1,000-row cap, so the two agree and stay wrong together. A paged read is the Pipeline's to fix, and both would gain.
- **The board (gc 2)**: `GcOurNumber.tsx` gains the line and the picker under General conditions.

## Is this the best we can do?

It reads our own work's cost where it is really kept, with the Pipeline's own math, and says where each number comes
from. It could be better three ways:

1. **One batched cost read.** Each linked job costs six reads today. A Pipeline RPC that gives several jobs' spend at
   once would serve Bid vs actual, Job Summary and this page together.
2. **General conditions from the schedule.** Most general conditions are weeks. With the schedule's weeks, the margin
   could count them at their weekly burn × the weeks left, and catch an overrun before it lands.
3. **A saving shown as it builds.** The margin could show a general-conditions saving as *likely* before the close,
   apart from the margin, the way contingency not spent is shown today.
