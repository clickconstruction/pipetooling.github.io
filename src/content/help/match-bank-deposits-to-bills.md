---
title: match bank deposits to the bills they pay
category: Billing & Money
roles: dev, master_technician, assistant, controller, primary
keywords: accounts receivable, bank deposits, mercury, allocate, apply payment, counterparty, check, match, tip, overpaid, paid too much, leftover, close out, bank interest, vendor refund, owner deposit, not a customer, banking label, rule match, reopen, bounced check, returned check, insufficient funds, stop payment, nsf, came back, new check, rejected check, never reached the bank, never deposited, take it off, stop payment case, chargeback, card dispute, dispute lost, put the bill back, failed bank payment, ach
---
Money that lands in the bank is not done yet. Each deposit still has to be applied to the bill it pays. Then the job shows paid and nobody chases the money. You do that in **Accounts Receivable**. Open it from Jobs → Pipeline, from the Dashboard's {{button:blue|Match deposits}} nudge, or at `/accounts-receivable`.

## The deposit list

The header counts the pile. It reads *4 deposits to match · $9,115.42 unapplied*. The left side lists those deposits. Each row already says what the app knows about it. {{chip:green|1 exact match}} means one open bill equals it to the cent. {{chip:yellow|probably recorded}} means a payment of that amount is already on a job with no deposit linked. See *If the payment was already recorded by hand*. {{chip:yellow|same amount, several bills}} and {{chip:blue|payer known}} say what they say. No chip means you pick by hand.

*To match · All* above the list switches between the pile and everything. All includes deposits fully applied or marked returned. The search box looks in both. Type a cheque on To match that was already applied. It shows under *Nothing to match · found in All*, not as no match. Under each row, one line is its trail. It reads *→ #650 ATI Schertz today 4:02 PM by Taunya · was #878 Take 5- Seguin 9/29*, the old job struck through. So a cheque that moved, was taken off, or bounced says so where it sits. A payment recorded by hand and linked to its deposit later says both steps, and who did each. Under All, the deposits touched in the last 30 days come first. The newest action is on top, under a heading for its day. Older deposits follow by bank date. Pick a row. The right side is where you say which bill it pays.

The rare controls live behind the {{button:outline|⋯}} button in the header. **Mark returned deposits** puts a Returned tick on every row, for bounced checks. Devs also see the **Mercury filter** there.

## The modal reads who paid you

The deposit's bank name, note and memo are checked against your customers and GCs. When there is a clear match, their open bills lead the panel under **Who paid you**. Each shows the amount, the job, where, and a Stripe tag when the bill went out through Stripe.

:::example a $250.00 check from DRF
**From Done Right Foundation — their open bills**
{{chip:green|$250.00 · 992 · Johnson Plumbing Test — matches this deposit}} {{chip:gray|$2,650.00 · 868 · Service Visit}}
:::

- Bills whose balance equals the deposit are green and listed first. One tap fills the allocation. Then press {{button:blue|Apply $250.00}}. A second tap on another bill adds a second line. Bills already on a line leave the list. The footer reads the plan back before you press it. It reads *Applies $250.00 to 992 · Done Right Foundation and books it as Income. The bill is settled.* {{button:outline|Apply & next ›}} applies and moves you to the next deposit instead of closing.

:::example Booked as Income on its own
Applying a deposit also gives it the **Income** label in Banking, so the P&L counts it without anyone opening Banking (an org-wide switch a dev or leader turns on under Banking → Accounting). A label a rule or a person already set is never changed: if the deposit was already labelled something else, a small amber line under the header reads *Labelled Taxes and Licenses in Banking, not Income. Apply leaves that alone.* Remove the payment later and the label the rule set goes with it.
:::
- **A bill paid, but booked as an expense?** A rule can label money coming in the same as money going out. Then a deposit that paid a bill reads *Banking books it as Taxes and Licenses.* Press {{button:dark|Book it as Income}} to put it right. The line names the rule that labelled it. In Banking, that rule can be limited to money going out. If the payment comes off later, the old label goes back.
- Initials work. A check deposited as "DRF" finds **Done Right Foundation**. Check services often put the real customer in the deposit memo. That is read too, and the header says so. It reads *Memo mentions…*.
- No clear match? You still get the **Matches deposit amount** row. That lists any bill equal to the deposit, whoever it belongs to. The full searchable picker is there too.

**Give it the whole screen.** The button between **⋯** and **Close** takes the window full screen. The deposits and the match pane then split the whole width. It opens the way you left it. Press it again for the window.

## Clear the obvious ones in one pass

When deposits each match exactly one open bill to the cent, a green bar appears above the deposit list.

