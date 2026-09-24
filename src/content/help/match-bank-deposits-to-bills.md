---
title: match bank deposits to the bills they pay
category: Billing & Money
roles: dev, master_technician, assistant, controller, primary
keywords: accounts receivable, bank deposits, mercury, allocate, apply payment, counterparty, check, match, tip, overpaid, paid too much, leftover, close out, bank interest, vendor refund, owner deposit, not a customer, reopen, bounced check, returned check, insufficient funds, stop payment, nsf
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

- Bills whose balance equals the deposit are green and listed first — one tap fills the allocation, then {{button:blue|Apply $250.00}}. A second tap on another bill adds a second line, and bills already on a line leave the list. The footer reads the plan back before you press it — *Applies $250.00 to 992 · Done Right Foundation and books it as Income. The bill is settled.* — and {{button:outline|Apply & next ›}} applies and moves you to the next deposit instead of closing.

:::example Booked as Income on its own
Applying a deposit also gives it the **Income** label in Banking, so the P&L counts it without anyone opening Banking (an org-wide switch a dev or leader turns on under Banking → Accounting). A label a rule or a person already set is never changed: if the deposit was already labelled something else, a small amber line under the header reads *Labelled Taxes and Licenses in Banking, not Income. Apply leaves that alone.* Remove the payment later and the label the rule set goes with it.
:::
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

## If it isn't a customer's payment at all

Some money that lands in the bank was never a customer paying a bill: interest the bank paid, a supply house refunding a return, the owner putting money in. There is no bill for it and no job, so it would sit in the pile forever. On a deposit nobody has matched yet, a strip above the allocation rows asks:

:::example the close-out strip
**Not a customer's payment?**
Bank interest, a vendor refund or an owner deposit has no job to land on. Name the reason and the deposit leaves To match; Banking's label still books the money.
{{chip:gray|Vendor refund}} {{button:outline|Close out $312.48}}
:::

Pick the reason — **Bank interest**, **Vendor refund**, **Owner deposit**, or **Something else** with a note saying what it is — and press the button. When the bank's own memo says *refund* or *interest*, the reason is already picked for you. A confirm step follows, then the deposit leaves To match for everyone with the reason on the record. Nothing is written to any job, and no payment is created.

- **It is not gone.** Under **To match · All** the row wears a {{chip:gray|closed out}} chip, and the header reads *Closed out · Vendor refund · Sep 16, 2026* with a **Reopen** link that puts it back in the pile.
- **It is the opposite of the tip strip.** The close-out only appears while nothing from the deposit is applied to a job. Once a bill is paid from it, the money is a customer's, and any leftover is a tip (see above) — the app refuses to close out a deposit that already paid a bill.
- **Banking is separate.** Closing out says *this is not receivables*; it does not label the deposit. Label it in Banking → Accounting as you would any other bank transaction so the P&L reads right.
- Marked returned? Unmark it first if it did not actually bounce — a returned deposit cannot be closed out.

## If a check bounces after you matched it

A check can be matched to a bill and returned by the bank days later. Mercury syncs the deposit as failed with the bank's reason, and the payment row on the job says so: open the job, ③ Payments received, and the row wears {{chip:red|⚠ Returned by the bank · Insufficient funds}}. Press {{button:outline|Unlink and remove}} on that row and confirm. The payment comes off the job, the bill and the job's balance read unpaid again, and the deposit is marked **returned** in Accounts Receivable in the same step — it never comes back to To match.

This works on a Stripe bill too. A deposit matched here is only a row in the app — Stripe never learned of it, and the bill's pay link kept asking for the full amount — so there is nothing on Stripe's side to undo, and the confirm says so. The two payments Stripe *does* hold keep their own doors: a part payment recorded as a credit note has **Undo part payment** on its row, and a bill marked paid out-of-band in Stripe has **Unwind** on the bill.

:::example the GC's check came back
Take 5 – Seguin: a $13,680 check from the GC was matched to the first draw on Sep 21 and returned for insufficient funds on Sep 23. On the job the row reads *⚠ Returned by the bank · Insufficient funds*; Unlink and remove puts the $15,200 draw back to unpaid, the job's open balance back to $38,625, and the deposit leaves To match as returned. The lien notice then claims the whole balance.
:::

Every removal is kept on the job's payment record — the amount, the bill it was on, who removed it and why — so the trail survives the row.

**You don't have to go looking.** The moment Mercury reports the return, the office gets an email and a push — *Southern Post's check for $13,680 on J878 Take 5 – Seguin came back: Insufficient funds* — with a link straight to that payments row; it goes to the people on the **Payment made** email stream (Settings → Email streams), or to the whole office when that list is empty, and only once per deposit. And the Dashboard's **Needs you** card says so — *A deposit the bank returned is still counted as paid ($13,680)* — naming the job, the amount and the bank's reason, and {{button:outline|Open J878}} lands you on that ③ Payments received row. Until the payment comes off, the job still reads paid everywhere (the Pipeline row, its balance, any lien notice), which is why the card is amber.

:::example a returned check nobody matched yet
A check that bounces before anyone matched it never needs a thing from you. It leaves **To match** on its own, is never swept or closed out, and under **To match · All** wears {{chip:red|returned by the bank · Insufficient funds}} (or *Stop payment*, *Refer to maker* — the bank's own words). Only a check the bank first accepted and then returned counts; one Mercury never took in the first place ("there was an issue with this transaction", usually re-deposited) raises nothing.
:::
