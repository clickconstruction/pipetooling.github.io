---
title: read the Bridge
category: Money
roles: dev
keywords: bridge, ship, course, earned revenue, projection, target, destination, overhead, burn, climb, hazards, corrections, chart table
order: 62
---
**The Bridge** (devs only for now — the compass icon in the header, or **Bridge** in the ☰ menu; `/bridge`) is the company as a ship's computer: where we are, how fast we're climbing, where we're trying to get to, and what's in the way. One clock — days.

## The course chart

The solid line is the **track**: cumulative net over the last 8 weeks, where net = earned revenue − direct cost − overhead, day by day. The dashed line is the **projection** — the same climb rate carried 8 weeks forward. The dotted green line is the **destination**: type the net you want to add over the next 8 weeks into the box under the chart and {{button:outline|Set}}. The readout above the chart says it plainly: **Makes port** or **Misses port by $X at current speed**.

Hover any day on the track for that day's earned, direct, overhead, and running total. Red ▼ marks are supply invoices coming due — cash events, so they sit on the date axis and don't bend the net line.

## The three instruments

- **Speed** — net climb per day (14-day average): earned per day minus burn per day, with burn split into direct and overhead. Overhead is drag: it accrues whether or not the crews are moving.
- **Fuel** — money in flight: owed to you, owed by you, not yet billed, and what's in collections. Cash runway isn't wired until the app syncs a bank balance.
- **Engine** — crew hours in the last 7 days: approved field time, office + bid time, and how much is still awaiting approval.

## Course corrections

Each row is a lever sized at today's numbers — win a bid that's due soon, cut overhead by a tenth, add a field day a week. Tick one and the projection bends; the verdict updates. Levers that move **cash** but not net (bill the Ready-to-bill jobs, collect collections) are listed underneath rather than plotted.

## The hull strip

When it shows, the instruments read low: unapproved hours, unsorted bank transfers or card purchases, open jobs with no % complete (assumed half done), and worked jobs with no contract price (earning $0). Clear those and the track becomes true.

## How earned revenue is counted

Each approved field hour earns its job's contract ÷ the job's expected hours. Finished jobs are 100%; open jobs use their % complete; a job with no % is assumed half done. It's a labor-weighted percentage of completion — simple on purpose, and the footer under the chart shows the window's totals so you can sanity-check it.
