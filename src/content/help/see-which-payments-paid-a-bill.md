---
title: see which payments paid a bill
category: Billing & Money
roles: dev, master_technician, assistant, controller, primary
keywords: payments received, by bill, by date, timeline, bill, paid bar, check from, bank deposit, pin it to this bill, no bill picked, move to job, unlink and remove, check date, edit details, other money on the job, days after the bill
---
Open a job and press the **Bill** tab. Each bill lists the payments that paid it. You can see what is still owed on every bill at a glance.

## Read a bill

A bill is one row. It shows the amount, who it went to, and what is still open. A thin green bar under it shows how much of the bill is in. Each payment is one line under the bar.

:::example a bill with two checks
*$26,800.00 · sent Jul 15 to Loberg Contracting · $9,022.49 open*
*$11,700.00 · Sep 14 · check from Loberg Contracting · 61 d*
*$6,077.51 · Sep 28 · check from Loberg Contracting · 75 d*
:::

A line reads the amount first. Then the day the money came. Then where it came from. A bank deposit names the payer the way the bank saw it. A card payment reads *card through Stripe*. A payment you typed reads *check · typed by hand*. The last number is how many days after the bill went out the money came.

## By bill or by date

Two buttons sit at the right of the **Bills and payments** heading. {{button:blue|By bill}} shows each bill with its payments under it. {{button:outline|By date}} puts the bills and the payments on one line of dates, oldest first. Each payment then says which bill it pays. The last row says how much is still open today. The app remembers your choice on this computer.

## Open the menu on a payment

Press {{button:outline|⋯}} at the right of a payment line. The menu holds the rare moves. **Add the check date** is the date written on the check. **Move to job…** sends the payment to the job it belongs on. **Unlink and remove** takes a bank deposit off the job. **Edit details** opens the boxes on a payment you typed.

## Money with no bill picked

A payment can sit on the job with no bill picked. The oldest open bill counts it for now. The line wears {{chip:yellow|no bill picked}}. Press **Pin it to this bill** to keep it there. Or open **Edit details** and pick another bill under **Pays**.

## Other money on the job

The block under the bills is **③ Other money on the job**. It holds a payment that no bill needs, and a payment you are still typing. Press {{button:outline|+ Record a cash or check payment}} to add one. Type the amount and the day it came. The payment moves under its bill once it saves.
