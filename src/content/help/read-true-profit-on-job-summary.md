---
title: read true profit on Job Summary
category: Office
roles: dev, master_technician, controller
keywords: burn, projected margin, spent vs done, money story, door, from pipeline, from job window, cut by, group by, by GC, by service type, by lead tech, concentration, revenue per hour, compare to, prior period, last year, target margin, job summary, true profit, overhead, day-share, smoothing, carry share, idle cap, overhead dials, in flight, open jobs, margin, finished jobs, percent complete, earned revenue, sort, window, gross profit, budget, from bid, typed, assumed, footing, linking backlog
order: 36
---

Job Summary used to stop at gross: revenue minus labor, subs and parts. Now it charges each job its share of overhead and ends at true profit.

Subs are subcontractors, the outside crews you pay. The table opens on the jobs that are finished. It lets you sort by whatever you are chasing.

## How to get there

Three doors, all landing on the same table:

- **Jobs → Job Summary**, the tab.
- **money story →** on a job's activity header on **Jobs → Pipeline**, right after *N% complete*. The activity header is the panel that opens on a row, and its full-screen view. It opens Job Summary with that job expanded and scrolled into view.
- **money story →** in the header of the **job window**, next to the trade pill.

The link shows for dev, leader and controller. Assistants keep the tab but not the shortcut. If the job is not on the list, a note says so instead of scrolling to nothing. That happens when it is below the job-number floor or outside the **Worked in** window.

## The controls

You go to **Jobs → Job Summary**. Above the table:

- **Show**: {{chip:blue|Finished (100%)}} opens by default. Those are jobs whose % complete resolves to 100. Either the work is done, by the latest report or the job's own %. Or the whole contract is billed and paid. One paid progress bill no longer marks a job finished. So a job still being worked stays under **In progress** with earned revenue. **In progress** is everything else. **All** is every job.
- **Worked in**: 90d, 6 mo, **This year**, 12 mo, or All. This year is the default. A job is in the window when it has approved field hours there. It is also in when its last work date falls inside it.
- **Overhead**: how each job's overhead share is figured. **Day-share** is the default, explained below. The grey chip beside it, {{chip:gray|30 days · 20% carry · 14-day idle cap}}, names the constants day-share runs on. A, B, and C are the same three lenses People → Overhead shows, applied to one job.
- You click any column header to sort. You click again to flip. The table opens sorted by true profit.

The strip under the controls totals what is showing. It shows jobs, revenue, gross profit and margin, and overhead charged. It shows true profit, true margin, and true profit per field hour. The chips beside it say what would move the numbers. Those are jobs with no contract $, jobs with no %, and sessions still awaiting approval. Also overhead that had nobody to charge, and overhead still **in flight**. In flight means spread past today, and it lands as the days arrive. Also overhead that landed on jobs this list leaves out. The HCP # floor under the table hides older imported jobs. Their field hours still take their share of the pool. So *Overhead charged*, shown jobs only, reads lower than the dials strip by exactly that amount. You lower the floor to see those jobs.

## Compare to and Target

Two chips at the end of the control row change everything above the table at once.

**Compare to** runs the same view on a second window and shows the difference. {{chip:blue|prior period}} is the same number of days immediately before your window. {{chip:blue|last year}} is the same dates a year earlier. Every tile grows a line like {{chip:green|▲ $12,400 vs prior period}} or {{chip:red|▼ 2.3 pts vs last year}}. The margin tiles show the change in points beside the percent. Green means the move is good. For Overhead, lower is the good direction. Show, Worked in, and Overhead stay exactly as set, so the comparison is like for like.

**Target** sets the true margin you expect: 30, 35, or 40%. Jobs under it turn red in the **True %** column with a ▾. The True profit tile turns red when the whole window is under. A chip counts them: {{chip:red|▾ 4 jobs under the 35% target}}. You sort by True % to see them first.

:::example Why "All" can't compare
"All" starts at the beginning of the clock history, so there is no earlier window to compare with. Pick a shorter Worked in and the chip wakes up.
:::

## Budget — what Burn stands on

The **Budget** chip beside Target filters the table by what each job's Burn budget stands on. {{chip:blue|◆ from bid}} is a snapshot of the linked bid's estimate. {{chip:gray|✎ typed}} is a budget typed on the job's Costs tab. {{chip:yellow|≈ assumed}} is the price with the target margin taken off. A job is assumed when no bid is linked and nothing is typed. It is also assumed when the snapshot has no labor or no materials figure. Such a snapshot cannot stand as the whole job's budget. The Burn cell wears the glyph when a job has a real footing. An unmarked cell is still the assumption. Under the tiles, *≈ 12 open jobs burn against an assumption* is your linking backlog. You open a job's Costs tab and link its bid. The Pipeline's burning-jobs card uses the same footing for its margin-at-risk figure. It says how many of the hot jobs are on an assumed budget.