:::example the sweep bar
**3 deposits each match exactly one open bill — $5,145.72** {{button:blue|Review & apply…}}
:::

The review panel lists each pair. The deposit is on the left and the bill it pays on the right. Everything starts ticked. Un-tick anything you are not sure about. Then press {{button:blue|Apply 3 deposits}} to record them all. Two safety rules:

- **Ambiguous amounts are skipped, never guessed.** If two deposits and three bills all say $250.00, the panel tells you. It leaves them for you to pick by hand. The customer chips make that quick.
- **Bills sent through Stripe are never swept.** Those need the paid-outside-Stripe confirmation, one at a time.

## Finding a bill by hand

The bill picker searches by amount, job number, job name and address. It also searches the customer or GC name, even when the job name does not mention them. Typing "weiss" finds Weiss Services' bills no matter what the jobs are called.

Each bill in the list is two lines. First the amount. Then the job number and name, who pays, the address and which line, such as *Invoice #2* or *Billed line*. A {{chip:purple|Stripe}} tag shows when the bill went out through Stripe. The list opens in the deposit's order. The matched payer's bills come first. The one equal to the deposit sits on top in green with **✓ matches this deposit**. Then other bills equal to the deposit, then the rest. The footer under it counts the open bills and what they add up to. After a pick, the control reads the bill back. It reads *$250.00 · 1015 · Montolongo Post Test*.

:::example Picking from the list
{{chip:green|$1,855.70 · 1042 Giesber Master Bath · ✓ matches this deposit}} sits first because the deposit came from Elaine Giesber and equals her open bill; her other jobs follow, then any other bill equal to $1,855.70, then everything else. Type "giesber", "1042", "cibolo" or "1855" to narrow it.
:::

## When a check covers several bills

When some of the matched customer's bills add up to the deposit exactly, the panel offers them as one chip.

:::example a $4,091.50 check, no single bill matches
{{chip:green|2 bills = $4,091.50 — $2,711.50 · 915 + $1,380.00 · 880 — fills 2 allocation lines}}
:::

Tapping it fills one allocation line per bill for you to review. Then press {{button:blue|Apply}} as usual. The chip only appears when exactly one combination works. If several could, nothing is suggested and you pick by hand.

You can always split a deposit yourself. **+ Split across another bill** under the allocation rows adds a line. The matched customer's chips make it easy to pick their bills one at a time. Stop when the meter under the deposit's name reads *Fully allocated ✓*. Each row is one ledger line: kind, bill or payment, amount. *· Add a note* beside the split link opens the internal note. That note lands on the job's Payments received.

## If they paid more than the bills

Sometimes a customer rounds up, or adds something for the crew. Once the bills on a deposit are settled and money is still left, a strip appears above the allocation rows.

:::example the tip strip
**$50.00 more than the bills.**
They paid over. Record it as a tip on 960 · Elaine Giesber-Installations Pcv & Lavatory Sink.
{{button:blue|Add a $50.00 Tip line}}
:::

There is nothing to type. The tip is the difference. Pressing it asks you once to confirm. Then it adds a line called **Tip** to that job. It also records the leftover as a payment on the deposit. The deposit then reads *Fully allocated ✓* and leaves the list. The tip is revenue on the job, the same way tips from HouseCall Pro are recorded. So it shows on Job Summary and in the crew's numbers. It attaches to the job rather than to any single bill. So no invoice reads as overpaid.

When a deposit paid bills on more than one job, a short list of those jobs appears first. You say which one earned it.

The strip never shows on a deposit nobody has matched yet. Money on an untouched deposit is unmatched, not a tip. It also never shows on one marked returned.

:::example taking one back
Removing a tip takes two steps in Edit Job: delete the **Tip** line, and remove the payment from **Payments received**. That is why the button asks before it writes.
:::

## If the payment was already recorded by hand

Say you point a deposit at a bill whose job already has a same-amount payment recorded. Someone may have marked it paid in Edit Job. The modal warns you, because that money may already be counted.

