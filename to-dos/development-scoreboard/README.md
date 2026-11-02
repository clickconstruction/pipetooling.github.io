---
name: "A scoreboard for a development: its jobs, their money, and who put what in"
number: 250
group: gated
status: design 2026-11-02 · the mapping, four ways weighed, the mock-up drawn over made-up data and rendered at 1280 and 375 · waits on the owner's read and six calls · nothing built
summary: >
  The owner saw the game Squad's end-of-match scoreboard and asked for its shape on the Development
  page: one grid where the same columns mean the same thing at every level, a team banner with the
  totals, squad rows that fold to three figures and open to every column with the members under
  them, the viewer's own row in gold. Here the team is the development, a squad is a job, a member
  is a person, a sub, a supply house, a card holder or the office, and the nine columns are the
  job's effort, its costs by kind and its money, the figures Job Summary already computes for one
  job. The pick is the board by job with the contributors under each, inside the Money look as its
  second view, with cuts by part of the site and by person and a time window as chips, and the
  sibling spike's cost timeline as the third view, so Money becomes one place with three views.
next: The owner reads the mock-up and takes the six calls, then PR 1 is cut from fresh main once the Gun Dog stack (#6846 to #6849) and the photos PRs (#6839, #6840) are on it.
size: M (PR 1 the board by job) + M (PR 2 the people under each job, the gold row) + S (PR 3 the view chips, the lead's tier, the headline) + M (PR 4 the cuts and the window)
blocker: The owner's six calls. The Development page is a hot surface today; PR 1 waits for the stack on it to land.
opinion: build — it is the owner's own pattern, every column already exists for one job in Job Summary, and the board turns the page's Money look into the site's P&L with the people under it; the one new weight is the day ledger read for Overhead, which opens lazily with the view
mockup: to-dos/development-scoreboard/mockup.html
ver: v2.6040 · v2.6215 base
---

# A scoreboard for a development: its jobs, their money, and who put what in (#250)

Mock-up: [`mockup.html`](./mockup.html), draft 1 — the Money card's view chips, the board on a desk
with one job open and the controller's gold line, the same board cut by part of the site and by
person, two phones (a controller's with dollars, a lead's without), the empty and the failed states,
the four ways weighed and the six calls. Made-up data: Harlow Ranch, Ridgeway Builders, the house's
invented crew. Every total on the page is computed from the member rows, never typed.

## The ask

The owner, 2026-11-02, with five screenshots of the game Squad's scoreboard:

> In the developments tab, we recently worked towards adding a timeline feature. I think another
> great idea for a feature, this is from the game Squad, shows a breakdown in a neat way. Can you take
> a look at it and help me come up with ways that we can use it to summarise a breakdown of the
> different jobs that make up a development and their profit and costs and what contributes and who
> contributes to each?

## What the game does, and what is lifted

The screenshots: a **team banner** (flag, name) with nine stat icons and the team's totals under
them; **squad rows** (a number chip, a name) folded to three right-hand totals, one squad open with
every column's total; under it the **member rows**, each with a role tag (SL, FTL), a name with small
kit icons, and the same columns as numbers; the **viewer's own row in gold**; a one-line match
headline at the top; tabs for Summary, Scoreboard, Timeline. Two teams side by side on the wide view.

What is lifted is the pattern, not the look: **one grid where the same columns mean the same thing
at every level, roll up on fold and open on a press**. The banner is the sum of the rows, a row is the
sum of its members, and a member fills only the cells they truly put in. That rule is what makes the
board readable at a glance and it is the rule every choice below is tested against.

## What exists today (read off the code and prod, 2026-11-02)

**The page.** `/developments/:id` (`src/pages/DevelopmentPage.tsx`, v2.6040, punch list #208): the
head, five count tiles, the jump strip and six looks, History, Jobs & bids, Money, Plans, Questions
and, since today, Photos (#247). The **Money look** (`lib/developments/siteMoney.ts`,
`components/developments/DevelopmentMoney.tsx`) is the Pipeline's progress and pay cell at the scale
of the site: the band (percent done weighted by value, paid · billed · done-not-billed · left) and
the live jobs in stage sections with the paid jobs folded. It reads value, bills and payments. It
reads no cost. A dev or a controller also sees a **Costs** column on the Jobs & bids table
(`siteCosts.ts`, v2.6215): sub-labor sheets and the four parts buckets, one batched read for the
site (`useSiteCosts`). Who reads what: the office door (`readDoor.ts`, every role with a
`jobs_ledger` read) draws the money; an estimator reads one line, *The office reads the money on this
site*; the Costs column is dev and controller only, the owner's words.

**Another session is mid-flight on this page.** The Gun Dog spike is a four-PR stack (#6846 to
#6849) in the queue: the phone's Plans cards and a one-row strip, a faster read, the Archived fold,
History's folded runs, the shadow chip, the *Not yet billed* tile, the GC contact sheet, jobs onto a
part in one press. The photos look (#6839) and its History lines (#6840) are queued too. The brief
named a drafted *site cost timeline* on the spike's branch; the worktree is clean at its last PR and
holds no such file, so the timeline is designed here only as the third view chip, over the same
per-job figures, to be drawn when that draft lands.

**The figures, per job, already computed for Job Summary** (`docs/JOBS_JOB_SUMMARY_TAB_ARCHITECTURE.md`):
revenue earned, labor, subs, parts, gross and margin, hours and days, the overhead day share, true
profit and true percent, revenue per hour, burn and the projected margin, percent done with its
source. The row math is `enrichJobSummaryRows` in `src/lib/jobs/jobSummaryLedgerView.ts`; the totals
are `summarizeJobSummaryRows`. The inputs come from the Jobs page's loaders, which the Development
page does not have.

**The real site, read as the dev through dev-mcp, reads only.** One commercial customer, 24 jobs
(14 paid, 8 waiting, 2 working), about $2.2M of value. The one big job carries 677 clock hours by six
people, 11 supply-house invoices, 200 card lines and seven hand-typed *ESTIMATE* rows under Other
charges, six of them the office's own overhead split by quarter. No sub-labor sheet on any job read.
No `job_budgets` row. Four plan parts (a lodge, a bunker, the site, a building) and every job on no
part. Two jobs carry a percent; one of them is a ticket with no price that has cost $3,732 and 99
hours. The clock's rows name a crew lead per day (`people_crew_jobs.crew_lead_person_name`); a bill
names who sent it (`jobs_ledger_invoices.sent_by_user_id`); a payment names who booked it
(`jobs_ledger_payments.created_by`). So the shapes the board needs are all on record, and the board
drawn over them would say, truthfully, *24 jobs on no part* and *one job with no price is costing*.

## The mapping

| In Squad | On the Development page | Where the number comes from today | New read or kernel |
|---|---|---|---|
| Team banner: flag, name, nine icons, the totals | The development: name, customer, GC, the site's nine totals, and small lines (left to collect, people on it, subs and supply houses) | The sum of the job rows | none |
| The match headline | One line about the site right now: a job with no price that is costing, else the job that carried the site, else the job burning hot | — | `scoreboardHeadline()` in the kernel |
| Squad row: chip, name, three totals when folded | A job: number chip, name, state word and flags; folded it shows Earned · Cost · Profit | — | the kernel's row |
| The open squad: every column | The job's nine, then everyone who put something in | — | — |
| Member row: role tag, name, kit icons, the columns | **Lead** or **Crew** (a person: hours, days, labor), **Sub** (a sheet name: subs), **Supplier** (a house: parts), **Card** (a holder: parts), **Office** (who sent the bills and booked the payments: words, no figure) | people: `utils/teamLabor.ts` by person and work date; subs: `people_labor_jobs.assigned_to_name`; suppliers: `supply_house_invoices.supply_house_id`; card: Job Summary's Cost by person (`partsPerPersonCostSummary.ts`); office: the two columns above | the site's crew hours (one batched read), the house id on the invoice read, the office columns on the bills and payments read |
| Your own row in gold | Your own row, under every job you are on; the office line when you sent or booked | — | the signed-in user matched to the clock's person through the Crew P&L resolver's keys (`crewPnlSummary.ts`) |
| Unassigned players, 0 · 0 · 0 | *Nothing on them yet · N jobs · Show them*: a job with no earned dollar and no cost, folded | — | the kernel's fold |
| Kit icons beside a name | Flags on a row: *no price*, *materials only*, *≈ 50% assumed*; counts beside a member: *11 invoices*, *34 charges*, *2 sheets* | Job Summary's row flags (`JobSummaryRowFlag`) and the line counts | — |
| Tabs: Summary · Scoreboard · Timeline | The Money card's view chips: **Where the money is** · **Scoreboard** · **Timeline** | the first exists; the third is the sibling spike's draft | the chip row on the card's head |
| Two teams side by side | Not used. The wide view spends its width on the nine columns. A window chip cuts the same grid by time instead | — | — |

### The nine columns, the same at every level

Green is effort, red is what it cost, gold is the money. Folded, a row shows the last three.

| Column | Meaning | Supplied today by | What the page must add |
|---|---|---|---|
| Hours | clocked hours on the job (recorded time) | `utils/teamLabor.ts` over `people_hours_recorded` + `people_crew_jobs` | one batched read of the site's crew rows and hours (a `fetchSiteLabor.ts` beside `fetchSiteCosts.ts`) |
| Days | days with work on the job; the banner sums the jobs' days and says so | `jobDayLedger.ts` (distinct work dates) | the same read |
| Labor | wage × hours by person | `TeamLaborRow.jobCost`, the wage join by trimmed name (`docs/CREW_PNL_DATA_FLOW.md` names the fragility); wage-less for roles outside the finance seats | — |
| Subs | the sheets' total with drive cost | `useSiteCosts` → `siteCosts.ts` `subLabor` (`jobSubLaborInputsFromRows`, `buildJobProfitSummary`) | per sub: split the sheet names (`splitSheetNames`) |
| Parts | supply invoices + card charges less exclusions + tally + other charges | `useSiteCosts` four buckets | per supplier: the house id on the invoice rows; per card holder: Job Summary's card parse |
| Overhead | the day share from People → Overhead, from the day the pool began (2026-02-19) | `loadJobDayLedger.ts` + `overheadAllocation.ts` (`allocateJobOverheadDayShare`), settings from `overheadAllocationSettings.ts` | the day ledger for the window, read when the view opens; the heaviest read, it needs every job's days in the window, not only the site's |
| Earned | the contract at 100%; the percent's share while working; half when no percent is on record (≈) | the first forty lines of `enrichJobSummaryRows` (`resolveJobSummaryPercentCompleteWithSource`, `earnedRevenueInWindow` with the row's own `finished`, the flags) | lift that slice into a pure `jobEarned()` both callers use; the page reads the newest report percent per job as Job Summary does |
| Cost | Labor + Subs + Parts + Overhead | the sum | — |
| Profit | Earned − Cost, with the percent of Earned beside it; red below zero; ≈ and dim on an assumed row | `trueProfitUsd`, `trueMarginPct` | — |

Burn and the projected margin stay in Job Summary unless the owner wants them as columns ten and
eleven (call 3). Revenue per hour is one division away and is left out of the grid.

## The four ways, weighed

**A · By job, with the contributors under each. Picked.** The banner is the site's P&L; a row is a
job's; under it the people with their hours, days and labor, the subs with their sheets, the supply
houses and the card with their invoices and charges, the office with who billed and who collected.
It answers the owner's sentence word for word: the jobs that make up the site, what each earned and
cost, what kind of cost, and who. Every number already exists for one job in Job Summary, so the
kernel is a move and a sum, not new arithmetic.

**B · By part of the site. A chip on A, not the default.** The Plans look's parts (lodge, bunker,
site, building) as header rows with their three, the jobs under their part, the jobs on no part
last. It answers *which building paid*. It is worth little until the picker that the spike's last PR
ships has put jobs on parts: today the real site would read as one group, *No part · 24 jobs*. The
grid is unchanged, so it is a cut, the way Job Summary's *Cut by* works.

**C · By cost kind as the squads. Rejected.** Labor, Subs, Parts and Overhead as the rows with the
jobs under each. It breaks the one rule that makes the pattern work: a Labor row fills one column and
leaves eight blank, and a job appears four times. The banner's nine totals already answer *where the
money went* in one line.

**D · By time. A chip on A, and the Timeline view.** *What did this site cost us this month* is a
window on the same grid: earned by hours in the window, labor and parts dated in the window, the
overhead days in the window, as Job Summary already cuts them. The shape over time, the running net
and the month the crew was thickest, is the timeline's job, not a grid's, so the sibling draft is
the third view and not a fourth cut.

**E · By person. A chip on A.** The grid turned over: a person is the row, their jobs under them,
the subs, supply houses and the card left on the jobs. It answers *who carried this site*. Earned per
person is their share by hours, as Crew P&L splits it, so it wears ≈. It is cheap once A exists,
since the kernel holds the same triples: job, contributor, measures.

## The design, as drawn

- **Where.** Inside the Money card as its second view. The card's head gains three chips, *Where the
  money is* · *Scoreboard* · *Timeline*; the first stays the default; the device remembers the one
  you were in (`devicePrefs.ts`, as the Money sort is kept).
- **The banner.** The house glyph, the development's name, the customer, the GC, the counts; the
  headline under *Right now*; one small line with what is left to collect, the people on it, the
  subs and supply houses, and the day the overhead pool began. The nine totals to the right, each
  an icon on its group's tint with the figure under it.
- **The rows.** A folded job shows its chip, name, state and flags, and Earned · Cost · Profit.
  Opened, the row goes bold on the subtle tint and fills all nine; under it the members, each with
  an italic role tag in the margin and only their own cells filled, the rest an em dash. The office
  line spans the number cells in words. The viewer's rows are gold with a *You* chip.
- **The fold at the bottom.** *Nothing on them yet · N jobs · Show them*: the jobs with no earned
  dollar and no cost, the change orders at $0 the owner keeps.
- **The foot.** *The site · N jobs* with the nine totals again, so the board reads top and bottom.
- **A phone.** The banner compressed to the name, the headline and the three totals with *All nine ›*;
  the job rows as cards with their three; a tap replaces the three with the nine as a labelled grid
  and lists the members as lines. Measured: 375 wide, nothing past the edge.
- **The lead's tier** (call 2): the same board for the office door without the finance seats, three
  columns, Hours · Days · Earned, no wage and no cost; the gold row is then *my hours and days on
  this site*, which is where the gold earns its place.
- **Empty.** A site with no job: *No job on this site yet. New Job from a bid makes the first, and the
  board fills from it.* A lost read: the jobs and their earned dollars draw, the cost cells say *not
  read*, Retry re-reads; a refusal names its reason with no Retry (`OfflineRetryPanel`,
  `formatErrorMessage`). An estimator keeps the one line they read today.

## Your calls (defaults recommended)

1. **Where it lives.** Inside Money as its second view, Timeline the third. Or: its own look and a
   seventh chip on the strip.
2. **Who sees what.** Dev and controller: all nine. Leaders and assistants: Hours · Days · Earned,
   no cost and no wage. Estimators: the one line they read today. Or: dev and controller only.
3. **The nine, and the folded three.** Hours · Days · Labor · Subs · Parts · Overhead · Earned ·
   Cost · Profit, folded to Earned · Cost · Profit. Or: add Burn and the projected margin.
4. **People named, or counted.** Named under the job with their hours, days and labor dollars, to
   the readers of call 2. Or: counted (*4 people · 1 sub · 2 suppliers*) with the names behind a press.
5. **The window.** All time by default, since a site's story is its life and the real one spans two
   years. Or: this month, as a desk opened every morning.
6. **The real site's typed overhead.** Six hand-typed *ESTIMATE · office overhead* rows sit under
   Other charges on one job. The board reads them as Parts, as Job Summary does, and the Overhead
   column reads the pool's day share, so the two are side by side and not double counted in one cell;
   the Parts cell's title names them. Or: a tag on an other-charge row moves it to the Overhead column.

## The PR train

Each PR from fresh `main` after the one before it merges, with its release note, fragment and guide
words. PR 1 waits for the Gun Dog stack and the photos PRs so the page seam is cut once, after them.

1. **PR 1 · the board by job (M).** `src/lib/developments/scoreboard.ts` (+ tests): the rows from the
   page's reads (value, percent, bills, `useSiteCosts`) and a new batched read of the site's crew
   hours (`fetchSiteLabor.ts`); `jobEarned()` lifted out of `enrichJobSummaryRows` and called by both;
   Overhead through `loadJobDayLedger` when the view opens, the cells *reading…* until it lands.
   `DevelopmentScoreboard.tsx` with the banner, the nine, the fold and the foot, desk and phone;
   the view chips on the Money card's head; dev and controller. Page seam: one import, the view
   state, the component inside the Money card.
2. **PR 2 · the people under each job (M).** Lead and Crew rows from the clock, Sub rows from the
   sheets, Supplier rows from the invoices' house, Card rows from the card parse, the Office line
   from the bills' and payments' authors; the gold row; the counts beside a name.
3. **PR 3 · the lead's tier and the headline (S).** The three-column board for the office door,
   `scoreboardHeadline()`, the glossary and access-control lines.
4. **PR 4 · the cuts and the window (M).** *Cut by* job · part · person and *Window* all time · this
   month · 90 days, remembered on the device; the person cut's ≈ share.
5. **The Timeline view** is the sibling spike's draft, drawn as the third chip when it lands, over
   the same per-job figures.

No migration. No edge function. The reads are the page's own tables under the reader's policies.

## How to verify

- `npm test` on the kernel: for every row Cost = Labor + Subs + Parts + Overhead and Profit =
  Earned − Cost; the foot equals the sum of the rows and of the fold; a job with no percent and a
  price earns half and wears ≈; a job with no price and cost wears *no price* and leads the
  headline; the fold holds exactly the jobs with no earned dollar and no cost; the person cut's
  Earned shares sum to the job's Earned.
- The render smoke of the whole page at 375 wide (`DevelopmentPage.phone.render.test.tsx`,
  v2.6324) with the Scoreboard view open: `scrollWidth` 375.
- Live, as the dev on the real site: open the big paid job and read its nine against Job Summary's
  row for the same job over all time, column by column, Revenue · Labor · Subs · Parts · Overhead ·
  True profit; the Parts cell against dev-mcp `get_job`'s four buckets; the Hours cell against the
  six people's hours the Job window lists. Then as the sample controller, the sample master (three
  columns, their gold rows) and the sample estimator (one line), through `view_as`.
- `npm run check:empty-words`, `check:error-words`, `check:text-fill-words`, theme-tokenize
  `--check` on the new files.

## Not in scope

Burn and the projected margin as columns (call 3's alternative). A budget line per job from the bid
(`job_budgets` is empty on the real site). Comparing two developments side by side. The timeline's
own design. Putting jobs on parts (the spike's last PR does that).
