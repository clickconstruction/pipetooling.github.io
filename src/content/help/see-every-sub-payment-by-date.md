---
title: see every payment made to subs by date
category: Billing & Money
roles: dev, master_technician, assistant, controller
keywords: ledger, sub payments, reconcile, bank statement, date sent, back-charge, backcharge, csv, export, print, month total, paid to, sub labor, payment history, when was it paid
order: 32
---
Jobs → Subs → Ledger lists every payment made to a sub, newest first. You hold it beside a bank statement and check each line.

[Jobs → Subs → Ledger](/jobs?tab=subs&view=ledger) is the third view beside **Work** and **Pay**. Pay shows one row for each sheet. The Ledger shows one line for each payment.

## What a line shows

Each line has six facts.

- **Date sent** is the day the money left.
- **Paid to** is the sub the sheet belongs to. A teammate's crew sheet carries a {{chip:gray|crew}} chip.
- **Job** is the job's number and name. Press it to open the sheet.
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

## When a line says no date sent

A payment saved with no Date sent shows the day it was recorded. It carries a {{chip:yellow|no date sent}} chip.

Press the job to open the sheet. Press **Edit** on the payment and set **Date sent** to the day the money left. A back-charge always shows the day it was recorded.

To move a payment or take one off, see [fix a payment on the wrong sheet](/help/fix-a-payment-on-the-wrong-sheet). To see who is owed what, see [what you still owe each sub](/help/sub-labor-outstanding).
