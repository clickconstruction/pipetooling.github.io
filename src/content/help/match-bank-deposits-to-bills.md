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

## Clear the obvious ones in one pass

When deposits each match exactly one open bill to the cent, a green bar appears above the deposit list:

:::example the sweep bar
**3 deposits each match exactly one open bill — $5,145.72** {{button:blue|Review & apply…}}
:::

The review panel lists each pair — deposit on the left, the bill it pays on the right. Everything starts ticked; un-tick anything you're not sure about, then {{button:blue|Apply 3 deposits}} records them all. Two safety rules:

- **Ambiguous amounts are skipped, never guessed** — if two deposits and three bills all say $250.00, the panel tells you and leaves them for you to pick by hand (the customer chips make that quick).
- **Bills sent through Stripe are never swept** — those need the paid-outside-Stripe confirmation, one at a time.

## Finding a bill by hand

The bill picker searches by amount, job number, job name, address — and now the **customer or GC name**, even when the job name doesn't mention them. Typing "weiss" finds Weiss Services' bills no matter what the jobs are called.

## When a check covers several bills

If a set of the matched customer's bills adds up to the deposit exactly, the panel offers it as one chip:

:::example a $4,091.50 check, no single bill matches
{{chip:green|2 bills = $4,091.50 — $2,711.50 · 915 + $1,380.00 · 880 — fills 2 allocation lines}}
:::

Tapping it fills one allocation line per bill for you to review, then {{button:blue|Apply}} as usual. The chip only appears when exactly one combination works — if several could, nothing is suggested and you pick by hand.

You can always split a deposit yourself: {{button:outline|Add Additional Allocation}} adds lines, and the matched customer's chips make it easy to pick their bills one at a time until the remaining hits zero.

## If the payment was already recorded by hand

When you point a deposit at a bill whose job already has a same-amount payment recorded (say, someone marked it paid in Edit Job), the modal warns you — that money may already be counted:

:::example the guard
**This payment may already be recorded.** A 2,918.22 payment dated Aug 26 is on this job with no bank deposit linked. Linking it avoids counting the money twice.
{{button:blue|Link that payment instead}} {{button:outline|It's a different payment}}
:::

**Link that payment instead** switches the line to **Payment received** with that payment picked and the amount locked — the deposit links to the existing record and no duplicate is created. If it really is a separate payment, **It's a different payment** keeps your pick. You can always switch a line to **Payment received** yourself, too.
