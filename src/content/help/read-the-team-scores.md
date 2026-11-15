---
title: read the team scores and set the hurdle
category: Office
roles: dev, master_technician, controller
keywords: scores, scorecard, hurdle, gross profit per hour, paid field hours, break-even, estimator, account manager, priced margin, labor tab, people review
order: 41
---
The Scores tab holds two numbers for the team. The field's number is gross profit on every paid hour. The estimators' number is gross profit won above the hurdle. Each has one formula, and the same formula everywhere.

## Open the tab

1. Open People → **Review** → **Scores**. A dev, the owner and anyone with payroll access see it.
2. Pick a window with {{chip:gray|Last 4 weeks}}, {{chip:gray|Last 8 weeks}} or {{chip:gray|Last 90 days}}.
3. Read the two cards. Each names its owner and its drill-down press.

## The hurdle

The hurdle is what one paid field hour has to make before the company keeps anything. Break-even is the window's overhead divided by its paid field hours. The hurdle adds the target profit per hour.

A dev sets the target under **The hurdle**. Type the dollars and press {{button:blue|Save the target}}. The hurdle follows the same window as the score.

## The field

The field card reads gross profit on every paid field hour. Gross profit is what the hours earned of their jobs' contracts, less wages, materials and subs. Wages count at the burden factor. Every paid hour on a job counts, callbacks and waiting included. An overrun hurts twice, in the labor and in the hours.

Press {{button:outline|Open the jobs}} to see one row per job with the same arithmetic. Above the jobs, one row per superintendent who runs them.

A job with hours and no bill earns nothing. The row says so and offers **Open the job to bill it**.

:::example One job row
1007 SpaceX · 520 h · earned $90,762 · labor $17,109 · materials $55,957 · subs $8,500 · gross profit $9,196 · $18/h
:::

## The estimators

The estimator and the account manager share one number. A bid counts its priced gross profit at award. It counts only when that profit over the bid's labor hours clears the hurdle. A bid awarded under the hurdle counts zero and stays at zero. Once the job is billed or paid, the actual gross profit replaces the estimate.

Press {{button:outline|Open the bids}} to see the drill-down. It lists the bids awarded above the hurdle and the jobs closed in the window. The proposals out follow, each with its days out.

## Before a bid can score

A bid can be judged only when three things are true. The bid carries a priced stamp from the Pricing workbench. Its Labor tab has hours on nine rows in ten. Every row was costed at send.

Until the first judged bid is awarded, the card shows how many priced bids can be judged. Under the bids, **Finish these before they can score** lists each one with its reason. Press **open the Labor tab** on a row to fill the hours.

## What the words mean

- **Won at award.** What the bids awarded in the window added, at their estimates.
- **Closeouts moved it.** How far the jobs that closed in the window moved their bids.
- **Still at the estimate.** The part of the number that can still move.
- **Counts zero.** Awarded under the hurdle, or with no stamp.
