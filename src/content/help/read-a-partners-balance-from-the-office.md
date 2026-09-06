---
title: read a partner's balance from the office
category: Office
roles: dev
keywords: partner, partnership, ledger, timeline, statements, balance, owe, attaching, pending charge, back-charge, hours
---
**Partnerships** (dev only) shows a partner's money on three tabs — **Ledger**, **Timeline** and **Statements**. All three read the very same records the partner sees on their own statement, so they can never disagree with each other or with the partner. They do show three different numbers on purpose, and each tab says how its number relates to the others.

## The three numbers, and how they relate

- **Ledger** — the settle-up balance: everything that has happened, at the day it happened, whether or not a statement has picked it up yet. This is the number the partner's statement shows as their balance.
- **Timeline** — the running column counts only what statements have **posted**: labor, additions, deductions and payouts. Charges still waiting for a statement sit inline as *pending* rows without moving it.
- **Statements** — under **Charges to put on this statement**, *attaching N of N · −$X* is the total of those pending charges (and credits).

They fit together as **posted + attaching = ledger**, and the caption under each headline says it in words:

:::example The caption on the Ledger and Timeline headlines
posted we owe Bryan $967.60 · −$1,975.73 not yet on a statement (2) → Bryan owes us $1,008.13
:::

When nothing is pending the caption says so, and all three tabs show the same number.

## Who owes whom

Every balance carries its words — {{chip:green|we owe Bryan}} or {{chip:red|Bryan owes us}} — and hovering the number shows the convention: **+ means we owe the partner, − means the partner owes us**, the same sign the partner's statement and the payroll ledger use. The partner reads the mirror image (*Click owes you* / *You owe Click*).

## Hours

Labor lines on all three tabs read the hours from the stamped rate-tier days — the same figure the partner's statement shows — so a week reads *12.86 h* here and *12.86 h* there. The pay report you open from a labor row totals the same way.

## Paused or ended partnerships

A paused or ended partnership hides its money from the partner, and these tabs show the same nothing — with a note saying why. Set the status back to **active** on the **Deal** tab to read the ledger again.

## Closing a week and what the Timeline says about it

On **Statements**, {{button:blue|Close week}} builds the statement from the partner's approved hours at the Deal-tab rates, attaches the pending charges you left ticked, and posts it to the partner's statement page — that is the whole hand-off. The partner reads and prints it there; there is no acknowledge step for them to take (that button was retired), so the **Timeline**'s statement rows simply read *on the partner's statement page*. A week the partner acknowledged back when the button existed keeps its *acknowledged by both* stamp.
