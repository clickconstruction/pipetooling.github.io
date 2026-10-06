---
name: "GC mode, the Gantt: every feature, numbered"
parent: to-dos/gc-mode/GANTT_PLAN.md (punch list #81)
status: listed 2026-10-05 at the owner's ask ("save that as a list as well so as we develop this we can reference that list") · Phases 1 and 2 and the first slice of Phase 3 built the same day (the rows that say built 2026-10-05) · nothing else is built unless its row says Have
summary: >
  The reference list for the schedule as a Gantt chart. Each feature has a number to cite in
  commits and notes (G-12), where it stands on the prototype today, and the phase of
  GANTT_PLAN.md that builds it. Add to the end of a section; never renumber.
---

# The Gantt: every feature, numbered

**Stands** is one of: **Have** (on `spike/gc-mode` today), **Part** (some of it is there), **New**.
**Phase** is the phase in `GANTT_PLAN.md`. "Later" means wanted, not scheduled.

The three jobs the chart has, which every feature serves at least one of:
**See** (an accurate look at the job at any time), **Tell** (communicate it to the customer),
**Chase** (follow up on the trades).

## A. The chart itself

| # | Feature | Serves | Stands | Phase |
|---|---|---|---|---|
| G-01 | A bar for each activity on a time axis, grouped by trade, with percent done drawn in the bar | See | Have | — |
| G-02 | Today line; the chart opens scrolled to today | See | Have (built 2026-10-05) | 1 |
| G-03 | Zoom: days, weeks, months. Weeks is the default | See | Have (built 2026-10-05) | 1 |
| G-04 | Weekends marked on the chart. Every day is a working day (the owner, 2026-10-05: "anyone can work 365 days a year"), so a bar's length is its calendar days | See | Have (built 2026-10-05) | 1 |
| G-05 | Holidays marked on the chart like weekends, and named on the hover card of a bar that runs over one. They are worked like any other day | See | Have (built 2026-10-05: six holidays, my list) | 1 |
| G-06 | Links drawn as lines from the work before to the work after | See | Have (built 2026-10-05) | 1 |
| G-07 | The chain with no spare days outlined in red, bars and links both | See | Have (built 2026-10-05: 5 or fewer spare days, `TIGHT_SPARE_DAYS`) | 1 |
| G-08 | Spare days shown per activity, and as a faint tail after the bar on request | See | Have (built 2026-10-06: **Show spare days** beside Hide the links draws a faint tail at each bar's foot out to the last day it can finish, never on the red chain or a done bar; the hover card's *Can finish by*; on our team's paper when on; `spareTail` / `lastFinishDay` in `gcGantt.ts`) | 1 |
| G-09 | The plan at Start as a thin line under each bar that moved | See | Have | — |
| G-10 | Milestones as diamonds on a row of their own, red when late, green when met | See | Have | — |
| G-11 | Group by trade, by stage of the job, or by company | See, Chase | Have (built 2026-10-05) | 1 |
| G-12 | Fold a group into one summary bar; fold all, open all | See | Have (built 2026-10-05; finished groups open folded) | 1 |
| G-13 | Filters: no spare days, only late, next 3 weeks, one company, held | See, Chase | Part (five filters with counts; no one-company filter, By company does that job) | 1 |
| G-14 | The left columns stay put while the chart scrolls sideways; the header stays while it scrolls down | See | Have (built 2026-10-05) | 1 |
| G-15 | Hover a bar: dates, working days, percent against plan, who, what holds it | See | Have (built 2026-10-05: a card beside the pointer) | 1 |
| G-16 | A held bar is striped, and says what holds it: a submittal, an RFI, a failed inspection, a delivery | See | Have (submittals and RFIs 2026-10-05; a delivery, a decision, a permit or the utility 2026-10-06, when it is expected on or after the day the work starts or its day passed) | 1 |
| G-17 | Inspections as their own rows; a failed one shows the day it failed and the day it is seen again | See | Have | — |
| G-18 | The strip of numbers over the chart: finish against the contract, work done against plan, how many have no spare days, how many are held, what moved this week | See | Have (built 2026-10-05: the filter counts, under the four measures) | 1 |
| G-19 | A phone view: one stage at a time as a list with small bars, today first | See | Have (built 2026-10-06: the List view, which a phone opens on, the stages with the one running today first, each a table of its bars with a small bar in the stage's span; `GcGanttList.tsx`) | 5 |
| G-20 | Keyboard: arrows move between bars, Enter opens one, a list a screen reader can read | See | Have (built 2026-10-06: up and down move between bars, left and right a week along, Home and End, Enter opens; every bar says its name, company, dates and standing; the List view is a real table) | 5 |
| G-21 | Print and PDF of the chart as it is filtered, on one or more landscape pages | Tell | Have (built 2026-10-06: **Print or PDF** on the chart's toolbar opens *Print the chart*; our team's copy is the chart as it is filtered, grouped and folded, the customer's is their portal's picture, and Next 3 weeks prints the look-ahead sheet; letter landscape pages through the print dialog; `gcGanttPrint.ts`, `GcGanttPrint.tsx`) | 3 |

## B. Building and changing the schedule

| # | Feature | Serves | Stands | Phase |
|---|---|---|---|---|
| G-30 | Draw a first draft from the stages of the job | See | Have | — |
| G-31 | Change one activity's dates and what it waits on, in a form | See | Have | — |
| G-32 | Drag a bar to move it; drag its end to change its length | See | Have (built 2026-10-05: drag the bar, or pull an end) | 2 |
| G-33 | What comes after moves with it, and the chart shows what will move before you let go | See | Have (built 2026-10-05: amber ghosts on what it pushes, and a label with the new dates and the finish) | 2 |
| G-34 | Draw a link by dragging from one bar to another; press a link to take it off | See | Have (built 2026-10-06: pull the circle at a bar's end to another bar; press a line to take a wait off; both go through Why it moved) | 2 |
| G-35 | Kinds of link: starts after it finishes (today's), starts with it, finishes with it, and a gap of days on any link (cure time, lead time) | See | Have (built 2026-10-06: a gap in days on each wait, on the opened activity; the pushes, spare days and projected finish count it) | 2 |
| G-36 | A day an activity cannot start before (a delivery, a permit), and a day it must finish by | See | Have (built 2026-10-06: Not before stops a move; Must finish by warns, and a bar past it shows red) | 2 |
| G-37 | Pull work earlier when the work before it finishes early, on a press, never by itself | See | Have (built 2026-10-06: **Pull the work earlier**, one press per job. Work that finished early catches its plan up, and the work right behind it comes in by the days it gave back, never before tomorrow, its Not before day or a wait's day. Held work is named to chase; `gcPullEarlier.ts`) | 2 |
| G-38 | Add an activity that is not a schedule-of-values line: mobilize, a delivery, cure time, the customer's own work | See | Have (built 2026-10-06: the job's own bar, no dollars, waits on work and holds work up, counts on the critical path, the office marks it done; a delivery is a wait, G-73; `gcAddedActivity.ts`) | 2 |
| G-39 | Split one line into several bars (first floor, second floor) that add up to the line's percent | See | New | Later |
| G-40 | Undo and redo, and Start over to the last saved schedule | See | Have (Undo on the last move 2026-10-05; Redo on the newest undone move 2026-10-06, while everything it touched still sits where the undo left it; Start over is the prototype's own) | 2 |
| G-41 | The baseline: kept at Start. Set a new baseline after a signed change order, the old ones kept and named | See | Have (built 2026-10-06: The baseline card says when a signed order's days call for one, offers its name, takes the plan as it stands and keeps the old ones named; `gcBaseline.ts`) | 2 |
| G-42 | Every move asks for an explanation, which is kept with the move (the owner, 2026-10-05: "an explanation should be given and recorded"): a reason picked (weather, the trade before, materials, crew, the customer, the plans, an inspection, us) and their own words | See, Tell | Have (built 2026-10-05: no move saves without a reason and a sentence) | 2 |
| G-43 | The history of the schedule: who moved what, when, why, and by how many days | See | Have (built 2026-10-05: Changes to the schedule, under the chart) | 2 |
| G-44 | Templates: save a job's schedule shape and start the next job like it from it | See | New | Later |
| G-45 | A schedule while bidding: a rough one from the stages, for our bid's "weeks to build" | Tell | Have (built 2026-10-06: a job still bidding opens its Schedule tab on *A rough schedule for our bid*, drawn by the first draft's own kernel from the trades' scope lines with the job's stage days; Our number's *Weeks to build* and the proposal sentence; locked as it went when the bid goes in; at award kept as the weeks we bid, and the first draft starts from it; `gcRoughSchedule.ts`, `GcRoughSchedule.tsx`) | Later |
| G-143 | In the first draft, a trade's site-finish lines wait on the dry-in gate and their own earlier site lines, not on the trade's trims (today Site lighting waits on Fire alarm); moves every first draft with site lighting, so it re-pins the golden walk's Helotes draw and G-45's draw pin | See | New | Later |

## C. Keeping it true

| # | Feature | Serves | Stands | Phase |
|---|---|---|---|---|
| G-50 | Percent done comes from what the trade reports and what we verify, never typed on the chart | See | Have | — |
| G-51 | Our own crew's percent from its Pipeline job, its head count from clock-ins | See | New (typed by hand) | Real build |
| G-52 | **Update the week**: a walk through every bar that should have moved, with what the trade said and what the daily log shows, one at a time | See | Have (built 2026-10-05: Update the week, over the chart) | 2 |
| G-53 | The walk ends with what changed, ready to go to the trades and the customer | Tell, Chase | Have (built 2026-10-05: the walk's What changed, and Tell the trades from the same moves; the customer reads it as What changed this week) | 2 |
| G-54 | A bar that should be done and is not turns amber, then red, without anyone touching it | See | Have (built 2026-10-05) | 1 |
| G-55 | Actual start and actual finish kept beside the planned ones | See | Have (built 2026-10-06: set by the walk, It started Mon Sep 21 / It started today / It finished today, or on the opened activity; a green line over the bar; the trade's report setting them is the owner's call, since it moves the golden walk; `gcActualDates.ts`) | 2 |
| G-56 | The projected finish from the pace of the work so far | See | Have | — |
| G-57 | The projected finish with a weather allowance and crew sizes | See | Have (built 2026-10-06: a second line at the foot of the Projected finish measure, *With weather and crews*, ours only; weather days a month on the work of the trades the log saw the weather stop, our rule of 2 until the log covers a month, then the log's own; a crew now smaller than so far stretches its trade's work left, from the trade's own count for the week (G-142) or the log's newest day, a bigger one not counted on; each sentence says its days and the two add up to the line; a short crew that alone moves the finish joins the call list with the same days; `gcFinishOutlook.ts`) | Later |
| G-58 | Weather days from the daily log land on the chart as lost days on the work that was outside | See | Have (built 2026-10-06: a log that says the weather stopped a trade, or the site, marks a lost day on every bar that trade had running; the walk lists them and Add the lost days moves the finish with the weather as the reason and the log's words; `gcDaysLost.ts`) | 4 |
| G-59 | A stale schedule says so: "not walked since Sep 25" on the chart, the board row and Needs you | See | Have (the Schedule tab's walk line, built 2026-10-05; the owner's call 4, built 2026-10-06: *not walked* on the board row, in its schedule block and the ring card's line, and the dashboard's Needs you line *1 schedule not walked this week in GC mode* with *Walk it*, `gcStaleSchedules.ts`, kind `gc-stale-schedules`) | 2 |
| G-60 | The daily log and the chart disagree: a trade on site with no bar that week, or a bar with nobody on site | See | Have (built 2026-10-06: this week's logged days against the bars; a crew on site with none of its bars running, or a trade's running bars with nobody on 2 or more logged weekdays, the weather's days and held bars left out; the note beside the bar and a Log line on its hover card, a card under the chart with what to do and It started, the on-site rows on the Daily log tab too; `gcLogVsChart.ts`) | 4 |

## D. What holds the work

| # | Feature | Serves | Stands | Phase |
|---|---|---|---|---|
| G-70 | A submittal holds the lines it covers until approved, with its lead days | See | Have | — |
| G-71 | An RFI holds the work it is about | See | Have (built 2026-10-05) | 1 |
| G-72 | A failed inspection moves what waits on it | See | Have | — |
| G-73 | Long-lead items as bars: ordered, shipped, on site, each tied to the work that needs it | See, Chase | Have (built 2026-10-06: a row under the milestones from the day ordered to the day expected, ● ordered ▲ shipped ■ on site, the day the work needs it marked, a dashed line to each line it holds; `gcScheduleWaits.ts`) | 4 |
| G-74 | The customer's own decisions as rows with a needed-by day (a finish to pick, a tenant's equipment) | Tell | Have (built 2026-10-06: the same row, kind decision; the customer reads it under What we need from you with the day the work needs it) | 4 |
| G-75 | Permits and the utility's work as rows, with who is waiting on whom | See | Have (built 2026-10-06: the same row, kinds permit and utility, who we wait on named, the work waiting on it listed) | 4 |
| G-76 | A change order's days: signed, it adds its days where the work is and moves the contract's finish | See, Tell | Have (built 2026-10-06: the days land on the trade's bar running the day it was signed, drawn as a tail until Put its days on the schedule makes them a move with the change order as its reason; the customer's schedule says what each signed order did to the contract) | 4 |
| G-77 | A trade not ready to start: no signed statement of work, insurance run out. The bar says so before its start day | See, Chase | Have (built 2026-10-06: a bar not started, on a trade whose papers are not in, is held like any other, its note *waits on current insurance, theirs ran out Sep 15*; ready is Get started's five steps, insurance read on the bar's own start; the opened activity lists each paper with its own next step, which opens the company's send; `gcNotReady.ts`) | 4 |
| G-138 | A trade on site whose insurance has run out says so on its running bars: a red note, no stripes, since the work goes on uncovered | See | Have (built 2026-10-06: a red note beside a bar under way, *insurance ran out Sep 15*, and an Insurance line on its hover card and the print; the opened bar asks for the certificate and says Approve on Draws stays locked until one is in; the morning list says it at the gate; G-77's gap read on the day, `uninsuredBars` in `gcNotReady.ts`) | Later |
| G-139 | The trade's start reminder (G-114) names every paper its bar waits on (G-77), the master agreement and the W-9 too | Tell, Chase | Have (built 2026-10-06: the reminder reads the office's own list, G-77's `startGaps`, each gap in the trade's words through a `Record` over every gap kind, so a paper on one side and not the other fails the typecheck; a master agreement sent or not, an insurance certificate that ran out, a W-9, a statement of work not sent or on older plans, in English and Spanish; `PORTAL_SPANISH.md` regenerated) | Later |

## E. What if

| # | Feature | Serves | Stands | Phase |
|---|---|---|---|---|
| G-80 | On one bar: "if this slips 5 days", what moves and where the finish lands | See | Have (built 2026-10-05: 5 and 10 days, on the opened activity; and every move shows its effect before it saves) | 2 |
| G-81 | A what-if copy of the whole schedule to try moves on, beside the real one, kept or thrown away | See | Have (built 2026-10-06: **What if…** on the chart's toolbar makes a copy beside the schedule. Every move, pull and wait is tried on it with a reason optional. The real dates show as dashed outlines. **Keep** puts its moves on the real schedule as real moves with their reasons, and **Throw it away** drops it. `gcWhatIf.ts`) | Later |
| G-82 | How to get days back: the bars on the red chain that could run together or take a bigger crew | See | Have (built 2026-10-06: on a job past its contract, *Days back* under the measures: side by side, a gap below zero on a wait between two trades nothing holds, or a second crew under a rule said on every offer (two thirds the days left); each read on the projected finish through G-37's cascade (`pullBehind`), with its worth against the contract in G-98's lines; *Look at it* saves one move, *Getting days back*, Undo and Redo putting the gap back too; who has to agree with Call and Follow up; `gcRecovery.ts`) | Later |
| G-83 | Too many trades in one place in one week, flagged | See | New | Later |
| G-84 | People on site per week as a strip under the chart, planned against the daily log's count | See | Have (built 2026-10-06: *Show people on site* in Chart view, a strip under the rows with each week's plan at its busiest day beside the daily log's busiest day, the whole job whatever is filtered or folded; each trade's count its own (G-142's), else the log's last, else an assumed 3, named; a week 3 or more short reads amber; `gcPeopleOnSite.ts`, `GcPeopleStrip.tsx`) | Later |
| G-144 | People on site per week on our team's printed copy, under the last page's rows while the strip is on | See | Have (built 2026-10-06: with *Show people on site* on, our team's copy of *Print or PDF* prints the strip as the last row of the last page, each week's plan outlined beside the daily log filled, the numbers over them where a week has room, a short week amber, keyed at the page's foot and said in the window; never on the customer's copies; `gcGanttPrint.ts`) | Later |

## F. Telling the customer

| # | Feature | Serves | Stands | Phase |
|---|---|---|---|---|
| G-90 | The customer's view: the stages of the job as bars, the milestones, the finish against the contract. No company names, no dollars, no spare days | Tell | Have (built 2026-10-05: Your schedule in the customer's portal) | 3 |
| G-91 | "What changed since last week" in plain words, written from the moves and their reasons | Tell | Have (built 2026-10-05: by stage and reason, never by company) | 3 |
| G-92 | "What we need from you", with the day it starts costing time | Tell | Have (change orders waiting on their signature 2026-10-05; their decisions, with the day the work needs them, 2026-10-06) | 3 |
| G-93 | The schedule picture at the top of the Friday weekly report and in their portal | Tell | Have (their portal 2026-10-05; the Friday report's *The schedule* section 2026-10-06: each stage with where it stands, what changed this week, what we need from them) | 3 |
| G-94 | A link or a PDF to send on its own, dated, kept as sent | Tell | Have (built 2026-10-06: the letter on the Schedule tab, the same picture as the portal, Send keeps it as it went, Print or PDF opens it as a page; `gcCustomerScheduleSend.ts`) | 3 |
| G-95 | The architect's view: the customer's view plus submittals and RFIs waiting on them, with the work each holds | Tell, Chase | Have (built 2026-10-06: *The schedule* in the architect's portal, the stages and what waits on them, each with the work it holds and the day we need it back; `gcArchitectSchedule.ts`) | 3 |
| G-96 | Days lost by cause across the job, for a time extension ask: the customer's, the weather's, ours, a trade's | Tell | Have (built 2026-10-06: Days lost, by cause on the Schedule tab adds every standing move up by whose door its reason lays at, on the finish and on the work, with the log's weather days beside) | 4 |
| G-97 | The billing forecast follows the schedule: what we expect to bill each month, as the bars move | Tell | Have (built 2026-10-06: *What we expect to bill* under the draft on Bill the customer, with each month's trades and what this week's moves changed; *What we bill, month by month* on the Money tab; the customer's bills ahead in their portal, rounded; *Billing: …* in Why it moved and on a move's row. Each bill is Owner Billing's own `ownerPayApp` run on the job at that day's percents; `gcBillingForecast.ts`) | 4 |
| G-98 | The late-finish days in the contract, counted against the projected finish | See, Tell | Have (built 2026-10-06: under the Projected finish measure, the late days at the contract's fee typed on Bill the customer, how many are the customer's and what a change order for them would save, and each change order that moved the contract or would; the same lines on Bill the customer's Finish date card; the customer reads whose the days are after their finish in the portal, the Friday report and the schedule letter, never a company or the fee; one call, `lateFinish` on `ownerFinishRisk`; `gcLateFinish.ts`) | 4 |
| G-140 | The cash forecast follows the bars too: *The next 6 weeks* counts each bill as the schedule has it, and the trades' draws follow the same bars | See, Tell | Have (built 2026-10-06, the owner's yes: our bills from G-97's forecast on each customer's pay day, each trade's draws at each bill day through its own pay application; *As the schedule stands* by default, *As reported so far* the way back, remembered; what changed and why on the card, and the draws that make the lowest week; `gcCashForecast.ts`) | Later |
| G-141 | **Ask for the days**: a press on the late-finish line drafts the time extension change order with the customer's late days | Tell, Chase | New (needs a field on the change order that says its days are on the chart already, and a guard in G-76's `changeOrdersOnChart` that skips such an order, or G-76 offers to push the bars a second time) | Later |

## G. Chasing the trades

| # | Feature | Serves | Stands | Phase |
|---|---|---|---|---|
| G-110 | A trade's own chart in its portal: its bars, what it waits on, what waits on it, across every job it has with us | Chase | Have (built 2026-10-06: Your schedule on this job, in the portal's language; one job at a time, not across jobs) | 3 |
| G-111 | The weekly done or not done, with a reason, from the same page | Chase | Have | — |
| G-112 | **Tell the trades**: after a move, each company whose dates changed gets one email naming its old and new days | Chase | Have (built 2026-10-05: Tell the trades, from Changes to the schedule; written, never sent) | 3 |
| G-113 | The trade confirms its dates or gives another day. A date nobody confirmed is a reason on Follow up | Chase | Have (built 2026-10-05: These dates work / I need another day, in English and Spanish; the office sees each answer on the move) | 3 |
| G-114 | "You start in 14 days", then 3 days: a reminder with what must be in place (submittal approved, insurance current) | Chase | Have (built 2026-10-06: a message in the trade's portal at 14 and 3 days, in its language, naming the submittals not approved, an insurance certificate that runs out first and an unsigned statement of work; Starting soon on the Schedule tab is the office half; `gcStartReminders.ts`) | 3 |
| G-115 | By company: the chart as a call list. Each company's late bars, unconfirmed dates and held work, with Call and Follow up | Chase | Have (built 2026-10-06: By company opens a list under the toolbar of everyone whose answer moves the chart, a hold going to whoever owes it, the architect and the customer too, with every Follow up reason on the job merged in; Follow up's own Call, Follow up and Work the list; a line opens its bar, and the opened bar has its company with Call and Follow up; a trade's late notice from its portal (G-117) and its papers (G-77) each a line of their own; the call form records new dates answered, and a day given on a delivery, a submittal or a start; `gcCallList.ts`. Not counted on the board row, Follow up's badge or Needs you: the owner's call) | 3 |
| G-116 | A trade's record on our dates: milestones on time, look-ahead done as planned, dates confirmed and kept | Chase | Have (two of three) | 3 |
| G-117 | A trade tells us from its portal that it will be late, with a new day, before the day passes | Chase | Have (built 2026-10-06: *We will be late* on each of its unfinished bars in its portal, a new finish or a new start with why, and what that day does to the work waiting on it; the office's *Trades say they will be late* card takes it as a move carrying the trade's reason and words, or pushes back, and the trade answers *We will make Fri Oct 9*; a dashed tail on the bar, a reason on Follow up, a phrase in Needs you, a fact on the walk; `gcLateNotices.ts`) | 3 |
| G-118 | The superintendent's morning list from the chart: who should be on site today and what they are doing | See, Chase | Have (built 2026-10-06: on the Daily log tab above the log, for the tab's day: each company with work running, its phone, the log's last count, each bar's day and standing, held and why, a late notice; the day's inspections and arrivals; once the day's log is written, the missing first in red; `gcMorningList.ts`, the chart's holds moved to `gcChartHolds.ts`) | 4 |
| G-119 | The portal's chart in Spanish | Chase | Have (built 2026-10-06: the chart, Your dates moved and the dates message all read in Spanish) | 3 |
| G-142 | A trade's own crew count: from its portal, how many people a day it will have on site each coming week, one count a trade; the superintendent's morning list reads it beside the daily log's | See, Chase | Have (built 2026-10-06: *People a day on site* under each coming week of *Your next three weeks*, in English and Spanish; the morning list says *They said 4 a day this week*, a short crew *On today's log with 2 of the 4 they said.* in amber, and a cut count; `crewCountsNow` is G-84's read; `gcCrewCounts.ts`) | Later |

## H. Under the hood

| # | Feature | Serves | Stands | Phase |
|---|---|---|---|---|
| G-130 | One schedule kernel: the calendar, links, spare days, pushes. Pure, tested, shared by every view | See | Part (`gcGantt.ts`: the calendar, standings, groups, filters, links, axis, tested; spare days and pushes stay in `gcBuildingSchedule.ts`) | 1 |
| G-131 | The golden test's schedule steps keep passing; the working-day change moves snapshots once, with the owner's OK | See | — | 1 |
| G-132 | Real tables: activities, links, baselines, moves with reasons, confirmations (see the plan) | — | New | Real build |
| G-133 | Who may move a bar: anyone on our team (the owner, 2026-10-05). The customer and the trades only read | — | Part (anyone may move a bar on the prototype; the real build's RLS is not written) | Real build |
| G-134 | Two people on one schedule: the second to save sees what the first changed | — | New | Real build |
| G-135 | A job with 300 activities still scrolls: only the rows in view are drawn | See | Have (built 2026-10-06: the rows outside the scroller's window, with overscan, are one spacer each; `rowsInView`) | 5 |
| G-136 | Export to a spreadsheet, and to the file Microsoft Project and Primavera read, for a customer who asks | Tell | Have (built 2026-10-06: **Export** beside Print or PDF opens *Export the schedule*; always the whole schedule, whatever the filters and folds; our team's copy with the companies, spare days and waits, the customer's from their portal's picture; a `.csv` and the MSPDI `.xml` both programs read, every day worked and each task held to its day; the first real import is the owner's to check with a scheduler's copy of each program; `gcScheduleExport.ts`, `GcScheduleExport.tsx`) | Later |
| G-137 | Import a schedule a customer or architect hands us | See | New | Later |
