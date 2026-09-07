---
title: close the money week
category: Billing & Money
roles: dev, controller
keywords: moneyfill, weekly close, close week, money week, queues, bank transfers, card charges, deposits, supply invoices, pending approval, time without job, no job total, week picker, weekly money movement, close week chip, controller
order: 74
---
Every Monday the previous week gets closed: every dollar that moved is on a job or a label, every hour is approved and assigned, and only then does the week's profit report mean anything. **Moneyfill** is the page for that close — the money-bill icon next to the Quickfill heart in the header, for **devs and controllers**. Until someone holds the controller role, this is the owner's Monday job.

## The week

Moneyfill opens on the **close week** — the previous complete **Monday–Sunday** — and its header says so:

:::example The close-week header
**Close out: Week of Aug 24 – 30** &nbsp; {{button:outline|‹}} {{button:outline|›}}

**6 of 8 queues at zero** &nbsp; {{chip:yellow|Bank transfers 2 · $11,980}} {{chip:yellow|Card charges 3 · $1,206}} {{chip:green|Deposits 0}} {{chip:green|Time w/o job 0}} …
:::

- ‹ › step the week. Step into the week that is still going and the header adds {{chip:yellow|still running}} — its close can't be final until Sunday is over.
- Every chip counts **that week only**; the bar under the heading shows how many queues are at zero.
- The page keeps the week in its address (`/moneyfill?week=<monday>`), so a link from the report or from Quickfill lands on the right week.

Work the queues top to bottom. Each row's button opens the place where the fix is made — Moneyfill itself never edits anything.

## The queues

- **Bank transfers needing attribution** — ACH, wire and check money-out with no label yet. Label each row **→ Office**, **Payroll**, **Card bill**, **Not an expense** or **Split across jobs…** (see *label bank transfers and wires*). This is the one section whose **list is wider than the week**: it shows everything still unlabeled from the **last 90 days**, and says so in its heading — the chip above counts only the week's transfers, and a line under the heading reconciles the two numbers. Older transfers belong to earlier weeks' closes; **Show older** reaches the rest. This queue needs the banking-attribution grant — if the section says to ask a dev, that's why.
- **Card charges not split to jobs** — debit-card purchases posted in the week with no job splits. {{button:blue|Sort in Banking → User Sort}} opens Banking with the counterparty already searched; press **Link…** on the row to split it.
- **Deposits not applied to jobs** — bank deposits still carrying balance. {{button:blue|Apply}} opens **Bank payments** (the Accounts Receivable desk) to match the deposit to the bill it pays.
- **Supply invoices not fully allocated** — supply-house invoices whose dollars aren't all on jobs. {{button:blue|Allocate to jobs…}} opens Materials → Supply houses.
- **Approved time with no job** — approved field hours that landed on no job or bid; open People → Hours to assign the day.
- **Sessions pending approval** — closed clock sessions nobody has approved yet. This one queue reviews the **Sunday–Saturday pay week** that ends inside the close week — the same week Draft Payroll opens to — so payroll and the close agree; every other queue keeps Monday–Sunday. Approve here or in People → Hours; both are the same approval.
- **Worked jobs with no % report** and **Active jobs with no job total** — the two things the profit report can't score without: a job that was worked but has no % done for the week, and a job with no total at all. {{button:outline-blue|Job Detail}} and {{button:red|Edit job}} open them.

:::example A queue at zero
**Deposits not applied to jobs** &nbsp; {{chip:green|✓ All clear for the week of Aug 24 – 30}}
:::

## Then read the report

{{button:blue|See the week's report →}} beside the heading opens **Weekly money movement** pinned to the week you were closing (the header reads *Week of Aug 24 – 30 · close week*). The report is only as true as the queues are empty — same counts, same week — and its footer links back here on the same week. The report itself is its own guide: *see which jobs made or lost money this week*.

## A daily mark is not a closed week

Quickfill's stations have a **Mark … up to date!** button; pressing it means *someone looked today*, nothing more. The four stations that feed the close — **Banking sorting**, **People Hours**, **Unassigned field time**, **Supply Houses** — carry a second, read-only chip beside the mark that says what the close still owes for the previous complete week:

:::example Green mark, open week
{{chip:green|Supply Houses — Marked 8:41 AM by Dana}} &nbsp; {{chip:yellow|Close week: $239 open}}
:::

Tap the chip (devs and controllers) and Moneyfill opens on that week. {{chip:green|Close week: clear}} means every queue that station feeds is at zero. Everyone else sees a plain **Feeds the weekly close** label — the assistant's mark keeps its meaning, and nobody is sent to a page that would turn them away.

## Fewer approvals to clear

Card charges and transfers pick up an accounting label from **rules** (Banking → Accounting). When the org-wide switch {{chip:gray|Rule matches approve themselves (org-wide · on)}} is on, every rule match is approved the moment it is created — as the bank feed arrives, whether or not anyone has Banking open — so the close-week label backlog stops growing. A dev or leader flips it; when it is off, matches wait in **Approvals** for a person, and the **Needs you** card counts any that have waited three days or more.
