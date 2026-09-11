---
title: read true profit on Job Summary
category: Office
roles: dev, master_technician, controller
keywords: burn, projected margin, spent vs done, money story, door, from pipeline, from job window, cut by, group by, by GC, by service type, by lead tech, concentration, revenue per hour, compare to, prior period, last year, target margin, job summary, true profit, overhead, day-share, smoothing, carry share, idle cap, overhead dials, in flight, open jobs, margin, finished jobs, percent complete, earned revenue, sort, window, gross profit
order: 36
---

**Job Summary** used to stop at gross: revenue minus labor, subs, and parts. Now it charges each job its share of overhead and ends at **true profit**, opens on the jobs that are finished, and lets you sort by whatever you're chasing.

## How to get there

Three doors, all landing on the same table:

- **Jobs → Job Summary**, the tab.
- **money story →** on a job's activity header on **Jobs → Pipeline** (the panel that opens on a row, and its full-screen view), right after *N% complete*. It opens Job Summary with that job expanded and scrolled into view.
- **money story →** in the header of the **job window**, next to the trade pill.

The link shows for dev, leader and controller. Assistants keep the tab but not the shortcut. If the job isn't on the list — below the job-number floor or outside the **Worked in** window — a note says so instead of scrolling to nothing.

## The controls

Go to **Jobs → Job Summary**. Above the table:

