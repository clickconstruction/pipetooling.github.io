---
title: read the Estimating Health section
category: Office
roles: dev, master_technician, assistant, estimator
keywords: estimating health, pulse, weekly bids sent, won rate, win rate, scoreboard, bands, charging too much, field, people cards, waiting, hide people, hidden, archived
order: 69
---
Estimating Health lives at the bottom of Bids → Bid Board. It is your estimating record, with every number one click from its bids.

The **Health** pill jumps there. The section is also called the **Pulse**. It replaced the old weekly table, sliders and Scoreboard layout. Same rules, same math.

## The pulse

Seven stat cards sit up top. **Sent** is the count and total $. **Avg / week** is the average sent value per week across the whole window. Quiet weeks count, so it's the honest run rate. **Won / week** is the same average for value you actually won. Then come **Last 4 weeks**, **Won rate by count** and **Won rate by $**. **Still waiting** is the outstanding pile. The two won rates answer different questions. By count treats every bid the same. By $ tells you whether you're winning the money.

Below them sits one bar per week, the last 26, oldest to newest. Each bar splits by the bids' current outcome:

- green is won. Started or complete counts as won, same as the Scoreboard.
- amber is still waiting on the GC, the general contractor.
- red is lost.

An amber tail on an older week is your follow-up list. Those bids have been waiting a while. **Click any bar** to list that week's bids and open one. Bar heights are √-scaled, on a square-root scale, so one huge week doesn't flatten the rest. The labels above each bar carry the true totals.

:::example Reading a week
A bar labeled **$8.2M · 7** that's mostly amber with a green cap: seven bids went out that week totaling $8.2M — one has been won, the rest are still waiting.
:::

## Where everyone stands

Your five interpretation bands are drawn once as a shared field. They are **Charging too much / Full on work / Balanced / Hungry for work / Charging too little**. Each person hangs under the bar at their won %. The dark **ALL** marker is the company. A dashed name means fewer than 5 decided bids. Read that as noise, not signal. Hover a name for the record.

## People

There is one card per person. Their **Estimator** and **Account Man** sides live on the same card, each on its own line:

- the header counts each bid **once**, even when they hold both roles on it,
- the little bars are their weekly sent volume,
- {{chip:green|W 8}} {{chip:red|L 21}} {{chip:yellow|⏳ 46}} click through to the actual bids,
- the marker on the mini-band is their won % for that role. The numbers after it read like ***28% · 23% $***, by count, then by dollars. A `*` marks a small sample. Hover the line for the full sentence.

Every number follows the same outcome rules the old Scoreboard used. So historic comparisons still hold. The Pulse just shows them at a glance.

## Hiding people

The **✕** in a card's corner hides that person. Their card and their band marker disappear from your view. Each device remembers its own hides. Everyone you've hidden collects in a **Hidden:** row under the People heading. You click a name chip to bring them back, or **Show all** to reset.

People with **archived** accounts start hidden automatically. They show up in the Hidden row with an {{chip:yellow|archived}} tag. That happens if their old bids are still in the current view.

:::example What hiding does — and doesn't
Hide a former estimator and their card and marker vanish, but the weekly bars, the stat cards, and the dark **ALL** marker don't move — hiding is only about what *you* look at, never about the company math.
:::
