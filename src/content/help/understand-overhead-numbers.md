---
title: keep the overhead numbers accurate
category: Billing & Money
roles: dev, master_technician
keywords: overhead, overhead rate, pool, method a, method b, method c, pending approvals, recorded time, rejected, unpriced hours, wage, pay config, salary, unassigned, maintenance, hygiene, 90 day, click a bar, spike, biggest purchases, what is that, day panel, internal transfer
order: 61
---
1. If the amber maintenance strip shows, the rates can read low. Fix what it names.
2. Pending approvals: review them on **People → Hours**. Unpriced hours: set wages in **People → Users → Pay**. Unassigned salary time: assign it in **My Time**.
3. When the strip is gone, the lens rates are safe to price with.

**People → Overhead** turns the last 90 days of overhead into the rates you price with. Overhead is office time, bid time and office spending.

The rates are the daily-cost averages and the three lens rates. The lenses are per field hour, per revenue dollar and per labor dollar.

Every labor hour and dollar in those numbers comes from **recorded** clock sessions. Recorded means **clocked out** and **not rejected**, so approved or still awaiting approval. Each session is **priced with a wage**. Job labor uses the same rule, so true profit reads one clock. When wages or assignments fall behind, the numbers quietly drift low, so the tab watches for that drift. The tab shows an amber maintenance strip under the three lenses whenever something needs attention. When everything is clean, the strip disappears entirely.

## The three indicators

:::example What the strip looks like
⚠ Maintenance — worth a review before you trust the 90-day numbers above
**Pending approvals (90d)** · 14 closed sessions · 52.5h + 2 still open — Already counted as recorded time; approve, or reject to remove, in {{button:blue|People → Hours}}
**Unpriced hours (90d)** · Sam R, Tony V · 31.0h at $0 — Set wages in {{button:blue|People → Pay config}}
**Unassigned salary time (90d)** · 12 sessions · 96.0h · 1 person — Assign in My Time
:::

You hover any indicator for the exact rule it checks and the exact 90-day window it covers.

### Pending approvals

Closed sessions nobody has approved yet **already count** the moment they are clocked out. These sessions count in the overhead pool and in the field-hour and field-labor [denominators](/help/read-the-overhead-tab#click-a-lens-to-see-its-math). Approval no longer changes the overhead numbers. A **rejection** does, by removing the session. So this indicator is a review queue, not a fix list. A forgotten clock-out or a test punch prices into overhead until someone rejects it. Office and bid time is the most likely to sit unreviewed, because payroll doesn't chase it.

You review it on the **Hours** tab. You approve what's real and reject what isn't. Sessions that are still open, with no clock-out yet, are listed by count only. Open sessions count once they're clocked out.

Salary-schedule sessions are the ones the system creates for salaried people. These sessions **approve themselves** about every half hour once they close, so they no longer add to this indicator. What you see pending is real punches waiting on a human.

### Unpriced hours

A person may clock time but have no wage in **People → Users → Pay**. Then that person's sessions count hours at **$0**. The hours still land in the denominators, but no dollars reach the pool. The missing dollars deflate the daily-cost KPIs, the key numbers, and Methods B and C. Meanwhile Method A's denominator stays full. Low dollars over a full denominator is the worst combination. Every rate then reads lower than reality.

The indicator names who's unpriced. You fix it by setting an hourly wage for those people in **People → Users → Pay**. You set an office rate too, if they use one.

### Unassigned salary time

Salaried people get automatic clock sessions from their workday schedule. Those sessions start with **no job and no bid**. Unassigned time is invisible to the overhead pool entirely. A salaried office person's whole week can be missing from overhead without anything looking wrong.

You fix it by assigning those sessions to the office job, or to a bid for bid work. The person can do it themselves in **My Time**. Or an approver can set the job/bid on the session.

## Why this matters

Underreported overhead makes every job look more profitable than it is. Underreported overhead also makes the lens rates too cheap to price with. A quick weekly pass of approve, price and assign keeps the strip empty and the rates trustworthy.

## More on the Overhead tab

- [Read the Overhead tab](/help/read-the-overhead-tab): the lens math, the pool chart and its days, and who makes up the pool.