- **Show** — {{chip:blue|Finished (100%)}} opens by default: jobs whose % complete resolves to 100 — the work is done (the latest report or the job's own %) or the whole contract is billed and paid. One paid progress bill no longer marks a job finished, so a job still being worked stays under **In progress** with earned revenue. **In progress** is everything else; **All** is every job.
- **Worked in** — 90d, 6 mo, **This year** (default), 12 mo, or All. A job is in the window when it has approved field hours there, or its last work date falls inside it.
- **Overhead** — how each job's overhead share is figured. **Day-share** is the default (below); the grey chip beside it — {{chip:gray|30 days · 20% carry · 14-day idle cap}} — names the constants day-share runs on. A, B, and C are the same three lenses People → Overhead shows, applied to one job.
- Click any column header to sort. Click again to flip. The table opens sorted by true profit.

The strip under the controls totals what's showing: jobs, revenue, gross profit and margin, overhead charged, true profit and true margin, and true profit per field hour. The chips beside it say what would move the numbers: jobs with no contract $, jobs with no %, sessions still awaiting approval, overhead that had nobody to charge, overhead still **in flight** (spread past today; it lands as the days arrive), and overhead that landed on jobs this list leaves out — the HCP # floor under the table hides older imported jobs, but their field hours still take their share of the pool, so *Overhead charged* (shown jobs only) reads lower than the dials strip by exactly that amount. Lower the floor to see those jobs.

## Compare to and Target

Two chips at the end of the control row change everything above the table at once.

**Compare to** runs the same view on a second window and shows the difference. {{chip:blue|prior period}} is the same number of days immediately before your window; {{chip:blue|last year}} is the same dates a year earlier. Every tile grows a line like {{chip:green|▲ $12,400 vs prior period}} or {{chip:red|▼ 2.3 pts vs last year}}, and the margin tiles show the change in points beside the percent. Green means the move is good — for Overhead, lower is the good direction. Show, Worked in, and Overhead stay exactly as set, so the comparison is like for like.

**Target** sets the true margin you expect: 30, 35, or 40%. Jobs under it turn red in the **True %** column with a ▾, the True profit tile turns red when the whole window is under, and a chip counts them: {{chip:red|▾ 4 jobs under the 35% target}}. Sort by True % to see them first.

:::example Why "All" can't compare
"All" starts at the beginning of the clock history, so there is no earlier window to compare with. Pick a shorter Worked in and the chip wakes up.
:::

## Cut by

{{chip:blue|Cut by}} groups the table by one key — **GC**, **service type**, **lead tech**, **Account Man**, **customer**, **development**, or **bill month** — and puts a bold subtotal row above each group: revenue, costs, overhead, true profit, true margin, and $/hr. Groups rank by true profit, so the money-makers are on top and the money-losers at the bottom, with jobs that have no value for the key (no GC, not billed yet) in a bucket of their own.

A ranked bar chart sits above the table, one bar per group, green for profit and red for loss, with the margin and job count beside each. The line under the bars names the concentration — {{chip:gray|top 3 = 71% of true profit}} — which is how much of the year rides on three names. With **Target** on, groups under it get a red mark; with **Compare to** on, each subtotal shows how its margin moved in points.

:::example The question this answers
Sorted by true profit, the table says job 812 lost money. Cut by GC says one builder loses money on four jobs out of five. Cut by lead tech says whose jobs run thin. Cut by bill month is a monthly P&L in the same table.
:::

## Leakage flags

Two chips in the row and a line in the totals strip name money that left after the sale. {{chip:yellow|✂ write-down}} marks a job whose bill was agreed down; the strip totals the dollars across the window. {{chip:red|⚑ collections}} marks a job flagged for collections and not yet paid. Revenue already reflects a write-down, so true profit is honest either way — the flag says why.

## The columns

**Job** · Revenue · Labor · Subs · Parts · **Gross** · Margin · Hours · days · **Overhead** · **True profit** · True % · **$/hr** (revenue ÷ approved field hours — the realized rate) · %.

- **Job** is one cell: the trade pill and job number, the job name, and any {{chip:yellow|✂ write-down}} / {{chip:red|⚑ collections}} chip on the first line; the address in small grey type on the second. A long address is cut short with … — hover it to read the whole thing. Click the **Job** header to sort by job number.

- **Revenue** is the contract on the job. For an in-progress job it's **earned** revenue instead: contract × % complete, marked *earned* — so its costs-to-date sit next to value-to-date. No % yet? It's assumed 50% and marked *½?*.
- **Parts** now leaves out Internal Transfers (money moving between the company's own accounts) and counts a card charge only once when it's linked to a supply-house invoice. When a job's parts include purchases in a tag that has **Show as its own cost line** ticked (Banking → Accounting → Tags), the cell carries a small line per tag — {{chip:yellow|⛽ fuel & gas $X}} out of the box — so pipe and fill-ups read apart. A purchase lands in a line by its accounting label's tag first, then by the bank's category. Parts and profit don't change; the lines are slices of what was already counted.
- **Hours · days** are approved field hours and days worked inside the window. A small **+** means the job also has hours before the window; widen the window to charge those.
- **Gross** is revenue − team labor − subs − parts, before overhead. **Overhead** is the job's share under the method you picked. **True profit** is gross minus that — the bottom line. Hover either header for the formula. Expand a row and open **Overhead — the math** to see every day line.
- **%** carries a small badge saying who set it: {{chip:gray|crew report Aug 27}} (the latest field report with a %), {{chip:gray|set by office}} (the job's own % complete) or {{chip:gray|fully collected}} (every invoice paid and covering the contract). The report date fills in once the row has been expanded.
- In the expanded row's chart, the green line is the job's **cash position** — payments received minus charges to date — not a margin. If your role can't see wages, the legend says *before team labor*.
- The expanded row's cost-by-person table ends with **% of total** — each person's Total as a share of the Total row, so you can see who carried the job. A tiny share reads *<1%*; the Unassigned row (supply-house invoices and card charges nobody is matched to) counts too.

### Burn and Proj. margin

Two columns for owners, controllers and master techs, added after **True %**:

- **Burn** — percent of the budget spent beside percent complete, {{chip:red|68% · 62%}}. The budget is the contract × (100 − your **Target** chip; 35% when it's off). Red and bold when spend leads progress by more than five points; green when progress leads; `early` under three field days or 10% complete; `done` on finished jobs.
- **Proj. margin** — the true margin the job is heading for: contract − (spent ÷ percent done) − overhead so far − overhead per field day × the field days still to come. Red when negative or under the Target. On a finished job it simply equals True profit. Sort by it and the jobs in trouble rise to the top; the totals row sums it over the in-progress jobs and counts how many are hot.

The same arithmetic runs on each job window's **Costs** tab (see *read the cost and value timeline on a job*), where the daily bars and the forecast explain the number.

## How day-share works

Every calendar day has an overhead pool: office labor, bid labor, and office parts, the same pool People → Overhead reports. Day-share hands each day's pool to jobs in two slices, on three constants a dev sets for the whole app:

- **Smoothing window** — each day's pool is shared by the field hours worked over the following N days (30 by default), not just that day. A one-hour Saturday no longer receives a whole day's office cost, and a lumpy office day is spread across the month's work instead of landing on whoever happened to be in the field.
- **Carry share** — a slice of the pool (20% by default) that every **open** job carries equally per day, just for being open: scheduling, GC calls, billing. The rest follows field hours. A job is open from its Working move (or its first field day) to its Billed move.
- **Idle cap** — an open job stops carrying after this many days with no field time (14 by default), with the same grace from its start, so a job left in Working for months cannot soak up office cost.

:::example One job, one day, with the defaults
Wed Sep 2: J931 had 25.9 of the crew's 33 field hours. After smoothing, $412 landed on that day: $330 by hours and $82 of carry across the 12 jobs open that day.
J931 that day: $330 × 25.9 ÷ 33 = **$259** by hours, plus **$6.83** carry = **$266**.
:::

Add up a job's days and that's its overhead. Expand a row and open **Overhead — the math**: every day line, with *By hours* and *Carry* columns, and the days it was charged carry while nobody was on site marked *open, not worked*. The math always reconciles: what the office spent equals what jobs were charged plus what had nobody to charge plus what is still in flight.

At **1 day · no carry** this is exactly the original day-share: each day's pool to the jobs worked that day, by hours, and a day with pool $ but no field hours charged to nobody.

## Turn the dials (devs)

Devs see {{icon:gear}} on the chip beside the Overhead control. It opens the dials: sliders for the smoothing window and carry share, the idle cap and what "open" means, and a live strip showing the window's pool tying to the dollar. Moving a dial changes **this device only** — the chip turns red and says *exploring on this device* — so you can watch a job's share move before deciding. {{button:blue|Use for everyone}} writes the app default (it asks once, since true profit changes on every Job Summary); {{button:outline|Back to the app default}} stops exploring. {{button:outline|Recommended}} sets 30 days · 20% · 14-day cap, the constants the 2026-09-10 study landed on; {{button:outline|Original day-share}} sets 1 day · no carry.

## Why the method matters

Per-hour lenses barely touch a job that sold well on few hours; a per-revenue lens takes a big bite of it. Day-share lands where the calendar puts it, smoothed so no single heavy office day decides a job's margin, with a modest daily charge for staying open. Switch the method to see the spread on any job before you trust one number.

## Older imported jobs

Under the table sits the tab's one scope control: **Hide older imported jobs with HCP # at or below** {{chip:gray|500}}. The legacy jobs imported with low HCP numbers stay out of the way by default, and the line beneath says exactly what that costs you — *417 shown · 398 older imported jobs (HCP # 500 and below) hidden by the default HCP # 500 floor* — with a **show all** link that drops the floor and reloads the table with every job. Jobs with no HCP # (or a non-numeric one) always show. The floor you pick is remembered on this device.

:::example When the count matters
Looking for a 2024 job that isn't in the table? Read the footer first: if it says jobs are hidden, click **show all** before assuming the job is missing.
:::

## Watch-outs

- Only **approved, closed** sessions count, for hours and for overhead. Approve hours in People → Hours and the numbers move. The office's own sessions count the same way, so the last week or two always reads light until they are approved.
- Jobs that were open but never clocked inside the window are not on the ledger and receive no carry.
- Labor $ still comes from payroll crew-days × wage, as before; hours · days come from clock sessions. They agree when time is approved and assigned.
- Overhead and true profit show for devs, leaders, and controllers, the same rule as labor $.
