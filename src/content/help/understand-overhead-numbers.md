---
title: keep the overhead numbers accurate
category: Billing & Money
roles: dev, master_technician
keywords: overhead, overhead rate, pool, method a, method b, method c, pending approvals, recorded time, rejected, unpriced hours, wage, pay config, salary, unassigned, maintenance, hygiene, 90 day
order: 61
---
**People → Overhead** turns the last 90 days of office time, bid time, and office spending into the overhead rates you price with — the daily-cost averages and the three lens rates (per field hour, per revenue dollar, per labor dollar).

Every labor hour and dollar in those numbers comes from **recorded** clock sessions — **clocked out** and **not rejected** (approved or still awaiting approval) — **priced with a wage**. That is the same rule job labor uses, so true profit reads one clock. When wages or assignments fall behind, the numbers quietly drift low — so the tab watches for it and shows an amber maintenance strip under the three lenses whenever something needs attention. When everything is clean, the strip disappears entirely.

## Click a lens to see its math

Each of the three lens cards is a button. {{button:outline|See the math ›}} opens a window that shows the actual arithmetic with today's numbers — the pool on top (office labor, bid labor, office parts, each itemized), the denominator underneath with the exact rule for what counts, and the result.

Below that, **How it moved** charts the rate week by week across the 90 days with a rolling 4-week line and a dashed line for the 90-day headline, so you can see whether this week is unusual or the whole quarter is drifting.

**What moves it** lists the levers, each sized at today's numbers — for example *"+100 hr → −$0.51/hr"* on Method A, or *"+$10,000 invoiced → −0.34 pts"* on Method B. Green arrows lower the rate, amber arrows raise it. When field time is awaiting approval, Method A also shows what the rate would read once it's approved.

**Watch-outs** names the ways each lens can mislead — salaried hourly pricing on A, billing rhythm on B, raises lowering C — and states plainly whether any session is being counted on both sides of the math.

## Is the pool going up or down?

The **Overhead pool — 90 days** card answers that directly. Its pill compares the average $/day over the last 30 days with the 30 days before: {{chip:yellow|↑ Trending up · +12%}} means overhead is growing, {{chip:green|↓ Trending down · −8%}} means it's shrinking, and anything inside ±5% reads as **flat** so a single parts spike doesn't flip the arrow.

Under the pill is the ledger of what the pool is made of — **office labor**, **bid labor**, and **office parts**, each with its dollars and share — and a day-by-day chart stacked the same way with a 7-day average line. Hover any bar for that day's split.

:::example Reading a flat pill with a rising chart
If the pill says flat but the bars climb across the last two weeks, the rise is recent and hasn't moved the 30-day average yet — check back in a week, or read the 7-day line, which reacts sooner.
:::

## Who makes up the pool

The **Who makes up overhead** table lists every person with office or bid time (or office-job card purchases) in the window — one row each, with columns for **office labor**, **bid labor**, **office parts**, and **total**. Every cell shows the dollars and that person's share of the column, so the biggest contributors read at a glance; the Pool row at the bottom shows each column's share of the whole.

Switch the window with the chips: {{chip:blue|Today}} {{chip:gray|Last 7 days}} {{chip:gray|Last 30 days}} {{chip:gray|Last 90 days}} — the numbers re-slice instantly, nothing reloads.

:::example Where purchases land
A Mercury card purchase on the office job goes to the cardholder (by card nickname). Supply-house invoices, ACH/wire payments, and tally lines don't belong to a person, so they sit on an italic last row — that way the parts column still adds up to the pool instead of quietly shrinking.
:::

## The three indicators

:::example What the strip looks like
⚠ Maintenance — worth a review before you trust the 90-day numbers above
**Pending approvals (90d)** · 14 closed sessions · 52.5h + 2 still open — Already counted as recorded time; approve, or reject to remove, in {{button:blue|People → Hours}}
**Unpriced hours (90d)** · Sam R, Tony V · 31.0h at $0 — Set wages in {{button:blue|People → Pay config}}
**Unassigned salary time (90d)** · 12 sessions · 96.0h · 1 person — Assign in My Time
:::

Hover any indicator for the exact rule it checks and the exact 90-day window it covers.

### Pending approvals

Closed sessions nobody has approved yet **already count** — in the overhead pool and in the field-hour and field-labor denominators — the moment they are clocked out. Approval no longer changes the overhead numbers; a **rejection** does, by removing the session. So this indicator is a review queue, not a fix list: a forgotten clock-out or a test punch prices into overhead until someone rejects it. Office and bid time is the most likely to sit unreviewed, because payroll doesn't chase it.

Review it on the **Hours** tab: approve what's real, reject what isn't. Sessions that are still open (no clock-out yet) are listed by count only — they count once they're clocked out.

Salary-schedule sessions (the ones the system creates for salaried people) **approve themselves** about every half hour once they close, so they no longer add to this indicator — what you see pending is real punches waiting on a human.

### Unpriced hours

If a person clocks time but has no wage in **Pay config**, their sessions count hours at **$0**: the hours still land in the denominators, but no dollars reach the pool. That deflates the daily-cost KPIs and Methods B and C while Method A's denominator stays full — the worst combination, because every rate reads lower than reality.

The indicator names who's unpriced. Fix it by setting an hourly wage (and an office rate, if they use one) for those people in {{button:blue|People → Pay config}}.

### Unassigned salary time

Salaried people get automatic clock sessions from their workday schedule. Those sessions start with **no job and no bid**, and unassigned time is invisible to the overhead pool entirely — a salaried office person's whole week can be missing from overhead without anything looking wrong.

Fix it by assigning those sessions to the office job (or a bid, for bid work) — the person can do it themselves in **My Time**, or an approver can set the job/bid on the session.

## Why this matters

Underreported overhead makes every job look more profitable than it is, and makes the lens rates too cheap to price with. A quick weekly pass — approve, price, assign — keeps the strip empty and the rates trustworthy.