:::example the guard
**This payment may already be recorded.** A 2,918.22 payment dated Aug 26 is on this job with no bank deposit linked. Linking it avoids counting the money twice.
{{button:blue|Link that payment instead}} {{button:outline|It's a different payment}}
:::

**Link that payment instead** switches the line to **Payment received** with that payment picked and the amount locked. The deposit links to the existing record and no duplicate is created. If it really is a separate payment, **It's a different payment** keeps your pick. You can always switch a line to **Payment received** yourself, too.

## If the job doesn't come up in the billed-line search

A job that was already marked paid has **no balance left to bill**. So its line does not appear under **Billed line** at all. That is the tell: the money is recorded and just needs the bank deposit linked to it. When your search finds nothing there but a recorded payment matches, the list offers **Link it instead**. One press switches the line to **Payment received**. If exactly one payment matches your search, it is picked for you.

:::example marked paid before the deposit arrived
The checks were deposited, you marked J989 paid, and the bank deposit shows up a day later. Searching "989" under Billed line finds nothing — press **Link it instead** and the deposit ties to the $250 check payment already on the job.
:::

## If it isn't a customer's payment at all

Some money that lands in the bank was never a customer paying a bill. Interest the bank paid. A vendor refunding a return. The owner putting money in. There is no bill for it and no job. On a deposit nobody has matched yet, a strip above the allocation rows asks what it is.

:::example the close-out strip
**Not a customer's payment?**
{{button:outline|Vendor refund}} {{button:outline|Bank interest}} {{button:outline|Owner deposit}} {{button:outline|Something else}}
Banking books it as **Insurance**. Your rule TEXAS MUTUAL labelled it on Aug 16.
{{button:dark|Close out $119.56}}
:::

Press the reason. It is **Vendor refund**, **Bank interest**, **Owner deposit**, or **Something else** with a note saying what it is. When the bank's memo says *refund* or *interest*, the reason is already pressed. When the same payer's last deposit was closed out, its reason is pressed instead. A line under the buttons says so.

### What Banking does with it

Under the reasons, a box says how Banking books the money. It reads one of three ways.

- **A rule or a person labelled it.** It reads *Banking books it as Insurance* and says who did it. Close out keeps that label.
- **A rule matched and nobody approved it yet.** It reads *Your rule TEXAS MUTUAL says Insurance*. Close out approves it, the same as **Approve** in Banking.
- **Nothing labels it.** It reads **Book it as** with a list. For a vendor refund the list starts on the label the payer's own payments carry. Bank interest starts on **Income**. An owner deposit starts on **Owners Equity**. Pick **Leave it for Banking** to close it out with no label.

Press **Change** to pick another label. A vendor refund goes under the expense it pays back. So a refund from your insurer stays under **Insurance**. A label of the wrong kind turns the box amber. When the label is **Cost of Goods Sold** or **Job Materials & Parts**, the box points to **Supply houses**. Record the credit there too, so the job's cost drops.

Then press the button. A confirm step follows, and it says what happens to the books. The deposit leaves To match for everyone, with the reason on the record. Nothing is written to any job, and no payment is created.

- **It is not gone.** Under *To match · All* the row wears a {{chip:gray|closed out}} chip. The header reads *Closed out · Vendor refund · Insurance · Oct 1, 2026* with a **Reopen** link that puts it back in the pile. Reopen takes off a label Close out put on and puts back the one it replaced. A rule's label and a later change stay.
- **The row tells you first.** A deposit in To match that Banking books as an expense says so under its name. It may read *Banking books it as Insurance*. That is often the sign it is not a customer's payment.
- **It is the opposite of the tip strip.** The close-out only appears while nothing from the deposit is applied to a job. Once a bill is paid from it, the money is a customer's. Any leftover is a tip, see above. The app refuses to close out a deposit that already paid a bill.
- Marked returned? Unmark it first if it did not actually bounce. A returned deposit cannot be closed out.

## When a check comes back

A check can come back days after it posted. Under All, a check applied in the past week reads *clears about Oct 8* until then. The bank says why when one comes back. It may read *Insufficient funds*, *Stop payment* or *Refer to maker*. The app opens a case for it the moment Mercury says so. This happens whether the check is on a job or not.

### Came back, on top of To match

Every open case sits under **Came back** at the top of To match. The header counts them. It reads *2 came back · nothing to match*. Each row says where the check is now. It may read *off #878 since 9/24 · no new check in 8 days*. Select a row to open its case.

The case tells the story first. It lists when the check posted, who applied it and when the bank sent it back. Then it says what that costs. It may read *#878 owes the $13,680 again.* Then it gives one next step.

:::example the case of Southern Post's check
**Southern Post · $13,680** {{chip:red|came back · Insufficient funds}}
Sep 21 Taunya applied it to #878 Take 5- Seguin. Sep 23 The bank sent it back.
**Next:** Get a new check from Southern Post. It has been 8 days. {{button:blue|They said…}}
:::

- **Still on a job.** The next step is {{button:red|Take it off the job}}. It reads back what changes on each job first. It may read *$11,181.78 comes off bill 2.* One press takes it off every job it paid. Each job's history keeps the removal and who did it. A bill Stripe holds as paid must be undone there first. The read-back says so.
- **Off its jobs.** The next step is to get a new check. Press {{button:blue|They said…}} to record the date the customer named. The case then waits for that date. A stopped check asks you to find out why it was stopped.
- **The new check arrives.** A deposit may land from the same payer for the same amount. Then the case says *This looks like the new check.* Press {{button:blue|Use it as the new check}}. The bills the old check paid fill in. Press Apply, and the case closes. If you move the money to a different job first, the case stays open.
- **It ends another way.** Open **More**. Pick **Settled another way** or **Not coming** and add a note. The case closes with your name on it.
- **The returned check fee.** Texas lets you charge up to $30 for a check that came back. The case offers {{button:outline|Add the $30 fee to bill 1}} beside the line *$30 — the most Texas allows, Bus. & Com. Code § 3.506*. Point at the line to read the law. One press adds the fee to the bill the check paid, as its own line. The job's total grows by the fee too. Edit Job counts it in the **Job Total** as a rider, so later edits keep it. The case keeps who added it and when, and it takes the fee once. A Stripe bill cannot take a line, so the case says so instead.

A check that came back cannot pay a bill. Its pane has no bills to pick and Apply stays off.

### A check marked returned by hand

**Mark returned deposits** behind {{button:outline|⋯}} still puts a Returned tick on each row. Ticking one the bank never sent back asks first. It reads *Did the bank send DRF's $250 check back?* Say yes and it opens a case. Say no when it is not a customer's payment. Then close it out with a reason instead. A case marked by hand has **It did not bounce** under More. That puts it back in To match.

### A check that never reached the bank

Mercury can refuse a check before it posts. It reads *There was an issue with this transaction*. Most of these are simply deposited again. Sometimes one is not, and a payment for the same amount was recorded by hand. After five days the app opens a case for it. The case reads *never reached the bank* and names the job that still reads paid. Deposit the check again and the case closes on its own. If it was paid another way, say so in the case. If it will not be paid, take the payment off the job from the case.

### A check that was never deposited

A check typed in by hand reads paid on its job the moment you save it. Sometimes the check never goes in. Ten days after it was typed in with no deposit linked, the app opens a case. The case reads *never deposited* and names the job that still reads paid. Find the check and deposit it. If it went in with other checks, link the payment to that deposit. Either way the case closes on its own. If it was paid another way, say so in the case. If it will not be paid, take the payment off the job from the case.

### A card payment disputed, or a bank payment that failed

A customer who paid a Stripe bill by card can dispute the charge with their bank. Stripe takes the money back while the dispute runs. The bill still reads paid. The app opens a case the moment Stripe says so. It reads *card disputed* and names the bill and their reason. Press {{button:blue|Open the dispute in Stripe}} and answer it there before the day the case names. When Stripe decides for us, the case closes on its own.

If the customer wins, the case reads *dispute lost*. The money is gone, and the job still reads paid. Press {{button:red|Put the bill back}}. It shows what changes before anything moves. The payment comes off the job, and the job's history keeps who did it. The bill goes back to Ready to Bill. Bill the customer again from there, with a new Stripe bill.

A bank payment through Stripe can fail days after the customer pressed Pay. The case reads *bank payment failed*. The bill is still open, but the customer may think it is paid. Ask them for another payment, and press **They said…** when they give a day. The case closes when the bill is paid or voided.

### You don't have to go looking

The moment Mercury reports the return, the office gets an email and a push. The email reads *The bank sent back Southern Post's $13,680 check.* It then says where the check is now and links to its case. It goes to the people on the **Payment made** email stream, under Settings → Email streams. When that list is empty it goes to the whole office. It is sent only once per check.

On the Pipeline the money card reads *2 checks came back*. The job's Billed Awaiting Payment row wears {{chip:red|⚠ check returned · $13,680}} while a payment still counts it. The Dashboard's **Needs you** card names each check and opens its case.

### On a Stripe bill

This works on a Stripe bill too. A deposit matched here is only a row in the app. Stripe never learned of it. So there is nothing on Stripe's side to undo. The two payments Stripe does hold keep their own doors. A part payment recorded as a credit note has **Undo part payment** on its row. A bill marked paid by check through Mark Paid is an ordinary row for seven days. After that it has **Check didn't clear…** on its row. That opens the Undo out-of-band payment window. It also sends the bill back so it can be billed again. See *bill a customer and get paid*.

You can still take one payment off by hand. Open the job, then ③ Payments received. Press {{button:outline|Unlink and remove}} on the row. The confirm says the bank sent the check back. Every removal is kept on the job's payment record. That holds the amount, the bill it was on, who removed it and why.
