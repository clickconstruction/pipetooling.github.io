---
title: mark payroll transactions in the tally
category: Office
roles: dev
keywords: payroll, tally, mercury, transactions, rules, auto-mark
order: 60
---
Payroll runs show up in the Job Parts Tally like any other bank transaction, but they should never be split to jobs. Marking one as **payroll** resolves it without any job allocation, so job spend isn't double-counted.

## Marking a transaction

On a transaction with no jobs assigned, press {{button:outline|Mark payroll}}. A confirmation appears with the transaction's details:

:::example The confirmation
**Gusto** &nbsp;·&nbsp; -$4,210.55 · Jul 3 · Friday

This resolves the transaction without allocating it to any job.

{{button:blue|Create rule…}} &nbsp;&nbsp; {{button:red|Cancel}} &nbsp; {{button:purple|Mark payroll}}
:::

Confirming marks the row {{chip:blue|Payroll ✓}} and it counts as linked everywhere — it drops out of the unlinked queue, the Dashboard unlinked banner, and the stale-tally warnings. Made a mistake? **Unmark** is one click on the row — and an unmark is remembered, so rules will never re-mark that transaction.

## Turning one mark into a rule

If this counterparty is payroll every time, don't mark it by hand each run — press {{button:blue|Create rule…}} in the confirmation instead. The **Payroll auto-mark rules** form opens pre-filled from the transaction (counterparty contains and description contains, with a suggested name), and a live line shows *"Test: matches N of M loaded transactions"* so you can see exactly what the rule would catch before saving. If the description carries run-specific numbers, clear that field so the rule stays broad.

Press {{button:blue|Add rule}} — the rule saves and applies immediately, marking this transaction (and any other loaded matches) as payroll.

## Managing rules

The {{button:outline|Payroll rules}} chip above the transactions list opens the same modal to edit, disable, or delete rules, apply them on demand with {{button:blue|Apply payroll rules now}}, or turn on **Auto-apply on load**.

Safety rails, always: a manual mark or unmark beats any rule, and transactions already split to jobs are never auto-marked.
