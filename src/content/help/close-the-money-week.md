---
title: close the money week
category: Billing & Money
roles: dev, controller
keywords: moneyfill, weekly close, close week, money week, queues, bank transfers, card charges, deposits, supply invoices, pending approval, time without job, no job total, week picker, weekly money movement, close week chip, controller
order: 74
---
Every Monday the previous week gets closed. Moneyfill is the page for that close.

A closed week means every dollar that moved is on a job or a label. Every hour is approved and assigned. Only then does the week's profit report mean anything. **Moneyfill** is the money-bill icon next to the Quickfill heart in the header. It is for **devs and controllers**. Until someone holds the controller role, this is the owner's Monday job.

## The week

Moneyfill opens on the **close week**, the previous complete **Monday–Sunday**. Its header says so:

:::example The close-week header
**Close out: Week of Aug 24 – 30** &nbsp; {{button:outline|‹}} {{button:outline|›}}

**6 of 8 queues at zero** &nbsp; {{chip:yellow|Bank transfers 2 · $11,980}} {{chip:yellow|Card charges 3 · $1,206}} {{chip:green|Deposits 0}} {{chip:green|Time w/o job 0}} …
:::

- ‹ › step the week. Step into the week that is still going and the header adds {{chip:yellow|still running}}. Its close cannot be final until Sunday is over.
- Every chip counts **that week only**. The bar under the heading shows how many queues are at zero.
- The page keeps the week in its address, `/moneyfill?week=<monday>`. So a link from the report or from Quickfill lands on the right week.

Work the queues top to bottom. Each row's button opens the place where the fix is made. Moneyfill itself never edits anything.

## The queues

- **Bank transfers needing attribution** are money-out with no label yet. Attribution is that label. The rows are ACH, wire and check payments. ACH is a bank-to-bank transfer. Label each row **→ Office**, **Payroll**, **Card bill**, **Not an expense** or **Split across jobs…**. The guide *label bank transfers and wires* has the details. This is the one section whose **list is wider than the week**. It shows everything still unlabeled from the **last 90 days**, and says so in its heading. The chip above counts only the week's transfers. A line under the heading reconciles the two numbers. Older transfers belong to earlier weeks' closes. **Show older** reaches the rest. This queue needs the banking-attribution grant. If the section says to ask a dev, that is why.
- **Card charges not split to jobs** are debit-card purchases posted in the week with no job splits. {{button:blue|Sort in Banking → User Sort}} opens Banking with the counterparty already searched. The counterparty is the store or vendor that was paid. Press **Link…** on the row to split it.
- **Deposits not applied to jobs** are bank deposits still carrying balance. {{button:blue|Apply}} opens **Bank payments**, the Accounts Receivable desk. There you match the deposit to the bill it pays.
- **Supply invoices not fully allocated** are supply-house invoices whose dollars are not all on jobs. {{button:blue|Allocate to jobs…}} opens Materials → Supply houses.
- **Approved time with no job** is approved field hours that landed on no job or bid. Open People → Hours to assign the day.
- **Sessions pending approval** are closed clock sessions nobody has approved yet. This one queue reviews the **Sunday–Saturday pay week** that ends inside the close week. That is the same week Draft Payroll opens to, so payroll and the close agree. Every other queue keeps Monday–Sunday. Approve here or in People → Hours. Both are the same approval.
- **Worked jobs with no % report** and **Active jobs with no job total** are the last two queues. The profit report cannot score without them. The first is a job that was worked but has no % done for the week. The second is a job with no total at all. {{button:outline-blue|Job Detail}} and {{button:red|Edit job}} open them.

:::example A queue at zero
**Deposits not applied to jobs** &nbsp; {{chip:green|✓ All clear for the week of Aug 24 – 30}}
:::

## Then read the report

{{button:blue|See the week's report →}} beside the heading opens **Weekly money movement** pinned to the week you were closing. The header reads *Week of Aug 24 – 30 · close week*. The report is only as true as the queues are empty. It uses the same counts and the same week. Its footer links back here on the same week. The report itself is its own guide: *see which jobs made or lost money this week*.

## A daily mark is not a closed week

Quickfill's stations have a **Mark … up to date!** button. Pressing it means someone looked today, nothing more. Four stations feed the close: **Banking sorting**, **People Hours**, **Unassigned field time** and **Supply Houses**. Each carries a second, read-only chip beside the mark. The chip says what the close still owes for the previous complete week:

:::example Green mark, open week
{{chip:green|Supply Houses — Marked 8:41 AM by Dana}} &nbsp; {{chip:yellow|Close week: $239 open}}
:::

Tap the chip and Moneyfill opens on that week. Only devs and controllers can tap it. {{chip:green|Close week: clear}} means every queue that station feeds is at zero. Everyone else sees a plain **Feeds the weekly close** label. The assistant's mark keeps its meaning, and nobody is sent to a page that would turn them away.

## Fewer approvals to clear

Card charges and transfers pick up an accounting label from **rules** in Banking → Accounting. The org-wide switch reads {{chip:gray|Rule matches approve themselves (org-wide · on)}}. When it is on, every rule match is approved the moment it is created. That happens as the bank feed arrives, whether or not anyone has Banking open. So the close-week label backlog stops growing. A dev or leader flips it. When it is off, matches wait in **Approvals** for a person. The **Needs you** card counts any that have waited three days or more.
