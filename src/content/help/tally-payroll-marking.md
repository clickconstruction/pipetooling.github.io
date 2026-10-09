---
title: mark payroll transactions in the tally
category: Office
roles: dev, master_technician, controller
keywords: payroll, tally, mercury, transactions, rules, auto-mark, cash app, pay sends, team queue
order: 60
---
Payroll runs show up in the Job Parts Tally like any other bank transaction. But payroll runs should never be split to jobs.

Marking one as **payroll** resolves it without any job allocation, so job spend isn't double-counted. Anyone with payroll access can mark: a dev, a controller, or a pay-approved leader. The auto-mark **rules** below are a dev tool. Marking payroll is the last stop of the pay week. See [run the pay week from Hours to Tally](?g=run-the-pay-week).

## Marking a transaction

On a transaction with no jobs assigned, press {{button:outline|Mark payroll}}. A confirmation appears with the transaction's details:

:::example The confirmation
**Gusto** &nbsp;·&nbsp; -$4,210.55 · Jul 3 · Friday

This resolves the transaction without allocating it to any job.

{{button:blue|Create rule…}} &nbsp;&nbsp; {{button:red|Cancel}} &nbsp; {{button:purple|Mark payroll}}
:::

Confirming marks the row {{chip:blue|Payroll ✓}}, and it counts as linked everywhere. The row drops out of the unlinked queue, the Dashboard unlinked banner, and the stale-tally warnings. Made a mistake? **Unmark** is one click on the row. An unmark is remembered, so rules will never re-mark that transaction.

## Cash App pay sends on the team's cards

Open [Job Parts Tally](/tally?tab=transactions) under {{chip:blue|Team}}. A purple bar sits above the cards when a card has Cash App pay sends. One bar shows for each card. It says how many, how much and who the money went to.

:::example A pay bar
**2 Cash App pay sends on Rob's card · $750.50**

To Isaiah Whites and Paige Doe. Pay goes to payroll, not to a job.

{{button:purple|Mark 2 payroll}}
:::

1. Read the names on the bar. Each one should be someone you paid.
2. Press {{button:purple|Mark 2 payroll}}. The button counts the sends. They leave the list.
3. Marked the wrong ones? Press **Undo** on the message. The sends go back to sort.

The bar marks the sends. It does not change a rule. Only people who can mark payroll see the bar. Everyone else sorts the sends one at a time.

## Turning one mark into a rule

A counterparty is who the money went to or came from. This counterparty may be payroll every time. Then don't mark it by hand each run. A dev presses {{button:blue|Create rule…}} in the confirmation instead. For everyone else the confirmation has only {{button:red|Cancel}} and {{button:purple|Mark payroll}}. The **Payroll auto-mark rules** form opens filled in from the transaction. The form fills counterparty contains and description contains, with a suggested name. A live line shows *"Test: matches N of M loaded transactions"*. So you can see exactly what the rule would catch before saving. If the description carries run-specific numbers, clear that field so the rule stays broad.

Press {{button:blue|Add rule}}. The rule saves and applies immediately. The rule marks this transaction as payroll, and any other loaded matches too.

## Managing rules

The {{button:outline|Payroll rules}} chip above the transactions list opens the same window. There you can edit, disable, or delete rules. You can apply them on demand with {{button:blue|Apply payroll rules now}}. Or you can turn on **Auto-apply on load**.

Safety rails, always: a manual mark or unmark beats any rule. Transactions already split to jobs are never auto-marked.
