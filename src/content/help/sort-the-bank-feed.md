---
title: sort the bank feed
category: Billing & Money
roles: dev, master_technician, controller
keywords: banking, bank feed, mercury, user sort, drag sort, accounting label, rules, approvals, approve themselves, job parts tally, tally, splits, card review, category review, reconciliation, bank statements, sync
order: 58
---
Every bank transaction gets sorted three ways: which job, who spent it, and what kind of spend. The three live on two pages, Job Parts Tally and Banking.

**Which job** paid for it is sorted in **Job Parts Tally**, at `/tally`. **Who** spent it and **what kind** of spend it is are sorted on **Banking**, at `/banking`. The caption row under Banking's tabs says exactly that:

:::example The caption row
User Sort — who spent it · Drag Sort — what kind · Accounting — rules & approvals · Reviews — read-only · Reconciliation — against bank statements, read-only · **Jobs are sorted in Job Parts Tally; labels live here.**
:::

## Jobs: Job Parts Tally

Card holders sort their own purchases to jobs in **Job Parts Tally → Transactions**. Sorting takes a tap per purchase. When one purchase covered two jobs, they split it. See *sort my card purchases to jobs*. The office can do the same for any charge from Banking → **User Sort**. Press **Link…** on the row and the same split window opens. Tally and Banking read and write the **same splits**. So a charge sorted in either place is sorted in both. Moneyfill's **Card charges not split to jobs** queue drops it the moment the split saves.

## People and labels: Banking

- **User Sort** is *who*: the person on each card charge. Rules can tag the person for you. A hand-set person is never overwritten. User Sort is also where **Link…** splits a charge to jobs.
- **Drag Sort** is *what kind*: the accounting label, like fuel, supplies or insurance. Drag a transaction onto its label. Or press **Quick Sort** to label them one at a time.
- **Accounting** holds the **rules** that suggest labels by counterparty, amount, description or bank category. A counterparty is who the money went to or came from. Accounting also holds the **Approvals** list, where suggestions wait for an OK. Approve one, press {{button:green|Approve all (12)}}, or leave the approving to the rules:

:::example The org-wide switch
{{chip:gray|Rule matches approve themselves (org-wide · on)}} — every new rule match is approved the moment it is created, as the bank feed arrives or when someone clicks **Apply rules to transactions**. Off, matches wait in Approvals. One switch for the whole company; a dev or leader flips it. Two things always wait for a person even when it is on: an Internal Transfers suggestion on a transaction that already has job splits, and anything created before the switch was turned on.

{{chip:gray|Deposits applied in Accounts Receivable count as Income (org-wide · on)}} — the second switch. A deposit the office matches to a bill in Accounts Receivable is labelled **Income** the moment the payment is recorded, unless a rule or a person already labelled it (a hand-set label is never overwritten). Turning it on also labels every deposit that was applied before today, once, and says how many. Turn it off and new deposits wait for a rule or a person again; labels already set stay.
:::

- **Card Review** and **Category Review** summarize the labels above. The reviews show who spent what, by card and by category. Card Review says *Read-only except Assign to.* A cell opens its charges, where you can set each one's person. A Category Review window can fix a label or a person too. Card Review's **Unassigned** row counts transfers and payouts too until you set its {{chip:gray|Kind}} filter to **Card charges only**.
- **Reconciliation** checks the books **against Mercury's bank statements**. One press checks a **Window** of 3, 6 or 12 months, 6 to start. Each month is checked against its statement, and the open month against the live balance. The check tells you whether every statement transaction is in the books. Reconciliation changes nothing in the books. Each check leaves a receipt of who ran it, when, and what it compared. The last 10 are listed under **Last reconciled**. Reconciliation is *not* the sync. New bank transactions arrive by themselves within about a second. A sync every half hour fills in any that were missed. Neither needs a button.

## What is not on Banking

Money that leaves by **ACH, wire or check** is labeled on **Moneyfill → Bank transfers needing attribution**, not here. Moneyfill opens for a dev or a controller. Examples are rent, insurance, contract labor and the card bill. An ACH is a direct bank-to-bank transfer. See *label bank transfers and wires*. Bank **deposits** are matched to the bills they pay in **Accounts Receivable**, not here. See *match bank deposits to the bills they pay*.

## Where the sorting shows up

Sorted charges are job costs on the job window's **Costs** tab and in the weekly money report. Labels feed the overhead numbers and Banking → **Visuals**. Overhead is the cost not tied to any one job. Quickfill's **Banking sorting** station carries a {{chip:yellow|Close week: $1,206 open}} chip. The chip stays while the previous week still has unsorted charges or unlabeled transfers. The chip reads *Close week: clear* once both are empty. Anyone but a dev or a controller sees *Feeds the weekly close* there instead. See *close the money week*.

## Who can open Banking

Banking is controller-and-above work. {{chip:blue|dev}}, {{chip:blue|Leader}} and {{chip:blue|controller}} open it. Assistants do not see the Banking link or the "bank-label suggestions have waited" card. Assistants sort their own purchases in **Job Parts Tally**. Assistants match bank deposits to bills in **Accounts Receivable**, from the Pipeline's section tools. An assistant never sees the bank feed itself. If a bank-label backlog needs clearing, it is the controller's queue.
