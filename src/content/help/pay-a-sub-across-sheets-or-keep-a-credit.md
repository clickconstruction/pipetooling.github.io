---
title: pay a sub with one check across several sheets
category: Billing & Money
roles: dev, master_technician, assistant, controller
keywords: sub credit, overpayment, overpaid, one check, several sheets, sending, sending number, from credit, use credit, keep a credit, extra, too much, sub labor, record payment, part payment, by hand, place a payment, which sheets, paid too much, paid past the total, over, keep the over as credit
order: 33
---
One check to a sub can pay more than one sheet. You type the whole check once, and the app spreads it for you.

Anything the check carries past their sheets is kept as the sub's credit. The next payment to that sub offers the credit first.

## Record one check for several sheets

1. Open [Jobs → Subs → Pay](/jobs?tab=subs&view=pay).
2. On one of the sub's sheets, press **⋯** and then **Payment…**.
3. Type the full amount of the check in **Amount paid**.
4. Read the list the window shows under the amount.
5. Pick how it was sent, and type the check number.
6. Press {{button:green|Record payment}}.

A small window follows. The window says what was recorded and that the sub has been sent no paper. Press {{button:blue|Send the payment record…}} to [email the paper for this payment](/help/make-a-statement-of-account-for-a-sub#send-it-by-email). Press **Done** to skip it.

:::example What the window lists for a $2,000.00 check
- $1,000.00 on this sheet, paid in full
- $300.00 on 2090 Pinecrest, paid in full
- $500.00 on 2131 Juniper, paid in full
- $200.00 kept as their credit
:::

The sheet you opened is paid first. The rest goes to the sub's other open sheets, starting with the oldest.

Every line of one check carries the same sending number. A sending number is never used twice.

## Place the payment by hand

The window fills the sub's other open sheets oldest first. You can place the money yourself when the check was for other sheets.

1. Type the amount. Press {{chip:gray|By hand}} beside {{chip:gray|Oldest first}}.
2. A box opens for each of the sub's open sheets, filled the oldest-first way as a start.
3. Change the boxes to match the check. The last box keeps money as their credit.
4. The window shows what is placed against what was sent. The press stays dead until every dollar is placed.

The press says what it will do, like {{button:blue|Record $2,200.00 on 2 sheets}}. By hand shows only when the sub has another open sheet.

## Keep the extra as a credit

Untick **Put the extra on their other open sheets, oldest first** to leave the other sheets alone. All of the extra is then kept as the sub's credit.

A credit needs the sub on the roster as one person. For anyone else the window refuses the extra and says what fits.

## Turn a sheet paid too much into a credit

An older sheet can read **Over**. It was paid past its total before credits existed.

1. Go to [Jobs → Subs](/jobs?tab=subs) and find the sheet.
2. Press **⋯** on its row, then **Keep the $… over as credit…**.
3. The window names the payment that changes. It shows what stays on the sheet and what becomes credit.
4. Press {{button:blue|Keep $50.00 as their credit}}.

The sheet now reads paid in full. The money that left the bank is the same, so a bank check mark stays. A match to a bank line stays too.

The window refuses when no single payment is larger than the amount over. Edit the sheet's payments by hand then.

## Use a credit

Open **Payment…** on any sheet of a sub who holds a credit. A green line at the top says how much they hold.

Press **Use $… on this sheet**. The sheet is paid from the credit, and no money leaves the bank.

That payment reads {{chip:gray|From credit}} in the Payments list. Its amount cannot be edited.

## Where a credit shows

- **The Pay view.** The payment that kept it carries a green note in the sheet's Payments list.
- **The Ledger.** [By date](/jobs?tab=subs&view=ledger) shows the note under the amount. By sub shows what each person holds.
- **A statement.** *Credit kept* and *Credit used* are lines of their own.
- **The roster.** [People → Subs](/people?tab=subs) shows it under Balance due.

See [every payment made to subs by date](/help/see-every-sub-payment-by-date) for the Ledger and the statement.

## Take a credit back

Remove the payment that was made from the credit. The credit comes back, and you can use it on the right sheet.

A payment that kept a credit stays on its sheet, so **Move…** is refused for it. Remove it and record the check again.

You cannot remove a payment once part of its credit is used. Remove the payment made from the credit first.

To remove a payment, see [fix a payment on the wrong sheet](/help/fix-a-payment-on-the-wrong-sheet).
