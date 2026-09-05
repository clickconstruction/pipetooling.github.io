---
title: read true profit on Job Summary
category: Office
roles: dev, master_technician, controller
keywords: cut by, group by, by GC, by service type, by lead tech, concentration, revenue per hour, compare to, prior period, last year, target margin, job summary, true profit, overhead, day-share, margin, finished jobs, percent complete, earned revenue, sort, window, gross profit
order: 36
---

**Job Summary** used to stop at gross: revenue minus labor, subs, and parts. Now it charges each job its share of overhead and ends at **true profit**, opens on the jobs that are finished, and lets you sort by whatever you're chasing.

## The controls

Go to **Jobs → Job Summary**. Above the table:

- **Show** — {{chip:blue|Finished (100%)}} opens by default: jobs whose % complete resolves to 100 (paid invoices, the latest report, or the job's own %). **In progress** is everything else; **All** is every job.
- **Worked in** — 90d, 6 mo, **This year** (default), 12 mo, or All. A job is in the window when it has approved field hours there, or its last work date falls inside it.
- **Overhead** — how each job's overhead share is figured. **Day-share** is the default (below). A, B, and C are the same three lenses People → Overhead shows, applied to one job.
- Click any column header to sort. Click again to flip. The table opens sorted by true profit.

The strip under the controls totals what's showing: jobs, revenue, gross profit and margin, overhead charged, true profit and true margin, and true profit per field hour. The chips beside it say what would move the numbers: jobs with no contract $, jobs with no %, sessions still awaiting approval, and overhead that fell on days with no field work.

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

## The columns

Revenue · Labor · Subs · Parts · **Gross** · Margin · Hours · days · **Overhead** · **True profit** · True % · **$/hr** (revenue ÷ approved field hours — the realized rate) · %.

- **Revenue** is the contract on the job. For an in-progress job it's **earned** revenue instead: contract × % complete, marked *earned* — so its costs-to-date sit next to value-to-date. No % yet? It's assumed 50% and marked *½?*.
- **Parts** now leaves out Internal Transfers (money moving between the company's own accounts) and counts a card charge only once when it's linked to a supply-house invoice. When a job's parts include purchases in a tag that has **Show as its own cost line** ticked (Banking → Accounting → Tags), the cell carries a small line per tag — {{chip:yellow|⛽ fuel & gas $X}} out of the box — so pipe and fill-ups read apart. A purchase lands in a line by its accounting label's tag first, then by the bank's category. Parts and profit don't change; the lines are slices of what was already counted.
- **Hours · days** are approved field hours and days worked inside the window. A small **+** means the job also has hours before the window; widen the window to charge those.
- **Overhead** is the job's share under the method you picked. **True profit** is gross minus that. Expand a row and open **Overhead — the math** to see every day line.

## How day-share works

Every calendar day has an overhead pool: office labor, bid labor, and office parts, the same pool People → Overhead reports. Each day's pool goes to the jobs worked that day, split by that day's approved field hours.

:::example One job, one day
Sep 2: J931 had 25.9 of the crew's 33 field hours. The day's pool was $1,180.
J931's share that day: $1,180 × 25.9 ÷ 33 = **$926**.
:::

Add up a job's days and that's its overhead. The shares across every job on a day equal that day's pool exactly, so nothing is double-charged. A day with pool $ but no field hours (a weekend, a rain day) is charged to nobody; the strip shows how much that was.

## Why the method matters

Per-hour lenses barely touch a job that sold well on few hours; a per-revenue lens takes a big bite of it. Day-share lands where the calendar puts it: a job that was most of the field on a heavy office day pays for that day. Switch the method to see the spread on any job before you trust one number.

## Watch-outs

- Only **approved, closed** sessions count, for hours and for overhead. Approve hours in People → Hours and the numbers move.
- Labor $ still comes from payroll crew-days × wage, as before; hours · days come from clock sessions. They agree when time is approved and assigned.
- Overhead and true profit show for devs, masters, and controllers, the same rule as labor $.