## Cut by

{{chip:blue|Cut by}} groups the table by one key. The keys are **GC**, **service type**, **lead tech**, **Account Man**, **customer**, **development**, or **bill month**. GC is the general contractor. It puts a bold subtotal row above each group. The subtotal shows revenue, costs, overhead, true profit, true margin, and $/hr. Groups rank by true profit. So the money-makers are on top and the money-losers at the bottom. Jobs with no value for the key go in a bucket of their own. That is a job with no GC, or one not billed yet.

A ranked bar chart sits above the table, one bar per group. Green is profit and red is loss. The margin and job count sit beside each. The line under the bars names the concentration, like {{chip:gray|top 3 = 71% of true profit}}. That is how much of the year rides on three names. With **Target** on, groups under it get a red mark. With **Compare to** on, each subtotal shows how its margin moved in points.

:::example The question this answers
Sorted by true profit, the table says job 812 lost money. Cut by GC says one builder loses money on four jobs out of five. Cut by lead tech says whose jobs run thin. Cut by bill month is a monthly P&L in the same table.
:::

## Leakage flags

Two chips in the row and a line in the totals strip name money that left after the sale. {{chip:yellow|✂ write-down}} marks a job whose bill was agreed down. The strip totals the dollars across the window. {{chip:red|⚑ collections}} marks a job flagged for collections and not yet paid. Revenue already reflects a write-down, so true profit is honest either way. The flag says why.

**Discounts have their own fold.** When jobs in view carry discount line items, the toolbar shows {{chip:green|− $6,394.50 discounted on 4 jobs ▾}}. You open it for the one number an owner asks. That is how much was given away as a share of the revenue in view. Then the same share by reason, from the chips on the discount rows. Then by who gave it, from the activity trail. See *give a customer a discount*.

## The columns

The columns run *Job · Revenue · Labor · Subs · Parts · Gross · Margin · Hours · days · Overhead · True profit · True % · $/hr · %*. **$/hr** is revenue ÷ approved field hours, the realized rate.

- **Job** is one cell. The first line has the trade pill and job number, and the job name. Any {{chip:yellow|✂ write-down}} / {{chip:red|⚑ collections}} chip sits there too. The address sits in small grey type on the second line. A long address is cut short with an ellipsis. You hover it to read the whole thing. You click the **Job** header to sort by job number.
- **Revenue** is the contract on the job. For an in-progress job it is **earned** revenue instead. Each approved field hour earns its share of the contract. The share is contract ÷ expected hours, where expected hours = hours to date ÷ % complete. So the window's hours earn the window's share. A job with every hour inside the window reads exactly contract × %. One that ran for months before the window reads only what this window earned. So its true margin is this window's margin. A job with no % yet is assumed half done and says *earned ½?*. You hover the cell for the arithmetic. The **Revenue\*** rule sits under the table.
- **Parts** now leaves out Internal Transfers, money moving between the company's own accounts. It counts a card charge only once when it is linked to a supply-house invoice. A card **refund** nets. Say parts go back to Lowe's or Home Depot. The money that comes back reads as a negative charge marked *refund* in the drilldown. It comes off the job's Parts, the same way a supply-house credit memo does. A tag can have **Show as its own cost line** ticked in Banking → Accounting → Tags. When a job's parts include purchases in such a tag, the cell carries a small line per tag. {{chip:yellow|⛽ fuel & gas $X}} is there out of the box, so pipe and fill-ups read apart. A purchase lands in a line by its accounting label's tag first, then by the bank's category. Parts and profit do not change. The lines are slices of what was already counted.
- ***Hours · days*** are approved field hours and days worked inside the window. A small **+** means the job also has hours before the window. You widen the window to charge those.
- **Gross** is revenue − team labor − subs − parts, before overhead. **Overhead** is the job's share under the method you picked. **True profit** is gross minus that, the bottom line. You hover either header for the formula. You expand a row and open ***Overhead — the math*** to see every day line.
- **%** carries a small badge saying who set it. {{chip:gray|crew report Aug 27}} is the latest field report with a %. {{chip:gray|set by office}} is the job's own % complete. It wins whenever it was typed after that report. {{chip:gray|fully collected}} means every invoice is paid and covers the contract. The report date is the date that report was filed.
- In the expanded row's chart, the green line is the job's **cash position**, not a margin. Cash position is payments received minus charges to date. If your role cannot see wages, the legend says *before team labor*.
- The expanded row's cost-by-person table ends with **% of total**. That is each person's Total as a share of the Total row, so you can see who carried the job. A tiny share reads *<1%*. The Unassigned row counts too. That row is supply-house invoices and card charges nobody is matched to.

### Burn and Proj. margin

Two columns for owners, controllers and master techs, added after **True %**:

