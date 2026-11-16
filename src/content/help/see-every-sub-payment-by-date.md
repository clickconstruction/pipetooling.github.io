---
title: see every payment made to subs by date
category: Billing & Money
roles: dev, master_technician, assistant, controller
keywords: ledger, sub payments, mercury, bank line, match, match to a sub payment, banking, paid a sub, find bank lines, checked, tick, not checked, bank reconciliation, statement, by sub, running balance, we owe, 1099, how paid, check number, reconcile, bank statement, date sent, back-charge, backcharge, csv, export, print, month total, paid to, sub labor, payment history, when was it paid
order: 32
---
Jobs → Subs → Ledger lists every payment made to a sub, newest first. You hold it beside a bank statement and check each line.

[Jobs → Subs → Ledger](/jobs?tab=subs&view=ledger) is the third view beside **Work** and **Pay**. Pay shows one row for each sheet. The Ledger shows one line for each payment.

## What a line shows

Each line has seven facts.

- **Date sent** is the day the money left.
- **Paid to** is the person the sheet belongs to. A teammate paid as sub labor carries a {{chip:gray|team}} chip.
- **Job** is the job's number and name. Press it to open the sheet.
- **How paid** is the method picked when the payment was recorded, with its check number or id. Lines that were one check share a sending number under it.
- **Memo** is what was typed when the payment was recorded.
- **Amount** is the payment. A back-charge is red, with a minus sign and a {{chip:red|Back-charge}} chip. A green note under it shows any part kept as the sub's credit.
- **Left on the sheet** is what the sheet still owed after that line. A settled sheet reads {{chip:green|paid in full}}.

Lines sit under their month. The month's row shows how many payments it holds and their total.

A line marked {{chip:gray|From credit}} was paid from the sub's credit. No money left the bank for it, so it is in no paid total.

A payment moved to another sheet leaves a grey line. The line says who moved it and why. A removed payment leaves one too.

## Pick the period

The ledger opens on {{chip:gray|This month}}. The other chips are {{chip:gray|Last month}}, {{chip:gray|This quarter}}, {{chip:gray|This year}} and {{chip:gray|All}}. The two date boxes set any other range.

**Paid to** narrows the list to one person. The search box finds a sub, a job, a memo or an amount.

Three tiles add up what is showing. They show what was paid, what was back-charged and how many payments have no date.

## Check it against the bank

1. Set the chips or the date boxes to the month on the bank statement.
2. Compare the month's total with the statement.
3. Read down the lines by date and match each amount.
4. Tick the box at the start of a line once you find it on the statement.
5. Press {{chip:gray|Not checked}} to see only the lines still to find.

The **Checked against the bank** tile counts as you go. It shows how many are ticked, how many are left and what they add up to.

A tick records your name and the day. Hover the box to read them. Untick the box to clear it.

Lines of one check share a sending number. Ticking one of them ticks them all, because the bank shows one line.

A back-charge has no box, and neither does a line paid from credit. No money left the bank for them.

**How paid** narrows the list to one method. Pick {{chip:gray|Check}} to work through the checks on one statement.

Changing a ticked payment's amount or date clears its tick. The Edit window says so before you save.

## Let the bank find the line

Press {{button:outline|Find bank lines}} above the list. The app reads the money that left Mercury in the period.

A payment gets a small picker when a bank line fits it. A line fits when the amount is the same and the day is within three days.

Open the picker and choose the bank line. The payment is matched and ticked in one press.

The closest day comes first in the picker. A payee that reads like the sub's name breaks a tie.

A matched payment shows the bank line's day and payee in green. Press **undo** beside it to take the match off. The tick is cleared with it.

One check that paid several sheets is matched as one. The picker compares the whole check with the bank line.

Nothing is matched by itself. A payment with no bank line that fits keeps its box, and you tick it by hand.

## Match it from Banking

You can make the same match from the bank's side. Open [Banking → Ledger](/banking?tab=ledger) and find the money that left.

A bank line gets a small picker under its payee when a sub payment fits it. The picker reads **Match to a sub payment…**. A payment fits when the amount is the same and the day is within three days.

Open the picker and choose the payment. The two are matched, and the payment is ticked on the Subs Ledger.

:::example A bank line a sub payment fits
CALLOWAY TILE LLC

{{button:outline|Match to a sub payment…}}
:::

A matched bank line says who it paid, in green. One check that paid several sheets shows its sending number and how many sheets.

:::example A bank line that is matched
CALLOWAY TILE LLC

{{chip:green|paid Calloway Tile · sending 12 · 2 sheets}} undo
:::

Press **undo** beside it to take the match off. The payment's tick is cleared with it.

A bank line that one payment took is offered to no other payment. Nothing is matched by itself here either.

A transfer between the company's own accounts is never offered. It paid nobody.

Only the people who run Banking's Ledger see the picker. They are the controller and the developer.

{{button:outline|Download CSV}} saves the lines to sort in a spreadsheet. The file has a column for the day each was checked.

{{button:outline|Print}} makes a page of the same lines. On a phone both buttons sit under the list.

## Gather old payments into one

One check that paid three sheets used to be typed as three payments. The Ledger can gather them into one.

1. Press {{button:outline|Gather old payments…}} beside **Download CSV**. It shows only when there is something to gather.
2. Each group is one person, one day and one way of paying. A ticked group will be gathered.
3. A group the app is unsure of says **Held** with its reason. Tick it if it was one payment.
4. Press the blue button. It says how many it will gather.

Gathering changes no amount, date or sheet. The payments get one number. A check mark on one then covers them all.

Payments matched to different bank lines are refused. They were not one payment.

## See it by sub

Two chips at the top group the ledger. {{chip:gray|By date}} is the list above. {{chip:gray|By sub}} shows one row for each person.

A row shows how many payments went out in the period and their first and last day. It shows what was paid and what was back-charged. **We owe today** is what is still open on their sheets, whatever the period.

A sheet paid past its total shows a green note under the amount. A sheet with no name on it reads *payroll*, because it is owed to nobody.

On {{chip:gray|This year}} the paid column is the figure a 1099 starts from.

## The statement for one sub

Press a name on the By sub list. You can also pick the person in **Paid to**. Their statement opens with the oldest line first.

- **Sheet agreed** adds what the sheet was agreed at.
- **Payment** and **Back-charge** take away.
- **Credit kept** takes away too. It is money sent past what the sheets needed.
- **Credit used** changes nothing. The sheet owes less, and so does their credit.
- **We owe** is what was owed after each line.

With a period picked, the first row reads *Brought forward*. It holds what was owed before the period began.

The last row is what you owe them today. Under it the statement checks that figure against Balance due on [People → Subs](/people?tab=subs). A green {{chip:green|✓ checks}} means the two agree.

{{button:outline|Print the statement}} makes a page of it. {{button:outline|Download CSV}} saves it as a spreadsheet. Press **‹ Everyone** to go back to the list.

The same ledger sits on [People → Subs](/people?tab=subs&view=ledger), under **Ledger**. It opens on By sub there.

## When a line says no date sent

A payment saved with no Date sent shows the day it was recorded. It carries a {{chip:yellow|no date sent}} chip.

Press the job to open the sheet. Press **Edit** on the payment and set **Date sent** to the day the money left.

A back-charge has a **Date** box of its own. One recorded before that box shows the day it was typed.

To move a payment or take one off, see [fix a payment on the wrong sheet](/help/fix-a-payment-on-the-wrong-sheet). To see who is owed what, see [what you still owe each sub](/help/sub-labor-outstanding).
