---
title: read the Estimating Health section
category: Office
roles: dev, master_technician, assistant, estimator
keywords: estimating health, pulse, weekly bids sent, won rate, win rate, scoreboard, bands, charging too much, field, people cards, waiting, hide people, hidden, archived
order: 69
---
At the bottom of **Bids → Bid Board** (the **Health** pill jumps there) lives Estimating Health — the **Pulse**: your estimating record with every number one click from its bids. (It replaced the old weekly table + sliders + Scoreboard layout; same rules, same math.)

## The pulse

Six stat cards up top: **Sent** (count and total $), **Avg / week** (the average sent value per week across the whole window — quiet weeks count, so it's the honest run rate), **Last 4 weeks**, **Won rate by count**, **Won rate by $**, and **Still waiting** (the outstanding pile). The two won rates answer different questions — by count treats every bid the same; by $ tells you whether you're winning the *money*.

Below them, one bar per week (last 26, oldest → newest). Each bar splits by the bids' *current* outcome:

- green — won (Started or complete counts as won, same as the Scoreboard),
- amber — still waiting on the GC,
- red — lost.

An amber tail on an *older* week is your follow-up list — those bids have been waiting a while. **Click any bar** to list that week's bids and open one. Bar heights are √-scaled so one huge week doesn't flatten the rest; the labels above each bar carry the true totals.

:::example Reading a week
A bar labeled **$8.2M · 7** that's mostly amber with a green cap: seven bids went out that week totaling $8.2M — one has been won, the rest are still waiting.
:::

## Where everyone stands

Your five interpretation bands — **Charging too much / Full on work / Balanced / Hungry for work / Charging too little** — drawn once as a shared field. Each person hangs under the bar at their won %, and the dark **ALL** marker is the company. A *dashed* name means fewer than 5 decided bids: read that as noise, not signal. Hover a name for the record.

## People

One card per person — their **Estimator** and **Account Man** sides live on the same card, each on its own line:

- the header counts each bid **once**, even when they hold both roles on it,
- the little bars are their weekly sent volume,
- {{chip:green|W 8}} {{chip:red|L 21}} {{chip:yellow|⏳ 46}} click through to the actual bids,
- the marker on the mini-band is their won % for that role, and the numbers after it read like **28% · 23% $** — by count, then by dollars. A `*` marks a small sample; hover the line for the full sentence.

Every number follows the same outcome rules the old Scoreboard used, so historic comparisons still hold — the Pulse just shows them at a glance.

## Hiding people

The **✕** in a card's corner hides that person — their card and their band marker disappear from *your* view (each device remembers its own hides). Everyone you've hidden collects in a **Hidden:** row under the People heading; click a name chip to bring them back, or **Show all** to reset.

People with **archived** accounts start hidden automatically — they show up in the Hidden row with an {{chip:yellow|archived}} tag if their old bids are still in the current view.

:::example What hiding does — and doesn't
Hide a former estimator and their card and marker vanish, but the weekly bars, the stat cards, and the dark **ALL** marker don't move — hiding is only about what *you* look at, never about the company math.
:::