- **Burn**: percent of the budget spent beside percent complete, {{chip:red|68% · 62%}}. The budget is the contract with your **Target** chip's share taken off. When Target is off, 35% is used. It is red and bold when spend leads progress by more than five points. It is green when progress leads. It reads `early` under three field days or 10% complete. It reads `done` on finished jobs.
- **Proj. margin**: the true margin the job is heading for. It starts from the contract. It takes off spent ÷ percent done. It takes off overhead so far. It takes off overhead per field day × the field days still to come. It is red when negative or under the Target. On a finished job it simply equals True profit. You sort by it and the jobs in trouble rise to the top. The totals row sums it over the in-progress jobs and counts how many are hot.

The same arithmetic runs on each job window's **Costs** tab. See *read the cost and value timeline on a job*. There the daily bars and the forecast explain the number.

## How day-share works

Every calendar day has an overhead pool: office labor, bid labor, and office parts. It is the same pool People → Overhead reports. Day-share hands each day's pool to jobs in two slices. It runs on three constants a dev sets for the whole app:

- **Smoothing window**: each day's pool is shared by the field hours worked over the following N days. It is not just that day. N is 30 by default. A one-hour Saturday no longer receives a whole day's office cost. A lumpy office day is spread across the month's work. It no longer lands on whoever happened to be in the field.
- **Carry share**: a slice of the pool that every **open** job carries equally per day, just for being open. It is 20% by default. Being open means scheduling, GC calls, billing. The rest follows field hours. A job is open from its Working move, or its first field day, to its Billed move.
- **Idle cap**: an open job stops carrying after this many days with no field time. It is 14 by default. The same grace runs from its start. So a job left in Working for months cannot soak up office cost.

:::example One job, one day, with the defaults
Wed Sep 2: J931 had 25.9 of the crew's 33 field hours. After smoothing, $412 landed on that day: $330 by hours and $82 of carry across the 12 jobs open that day.
J931 that day: $330 × 25.9 ÷ 33 = **$259** by hours, plus **$6.83** carry = **$266**.
:::

You add up a job's days and that is its overhead. You expand a row and open ***Overhead — the math***. It shows every day line, with *By hours* and *Carry* columns. The days it was charged carry while nobody was on site are marked *open, not worked*. The math always reconciles. What the office spent equals three parts added up. Those are what jobs were charged, what had nobody to charge, and what is still in flight.

At ***1 day · no carry*** this is exactly the original day-share. Each day's pool goes to the jobs worked that day, by hours. A day with pool $ but no field hours is charged to nobody.

## Turn the dials (devs)

Devs see {{icon:gear}} on the chip beside the Overhead control. It opens the dials. There are sliders for the smoothing window and carry share, the idle cap and what open means. A live strip shows the window's pool tying to the dollar. Moving a dial changes **this device only**. The chip turns red and says *exploring on this device*. So you can watch a job's share move before deciding. {{button:blue|Use for everyone}} writes the app default. It asks once, since true profit changes on every Job Summary. {{button:outline|Back to the app default}} stops exploring. {{button:outline|Recommended}} sets 30 days, 20% and a 14-day cap, the constants the 2026-09-10 study landed on. {{button:outline|Original day-share}} sets 1 day and no carry.

## Why the method matters

Per-hour lenses barely touch a job that sold well on few hours. A per-revenue lens takes a big bite of it. Day-share lands where the calendar puts it. It is smoothed so no single heavy office day decides a job's margin. It adds a modest daily charge for staying open. You switch the method to see the spread on any job before you trust one number.

## Older imported jobs

Under the table sits the tab's one scope control: **Hide older imported jobs with HCP # at or below** {{chip:gray|500}}. The legacy jobs imported with low HCP numbers stay out of the way by default. The line beneath says exactly what that costs you. It reads like *417 shown · 398 older imported jobs (HCP # 500 and below) hidden by the default HCP # 500 floor*. A **show all** link drops the floor and reloads the table with every job. Jobs with no HCP #, or a non-numeric one, always show. The floor you pick is remembered on this device.

:::example When the count matters
Looking for a 2024 job that isn't in the table? Read the footer first: if it says jobs are hidden, click **show all** before assuming the job is missing.
:::

## Watch-outs

- **Recorded** sessions count, for hours and for overhead. Recorded means clocked out and not rejected, approved or still awaiting approval. That is the same rule as the Labor column. Approval does not move the numbers. A rejection in People → Hours removes the session. The chip under the totals counts the sessions still awaiting review.
- Jobs that were open but never clocked inside the window are not on the ledger and receive no carry.
- Labor $ still comes from payroll crew-days × wage, as before. Hours and days come from clock sessions. They agree when time is approved and assigned.
- Overhead and true profit show for devs, leaders, and controllers, the same rule as labor $.
