---
title: read a partner's balance from the office
category: Office
roles: dev
keywords: partner, partnership, ledger, timeline, statements, balance, owe, attaching, pending charge, back-charge, hours
---
Partnerships is for devs only. It shows a partner's money on three tabs, and each tab says how its number relates to the others.

The tabs are **Ledger**, **Timeline** and **Statements**. All three read the very same records the partner sees on their own statement. So they can never disagree with each other or with the partner. They do show three different numbers on purpose.

## The three numbers, and how they relate

- **Ledger** is the settle-up balance. It counts everything that has happened, at the day it happened. It does not matter whether a statement has picked it up yet. This is the number the partner's statement shows as their balance.
- **Timeline** has a running column. It counts only what statements have **posted**: labor, additions, deductions and payouts. Charges still waiting for a statement sit inline as *pending* rows without moving it.
- **Statements** has a heading **Charges to put on this statement**. Under it, *attaching N of N · −$X* is the total of those pending charges and credits.

They fit together as **posted + attaching = ledger**, and the caption under each headline says it in words:

:::example The caption on the Ledger and Timeline headlines
posted we owe Bryan $967.60 · −$1,975.73 not yet on a statement (2) → Bryan owes us $1,008.13
:::

When nothing is pending the caption says so, and all three tabs show the same number.

## Who owes whom

Every balance carries its words: {{chip:green|we owe Bryan}} or {{chip:red|Bryan owes us}}. Hovering the number shows the convention. **+ means we owe the partner, − means the partner owes us.** It is the same sign the partner's statement and the payroll ledger use. The partner reads the mirror image: *Click owes you* or *You owe Click*.

## Hours

Labor lines on all three tabs read the hours from the stamped rate-tier days. Those are the days already stamped with their pay rate. That is the same figure the partner's statement shows. So a week reads *12.86 h* here and *12.86 h* there. The pay report you open from a labor row totals the same way.

## Paused or ended partnerships

A paused or ended partnership hides its money from the partner. These tabs show the same nothing, with a note saying why. You set the status back to **active** on the **Deal** tab to read the ledger again.

## Closing a week and what the Timeline says about it

On **Statements**, you press {{button:blue|Close week}}. It builds the statement from the partner's approved hours at the Deal-tab rates. It attaches the pending charges you left ticked. Then it posts the statement to the partner's statement page. That is the whole hand-off. The partner reads and prints it there. There is no acknowledge step for them to take, since that button was retired. So the **Timeline**'s statement rows simply read *on the partner's statement page*. A week the partner acknowledged back when the button existed keeps its *acknowledged by both* stamp.
