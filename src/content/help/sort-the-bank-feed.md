---
title: sort the bank feed
category: Billing & Money
roles: dev, master_technician, assistant, controller
keywords: banking, bank feed, mercury, user sort, drag sort, accounting label, rules, approvals, approve themselves, job parts tally, tally, splits, card review, category review, reconciliation, bank statements, sync
order: 58
---
Every bank transaction gets sorted three ways, and the three live on two pages. **Which job** paid for it is sorted in **Job Parts Tally** (`/tally`). **Who** spent it and **what kind** of spend it is are sorted on **Banking** (`/banking`). The caption row under Banking's tabs says exactly that:

:::example The caption row
User Sort — who spent it · Drag Sort — what kind · Accounting — rules & approvals · Reviews — read-only · Reconciliation — against bank statements, read-only · **Jobs are sorted in Job Parts Tally; labels live here.**
:::

## Jobs: Job Parts Tally

Card holders sort their own purchases to jobs in **Job Parts Tally → Transactions** — a tap per purchase, splits when one run covered two jobs (see *sort my card purchases to jobs*). The office can do the same for any charge from Banking → **User Sort**: press **Link…** on the row and the same split window opens. Tally and Banking read and write the **same splits**, so a charge sorted in either place is sorted in both, and Moneyfill's **Card charges not split to jobs** queue drops it the moment the split saves.

## People and labels: Banking

- **User Sort** — *who*: the person on each card charge (rules can tag the person for you; a hand-set person is never overwritten). This is also where **Link…** splits a charge to jobs.
- **Drag Sort** — *what kind*: the accounting label (fuel, supply house, insurance, …). Drag a transaction onto its label, or tag it from the row.
- **Accounting** — the **rules** that suggest labels by counterparty, amount, description or bank category, and the **Approvals** list where suggestions wait for an OK. Approve one, {{button:green|Approve all (12)}}, or leave the approving to the rules:

:::example The org-wide switch
{{chip:gray|Rule matches approve themselves (org-wide · on)}} — every new rule match is approved the moment it is created, as the bank feed arrives or when someone clicks **Apply rules**. Off, matches wait in Approvals. One switch for the whole company; a dev or leader flips it. Two things always wait for a person even when it is on: an Internal Transfers suggestion on a transaction that already has job splits, and anything created before the switch was turned on.
:::

- **Card Review** and **Category Review** — read-only pivots of the labels above (who spent what, by card and by category). Card Review's **Unassigned** row counts transfers and payouts too until you set its {{chip:gray|Kind}} filter to **Card charges only**.
- **Reconciliation** — checks the books **against Mercury's bank statements**, one closed month at a time, and tells you whether every statement transaction is in the books. It is **read-only**: it writes nothing, saves nothing, and the result is gone when you leave the tab. It is *not* the sync — the sync that pulls new bank transactions in runs by itself every half hour and needs no button.

## What is not on Banking

Money that leaves by **ACH, wire or check** — rent, insurance, contract labor, the card bill — is labeled on **Moneyfill → Bank transfers needing attribution**, not here (see *label bank transfers and wires*). Bank **deposits** are matched to the bills they pay in **Accounts Receivable**, not here (see *match bank deposits to the bills they pay*).

## Where the sorting shows up

Sorted charges are job costs on the Bill tab's cost timeline, in Crew P&L and in the weekly money report; labels feed the overhead numbers and Banking → **Visuals**. Quickfill's **Banking sorting** station carries a {{chip:yellow|Close week: $1,206 open}} chip while the previous week still has unsorted charges or unlabeled transfers — the Monday close (see *close the money week*) is what finally empties it.
