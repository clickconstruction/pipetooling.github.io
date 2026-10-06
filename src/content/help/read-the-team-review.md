---
title: read the team review
category: Billing & Money
roles: dev
keywords: review, team summary, profit after overhead, ranked, verdict, prior period, trend, math, drawer, hygiene, pending approvals, no bill, percent complete, salaried, field crew, office
order: 63
---
People → Review answers three questions about a period, in order. How did the team do, who carried it, and where does each person's number come from.

It opens on the **Ranked** view. The classic column table is one click away with {{button:outline|Table}}. The tab remembers which you last used.

## The verdict

The first card is **profit after overhead** for the period. A pill compares it to the period just before it. That prior period is the same length, ending the day before this one starts. {{chip:green|↑ +8% vs the prior period}} means the team earned more this time. {{chip:yellow|↓ −12% vs the prior period}} means less. Anything inside ±5% reads as **flat**. Under it the card says how many people are field crew and what they earned per field hour. It says how many are office & bids and what their time cost. It says how many logged no time at all.

The second card shows **how gross became profit**. It is one bar split into parts. The parts are subs & labor, overhead labor, parts burden, and profit. Each shows the dollars and its share of gross.

## What is skewing the numbers

An amber strip appears when something is quietly distorting the period. Each line says what and where to fix it:

:::example What the strip looks like
**119 sessions · 619.6 h awaiting approval** — 12 people, oldest 122 days ago — not counted anywhere until approved. {{button:blue|Approve in Hours ›}}
**3 jobs have no bill amount** — labor there lands as pure loss. {{button:blue|Open Jobs ›}}
**10 jobs have no % complete** — they count as half done, so half the bill is treated as earned and the share is marked *(assumed)*. {{button:blue|Set progress ›}}
**$478 of office-type charges on 3 field jobs** — 3 card charges the bank filed as software, utilities, insurance, internet or medical count as parts there — usually office spend, sometimes a dump fee or permit (Post Oak Landfill $397, City of Shavano Park $68, Dropbox $13). Confirm or re-sort. {{button:blue|Sort in Banking ›}}
:::

The office-type line reads the bank's own category on each card purchase. So it is a prompt, not a verdict. A landfill fee filed under Utilities is a real job cost and can stay. A software subscription on a field job belongs on the office job. Both are fixed in {{button:blue|Banking → Sorting}}.

When the period is clean the strip disappears.

## The ranking

Everyone sits on one axis. Bars grow to the right of the zero line for profit and to the left for losses. **Office & bids** people are negative by construction. Their wages are the overhead pool. So a red bar there is the cost of running the office, not a bad job. The Overhead tab is where that pool is judged. Here it only shows who it is. ***(s)*** marks a salaried person. Their hours are their clocked sessions, like everyone else's.

You change the axis with **Rank by**. The choices are profit after overhead, profit per hour, gross revenue, or net revenue. You type in **Search by name** to narrow the list.

## Coming here from the Bridge

A name on the Bridge's Vectors panel opens this tab on that pay week with the person already expanded. The address carries the week and the name, so it can be shared. The tab reads it once and then behaves like any other visit. You can change the period or click another name freely.

## Where a number comes from

You click a name. The drawer beside the list shows the formula with this period's figures:

:::example Malachi · where $20,175 comes from
Gross revenue **$49,063** — 18 jobs, each job's bill × % complete, then his share by labor cost
− Parts & job purchases **−$9,412** — tally, supply invoices, billed materials, card purchases outside the lines below
− ⛽ Fuel & gas **−$2,306** — card charges in the Fuel & gas tag (the purchase's accounting label, else the bank's category), his own fuel on the jobs included
− Subs & team labor **−$15,319**
Net revenue **$22,026**
− Own office / bid wages **−$604** — 10.5 h of office and bid sessions
− Parts burden **−$828** — 165.5 field h × $5.00
− 🚚 2019 Ford F-150 **−$419** — 165.5 field h × $2.24 fixed + $48.10 of his fuel on no job in the period
Profit after overhead **$20,175** · ÷ 176 clocked hours = **$115/hr**
:::

**What moves it** lists the things that would change that number the most. Those are jobs with no % complete and how much of his gross rides on them. Jobs with no bill amount. One job carrying most of the total. The worst job in the period. Hours that landed on no job. And crew assignments with zero hours. **Watch-outs** are the standing caveats. Revenue uses today's % complete, so a period's number moves when a job progresses later. Only a person's own office time is charged as overhead here.

### The vehicle deal

Each person's **Vehicle** on Pay config decides one more line. Their fuel stays on the jobs it was put on, like everyone's. It shows in the ⛽ line, shared like every job cost. So the vehicle line charges only what is not on a job.

- {{chip:green|🚚 $2.24/h fixed}} means a company truck. The line is the truck's insurance, registration and service per field hour. It adds their fuel that is on no job.
- {{chip:blue|🚗 own}} means their own vehicle with fuel paid. The line is their fuel that is on no job.
- A truck with no insurance, registration or service on file charges only that fuel.

The chip sits beside the name on every ranked bar. The fixed rates come from People → Vehicles → Wheels.

## How earned is counted

Review counts a person's revenue the way the Bridge does. So the two agree to the dollar for the same hours:

- **Value created on a job** = the contract × how far along it is. A job that is ready to bill, billed, or paid is 100% whatever its % says. A job with a % uses it. A job with no % is counted as **half done** and marked *(assumed)*. You set the % and the mark goes away.
- **Your share of that value** = your clock hours on the job this period ÷ the job's lifetime clock hours. Lifetime clock hours count every person on the job. Wages play no part. So two people with the same hours on the same job get the same share.
- **Sub labor sheets** are a job cost. They have no clock hours, so they never earn a share of revenue. They show on the cost side.

:::example The Gross drilldown
Job · Total bill $10,000 · % complete 40% · Value created $4,000 · Your hours (period) 8.0 · Job hours (lifetime) 100.0 · Share 8.0% · Allocated $320
:::

## Jobs worked, per job

Below the drawer, **Jobs Worked** lists one line per job, best profit first. Each line shows your hours and labor on it and your share of the job's lifetime hours. It shows your revenue and profit and the per-hour rates. The heading says how many day rows sit behind the lines and how many of those carry zero hours. Two chips call out jobs that distort the math. {{chip:yellow|no bill}} means labor there is pure loss until a bill amount is set. {{chip:yellow|% assumed}} means no % complete on the ledger, so the job is counted as half done.

You click a job line to open its days. Each day row is what it always was. You click it again for the full breakdown of that day's revenue, costs, and the three overhead methods.

## Tasks that pile up

**Tasks outstanding** folds a recurring item into one line instead of listing every missed instance:

:::example A recurring item, collapsed
↻ **Review PipeTooling Jobs** · weekly · 34 open · **29 missed** since 2026-02-18 · 5 upcoming — next 2026-09-09
:::

One-off tasks still show one per line with their scheduled date. The heading tells you how many lines the list folded down to.

**Hours and Pay** and **Reports Filed** are unchanged.

## When you want the columns

{{button:outline|Table}} brings back the Team Summary table with every column. It has the per-cell drilldowns, Print, and Open in new window. The two views read the same numbers, so switching never changes a total.
