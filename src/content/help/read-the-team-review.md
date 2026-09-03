---
title: read the team review
category: Billing & Money
roles: dev
keywords: review, team summary, profit after overhead, ranked, verdict, prior period, trend, math, drawer, hygiene, pending approvals, no bill, percent complete, salaried, field crew, office
order: 63
---
**People → Review** answers three questions about a period, in order: how did the team do, who carried it, and where does each person's number come from. It opens on the **Ranked** view; the classic column table is one click away with {{button:outline|Table}} and the tab remembers which you last used.

## The verdict

The first card is **profit after overhead** for the period, with a pill comparing it to the period just before it — the same length, ending the day before this one starts. {{chip:green|↑ +8% vs the prior period}} means the team earned more this time, {{chip:yellow|↓ −12% vs the prior period}} less, and anything inside ±5% reads as **flat**. Under it: how many people are field crew and what they earned per field hour, how many are office & bids and what their time cost, and how many logged no time at all.

The second card shows **how gross became profit**: one bar split into parts, subs & labor, overhead labor, parts burden, and profit, with the dollars and share of gross for each.

## What is skewing the numbers

An amber strip appears when something is quietly distorting the period. Each line says what and where to fix it:

:::example What the strip looks like
**119 sessions · 619.6 h awaiting approval** — 12 people, oldest 122 days ago — not counted anywhere until approved. {{button:blue|Approve in Hours ›}}
**3 jobs have no bill amount** — labor there lands as pure loss. {{button:blue|Open Jobs ›}}
**10 jobs have no % complete** — they count as 100% done, so their whole bill is treated as earned. {{button:blue|Set progress ›}}
**$478 of office-type charges on 3 field jobs** — 3 card charges the bank filed as software, utilities, insurance, internet or medical count as parts there — usually office spend, sometimes a dump fee or permit (Post Oak Landfill $397, City of Shavano Park $68, Dropbox $13). Confirm or re-sort. {{button:blue|Sort in Banking ›}}
**Salaried hours are assumed for 2 people** — 8 h every weekday in the period, including today — not clock time.
:::

The office-type line reads the bank's own category on each card purchase, so it is a prompt, not a verdict: a landfill fee filed under "Utilities" is a real job cost and can stay; a software subscription on a field job belongs on the office job. Both are fixed in {{button:blue|Banking → Sorting}}.

When the period is clean the strip disappears.

## The ranking

Everyone sits on one axis. Bars grow to the right of the zero line for profit and to the left for losses. **Office & bids** people are negative by construction — their wages are the overhead pool, so a red bar there is the cost of running the office, not a bad job. The Overhead tab is where that pool is judged; here it only shows who it is. **(s)** marks a salaried person, whose hours are assumed rather than clocked.

Change the axis with **Rank by**: profit after overhead, profit per hour, gross revenue, or net revenue. Type in **Search by name** to narrow the list.

## Where a number comes from

Click a name. The drawer beside the list shows the formula with this period's figures:

:::example Malachi · where $21,894 comes from
Gross revenue **$49,063** — 18 jobs, each job's bill × % complete, then his share by labor cost
− Parts, subs & team labor **−$25,737**
Net revenue **$23,326**
− Own office / bid wages **−$604** — 10.5 h of office and bid sessions
− Parts burden **−$828** — 165.5 field h × $5.00
Profit after overhead **$21,894** · ÷ 176 assumed hours = **$124/hr**
:::

**What moves it** lists the things that would change that number the most: jobs with no % complete and how much of his gross rides on them, jobs with no bill amount, one job carrying most of the total, the worst job in the period, hours that landed on no job, and crew assignments with zero hours. **Watch-outs** are the standing caveats — revenue uses today's % complete, so a period's number moves when a job progresses later, and only a person's own office time is charged as overhead here.

## Jobs worked, per job

Below the drawer, **Jobs Worked** lists one line per job, best profit first: your hours and labor on it, your share of the job's lifetime labor, your revenue and profit, and the per-hour rates. The heading says how many day rows sit behind the lines and how many of those carry zero hours. Two chips call out jobs that distort the math: {{chip:yellow|no bill}} (labor there is pure loss until a bill amount is set) and {{chip:yellow|% assumed}} (no % complete on the ledger, so the whole bill is treated as earned).

Click a job line to open its days. Each day row is what it always was — click it again for the full breakdown of that day's revenue, costs, and the three overhead methods.

## Tasks that pile up

**Tasks outstanding** folds a recurring item into one line instead of listing every missed instance:

:::example A recurring item, collapsed
↻ **Review PipeTooling Jobs** · weekly · 34 open · **29 missed** since 2026-02-18 · 5 upcoming — next 2026-09-09
:::

One-off tasks still show one per line with their scheduled date. The heading tells you how many lines the list folded down to.

**Hours and Pay** and **Reports Filed** are unchanged.

## When you want the columns

{{button:outline|Table}} brings back the Team Summary table with every column, the per-cell drilldowns, Print, and Open in new window. The two views read the same numbers, so switching never changes a total.
