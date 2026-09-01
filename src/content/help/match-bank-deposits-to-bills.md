---
title: match bank deposits to the bills they pay
category: Billing & Money
roles: dev, master_technician, assistant, controller, primary
keywords: accounts receivable, bank deposits, mercury, allocate, apply payment, counterparty, check, match
---
When money lands in the bank, it isn't done — each deposit still has to be applied to the bill it pays so the job shows paid and the money stops being chased. That happens in **Accounts Receivable**: open it from Jobs → Pipeline, from the Dashboard's {{button:blue|Match deposits}} nudge, or at `/accounts-receivable`.

The left side lists bank deposits that still have balance to apply. Pick one, and the right side is where you say which bill it pays.

## The modal reads who paid you

The deposit's bank name, note, and memo are checked against your customers and GCs, and when there's a clear match, their open bills lead the panel:

:::example a $250.00 check from DRF
**From Done Right Foundation — their open bills**
{{chip:green|$250.00 · 992 · Johnson Plumbing Test — matches this deposit}} {{chip:gray|$2,650.00 · 868 · Service Visit}}
:::

- Bills whose balance equals the deposit are green and listed first — one tap fills the allocation, then {{button:blue|Apply}}.
- Initials work: a check deposited as "DRF" finds **Done Right Foundation**. Check services often put the real customer in the deposit memo — that's read too, and the header says so ("Memo mentions…").
- No clear match? You still get the **Matches deposit amount** row (any bill equal to the deposit, whoever it belongs to) and the full searchable picker.

## Finding a bill by hand

The bill picker searches by amount, job number, job name, address — and now the **customer or GC name**, even when the job name doesn't mention them. Typing "weiss" finds Weiss Services' bills no matter what the jobs are called.

## When a check covers several bills

Use {{button:outline|Add Additional Allocation}} to split one deposit across bills — the matched customer's chips make it easy to pick their bills one at a time until the remaining hits zero.

If someone already recorded the payment by hand in Edit Job, switch the line to **Payment received** and link the deposit to that recorded payment instead — that avoids counting the same money twice.
