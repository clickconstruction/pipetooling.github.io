---
title: match bank deposits to the bills they pay
category: Billing & Money
roles: dev, master_technician, assistant, controller, primary
keywords: accounts receivable, bank deposits, mercury, allocate, apply payment, counterparty, check, match, tip, overpaid, paid too much, leftover
---
When money lands in the bank, it isn't done — each deposit still has to be applied to the bill it pays so the job shows paid and the money stops being chased. That happens in **Accounts Receivable**: open it from Jobs → Pipeline, from the Dashboard's {{button:blue|Match deposits}} nudge, or at `/accounts-receivable`.

The header counts the pile — *4 deposits to match · $9,115.42 unapplied* — and the left side lists those deposits. Each row already says what the modal knows about it: {{chip:green|1 exact match}} (one open bill equals it to the cent), {{chip:yellow|probably recorded}} (a payment of that amount is on a job with no deposit linked — see *If the payment was already recorded by hand*), {{chip:yellow|same amount, several bills}}, {{chip:blue|payer known}}, or no chip when it is a pick-by-hand. **To match · All** above the list switches between the pile and everything, including deposits fully applied or marked returned. Pick a row, and the right side is where you say which bill it pays.

The rare controls live behind the {{button:outline|⋯}} button in the header: **Mark returned deposits** puts a Returned tick on every row for bounced checks, and (dev only) the **Mercury filter**.

## The modal reads who paid you

The deposit's bank name, note, and memo are checked against your customers and GCs, and when there's a clear match, their open bills lead the panel as a list under **Who paid you** — amount, job, where, and a Stripe tag when the bill went out through Stripe:

:::example a $250.00 check from DRF
**From Done Right Foundation — their open bills**
{{chip:green|$250.00 · 992 · Johnson Plumbing Test — matches this deposit}} {{chip:gray|$2,650.00 · 868 · Service Visit}}
:::

- Bills whose balance equals the deposit are green and listed first — one tap fills the allocation, then {{button:blue|Apply $250.00}}. A second tap on another bill adds a second line, and bills already on a line leave the list. The footer reads the plan back before you press it — *Applies $250.00 to 992 · Done Right Foundation. The bill is settled.* — and {{button:outline|Apply & next ›}} applies and moves you to the next deposit instead of closing.
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

Each bill in the list is two lines: the amount, then the job number and name, then who pays · the address · which line (*Invoice #2*, *Billed line*), with a {{chip:purple|Stripe}} tag when the bill went out through Stripe. The list opens in the deposit's order — the matched payer's bills first, the one equal to the deposit on top in green with **✓ matches this deposit**, then other bills equal to the deposit, then the rest — and the footer under it counts the open bills and what they add up to. After a pick, the control reads the bill back: *$250.00 · 1015 · Montolongo Post Test*.

:::example Picking from the list
{{chip:green|$1,855.70 · 1042 Giesber Master Bath · ✓ matches this deposit}} sits first because the deposit came from Elaine Giesber and equals her open bill; her other jobs follow, then any other bill equal to $1,855.70, then everything else. Type "giesber", "1042", "cibolo" or "1855" to narrow it.
:::

## When a check covers several bills

If a set of the matched customer's bills adds up to the deposit exactly, the panel offers it as one chip:

:::example a $4,091.50 check, no single bill matches
{{chip:green|2 bills = $4,091.50 — $2,711.50 · 915 + $1,380.00 · 880 — fills 2 allocation lines}}
:::

Tapping it fills one allocation line per bill for you to review, then {{button:blue|Apply}} as usual. The chip only appears when exactly one combination works — if several could, nothing is suggested and you pick by hand.

You can always split a deposit yourself: **+ Split across another bill** under the allocation rows adds a line, and the matched customer's chips make it easy to pick their bills one at a time until the meter under the deposit's name reads *Fully allocated ✓*. Each row is one ledger line — kind · bill or payment · amount — and **· Add a note** beside the split link opens the internal note that lands on the job's Payments received.

## If they paid more than the bills

Sometimes a customer rounds up, or adds something for the crew. Once the bills on a deposit are settled and money is still left on it, a strip appears above the allocation rows:

:::example the tip strip
**$50.00 more than the bills.**
They paid over. Record it as a tip on 960 · Elaine Giesber-Installations Pcv & Lavatory Sink.
{{button:blue|Add a $50.00 Tip line}}
:::

There is nothing to type — the tip is the difference. Pressing it asks you once to confirm, then adds a line called **Tip** to that job and records the leftover as a payment on the deposit, so the deposit reads *Fully allocated ✓* and leaves the list. The tip is revenue on the job, the same way tips that came across from HouseCall Pro are recorded, so it shows on Job Summary and in the crew's numbers. It attaches to the job rather than to any single bill, so no invoice reads as overpaid.

When a deposit paid bills on more than one job, a short list of those jobs appears first so you can say which one earned it.

The strip never shows on a deposit nobody has matched yet — money on an untouched deposit is unmatched, not a tip. It also never shows on one marked returned.

:::example taking one back
Removing a tip takes two steps in Edit Job: delete the **Tip** line, and remove the payment from **Payments received**. That is why the button asks before it writes.
:::

## If the payment was already recorded by hand

When you point a deposit at a bill whose job already has a same-amount payment recorded (say, someone marked it paid in Edit Job), the modal warns you — that money may already be counted:

:::example the guard
**This payment may already be recorded.** A 2,918.22 payment dated Aug 26 is on this job with no bank deposit linked. Linking it avoids counting the money twice.
{{button:blue|Link that payment instead}} {{button:outline|It's a different payment}}
:::

**Link that payment instead** switches the line to **Payment received** with that payment picked and the amount locked — the deposit links to the existing record and no duplicate is created. If it really is a separate payment, **It's a different payment** keeps your pick. You can always switch a line to **Payment received** yourself, too.

## If the job doesn't come up in the billed-line search

A job that was already marked paid has **no balance left to bill**, so its line doesn't appear under **Billed line** at all — that's the tell that the money is recorded and just needs the bank deposit linked to it. When your search finds nothing there but a recorded payment matches, the list offers **Link it instead** — one press switches the line to **Payment received**, and if exactly one payment matches your search it's picked for you.

:::example marked paid before the deposit arrived
The checks were deposited, you marked J989 paid, and the bank deposit shows up a day later. Searching "989" under Billed line finds nothing — press **Link it instead** and the deposit ties to the $250 check payment already on the job.
:::
