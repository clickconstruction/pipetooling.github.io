---
title: see every payment made to subs by date
category: Billing & Money
roles: dev, master_technician, assistant, controller
keywords: ledger, sub payments, statement, by sub, running balance, we owe, 1099, how paid, check number, reconcile, bank statement, date sent, back-charge, backcharge, csv, export, print, month total, paid to, sub labor, payment history, when was it paid
order: 32
---
Jobs → Subs → Ledger lists every payment made to a sub, newest first. You hold it beside a bank statement and check each line.

[Jobs → Subs → Ledger](/jobs?tab=subs&view=ledger) is the third view beside **Work** and **Pay**. Pay shows one row for each sheet. The Ledger shows one line for each payment.

## What a line shows

Each line has seven facts.

- **Date sent** is the day the money left.
- **Paid to** is the sub the sheet belongs to. A teammate's crew sheet carries a {{chip:gray|crew}} chip.
- **Job** is the job's number and name. Press it to open the sheet.
- **How paid** is the method picked when the payment was recorded, with its check number or id.
- **Memo** is what was typed when the payment was recorded.
- **Amount** is the payment. A back-charge is red, with a minus sign and a {{chip:red|Back-charge}} chip.
- **Left on the sheet** is what the sheet still owed after that line. A settled sheet reads {{chip:green|paid in full}}.

Lines sit under their month. The month's row shows how many payments it holds and their total.

A payment moved to another sheet leaves a grey line. The line says who moved it and why. A removed payment leaves one too.

## Pick the period

The ledger opens on {{chip:gray|This month}}. The other chips are {{chip:gray|Last month}}, {{chip:gray|This quarter}}, {{chip:gray|This year}} and {{chip:gray|All}}. The two date boxes set any other range.

**Paid to** narrows the list to one person. The search box finds a sub, a job, a memo or an amount.

Three tiles add up what is showing. They show what was paid, what was back-charged and how many payments have no date.

## Check it against the bank

1. Set the chips or the date boxes to the month on the bank statement.
2. Compare the month's total with the statement.
3. Read down the lines by date and match each amount.
4. Press {{button:outline|Download CSV}} to sort the lines in a spreadsheet.

{{button:outline|Print}} makes a page of the same lines. On a phone both buttons sit under the list.

## See it by sub

Two chips at the top group the ledger. {{chip:gray|By date}} is the list above. {{chip:gray|By sub}} shows one row for each person.

A row shows how many payments went out in the period and their first and last day. It shows what was paid and what was back-charged. **We owe today** is what is still open on their sheets, whatever the period.

A sheet paid past its total shows a green note under the amount. A crew sheet reads *payroll*, because crew pay runs through payroll.

On {{chip:gray|This year}} the paid column is the figure a 1099 starts from.

## The statement for one sub

Press a name on the By sub list. You can also pick the person in **Paid to**. Their statement opens with the oldest line first.

- **Sheet agreed** adds what the sheet was agreed at.
- **Payment** and **Back-charge** take away.
- **We owe** is what was owed after each line.

With a period picked, the first row reads *Brought forward*. It holds what was owed before the period began.

The last row is what you owe them today. Under it the statement checks that figure against Balance due on [People → Subs](/people?tab=subs). A green {{chip:green|✓ checks}} means the two agree.

{{button:outline|Print the statement}} makes a page of it. {{button:outline|Download CSV}} saves it as a spreadsheet. Press **‹ Everyone** to go back to the list.

The same ledger sits on [People → Subs](/people?tab=subs&view=ledger), under **Ledger**. It opens on By sub there.

## When a line says no date sent

A payment saved with no Date sent shows the day it was recorded. It carries a {{chip:yellow|no date sent}} chip.

Press the job to open the sheet. Press **Edit** on the payment and set **Date sent** to the day the money left. A back-charge always shows the day it was recorded.

To move a payment or take one off, see [fix a payment on the wrong sheet](/help/fix-a-payment-on-the-wrong-sheet). To see who is owed what, see [what you still owe each sub](/help/sub-labor-outstanding).
