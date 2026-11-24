---
title: record a payment to a supply house
category: Billing & Money
roles: assistant, controller, master_technician
keywords: supply house, pay, payment, paid, mark paid, mark unpaid, record a payment, see the payment, remove a payment, ach, card, check, confirmation number, due day, past due, make payment, apply payment, receipt, link, invoice, bill
---
You open a supply house and its bills come first, in groups by the day they fall due. You pay the house in its own portal, then you record that payment here. One payment can cover several bills.

## Read a house's bills

Open **Materials → Supply Houses** and press the house's row. The house's card opens on **Invoices**. The heading says the house's pay day, like *pays on the 15th*.

Up to four numbers lead the card:

- **Open** is everything unpaid, with the count of bills.
- **Past due** shows in red when a bill is late.
- The next due day, like **Due Nov 15**, is what falls due first.
- **Not on a job account** counts the job bills that are ours alone to carry. You see this number only at a house that uses job accounts.

The bills sit under the numbers, in groups. **Past due** is first, oldest day first. Each due day follows, soonest first. **No due date** is last. A group's heading says how many bills are left in it and what they add up to. The largest bill of a day leads its group.

A bill is two lines. The top line is the job. A bill with no job shows its PO's words there. The second line holds the invoice number, the PO, the day it was billed and the lines check. **See the bill ›** opens the invoice.

A date reads month and day, like *10/31*. You see a year only when it is not this year, like *12/5/25*.

:::example A bill's row
**201 · Maple Lofts** {{chip:green|Job acct}} · S1234567 · PO 4112 · billed 10/31 · 6 lines · adds up · **See the bill ›** · **$412.80** · {{button:outline|Mark paid}}
:::

**Job accounts** sits under the bills, folded. Press it to see each job's account with this house. The app remembers how you left it.

## Mark one bill paid

1. Find the bill in its group.
2. Press {{button:outline|Mark paid}} on its row.

The row stays where it is and turns grey. The row reads **Paid today**. The page does not reload, so you keep your place. The group's count and total go down, and so do the numbers at the top.

Pressed the wrong bill? Press {{button:outline|Mark unpaid}} on the same row. The grey row stays listed until you close the house.

Each bill is marked by itself. The card has no tick boxes. To pay several bills with one payment, use **Record a payment** below.

Mark paid keeps the day and the amount. It does not say how the bill was paid. Use **Record a payment** when you know the method and its number.

## Say how a payment was sent, later

A bill you marked paid still needs how it was paid. Its row says *how it was paid is missing*, with **Finish…** beside it.

1. Press **Finish…** on the row.
2. Pick how it was sent: **Card**, **ACH**, **Check**, **Cash** or **Other**.
3. Type the method's number in the box under the chips.
4. Check **Date sent**. You may paste the **Receipt link**.
5. Press {{button:green|Save how it was sent}}.

The amount stays as it is. The row then names the payment, and its press becomes **See the payment**.

Every payment that still waits is counted in one place. Accounts payable shows a line over the aging table, like **3 payments need how they were paid**. Press it to open the list, then press **Finish…** on a row. The longest wait is first.

Needs you counts them too, under **Supply houses**. Its **Finish them** press opens the same list.

A payment recorded with **Say later** waits on that list as well. A bill paid before payments were recorded never does.

To change how a recorded payment was sent, press **See the payment** on a bill it paid. Then press **Edit how it was sent**.

## Record a payment

Pay the house in its portal first, as you always have. The app never moves money. It writes down what you sent.

1. Open **Materials → Supply Houses**. Open the house and press {{button:green|Record a payment}}.
2. Tick the bills the payment covered. The open bills are listed oldest due first. **Amount sent** adds itself up as you tick.
3. Check **Date sent**. It opens on today.
4. Pick how it was sent: **Card**, **ACH**, **Check**, **Cash** or **Other**. The chips open on how this house was paid last.
5. Type the method's number in the box under the chips. That is the confirmation number, the check number or the card's last four.
6. You may paste the **Receipt link**. That is the bank confirmation, the house's receipt or the check image.
7. Press the green button. It names what it records, like **Record $2,052.40 on 2 bills**.

Each ticked bill turns paid on the day you gave.

:::example The window, with two bills ticked
**Record a payment to Cedar Fork Supply** · 3 open bills · $2,441.55 · pays on the 20th. **Amount sent** reads 2052.40. {{chip:blue|ACH}} is picked. The line at the bottom reads **$2,052.40 placed of $2,052.40 sent**. The button reads {{button:green|Record $2,052.40 on 2 bills}}.
:::

Three links sit over the bills:

- **Tick everything due by Nov 20** ticks every bill due by the house's next pay day.
- **Fill oldest first** ticks every open bill.
- **Clear** starts over.

You can type **Amount sent** instead of ticking. The app then fills the oldest bills first. The last bill it reaches may be paid in part.

You may not know yet how it was sent. Press **Say later**. The payment is recorded now, and the button's words end in *details later*.

## Pay part of a bill

Each ticked bill has a box with what the bill has open. Type a smaller amount in the box to pay part of it. The line under the bill says how much stays open.

The bill stays unpaid until the rest is paid. Its row lists what is left, and says what was paid.

:::example A bill paid in part
**201 · Maple Lofts** · **$300.00 paid · $512.40 left of $812.40** · S4402277 · billed 10/1 · **$512.40** · {{button:outline|Mark paid}}
:::

The numbers at the top of the card count what is left. So do the aging table and Held for suppliers.

## Use a credit memo

An open credit memo sits under the bills in the window. Tick it. **Amount sent** drops by the credit, the way the house's statement nets it. The credit memo then reads used.

A credit covers bills, so tick the bills it goes on too. The button stays grey while the credit is more than the bills ticked.

## Keep money on account

Sometimes you send more than the bills you ticked. The line at the bottom says how much is not on a bill yet. A tick box under it names the amount, like **Keep $187.40 on account with Cedar Fork Supply**. Tick it and the button comes alive.

The house's card then shows **On account** beside its other numbers. The next payment to that house offers the money first, like **Use $187.40 on account first**. Tick it and that money goes on the oldest bills you tick.

## The house added interest or a late fee

A house may add interest when a bill runs past 30 days. You record it with the payment that paid it.

1. In **Record a payment**, press **+ The house added interest or a late fee** under the bills.
2. Type the amount in the box on that line.
3. Pick the bill that ran late under **Which bill was late**. Leave **Not tied to a bill** when you do not know.
4. Tick the other bills the payment covered, and press the green button.

**Amount sent** adds the interest in. The button's words end in *and interest*.

The app keeps the interest as a bill of its own. It is marked {{chip:yellow|Interest}} and reads paid by this payment. Its row is named for the late bill, like **Interest on S4398120**, and says *not a job cost*.

Interest is never put on a job. It stays off every job's cost, so the house's late charge does not look like materials.

The house billed interest you have not paid yet? Press {{button:blue|Add Invoice}} and tick **This is interest or a late fee**. It then waits with the other bills until a payment covers it.

Accounts payable adds the year up under its total, like *Interest and late fees in 2026: $61.20*, with each house's share.

## Let the bank agree

The app reads the company's bank lines. A card or ACH payment to a supply house shows there with its day and its amount. The app holds your payments against those lines, so a wrong digit shows up.

Press {{button:outline|See the payment}} on a bill. When the bank holds a line for the same money within three days, the window offers it.

1. Read the line. It shows the day, the payee and the amount.
2. Press **Match** beside the line that is this payment.

The window then reads **Bank agrees ✓** with that line. Press **Take it off** to undo the match.

:::example A payment the bank agrees with
**$5,000.00 to Pecan Supply** · 11/12 · ACH 88213. {{chip:green|Bank agrees ✓}} 11/12 · PECAN SUPPLY ACH · $5,000.00.
:::

The finish-later list uses the bank too. A payment that waits there may read *The bank has it*, with **Use this line**. One press fills the day and how it was sent, and the payment leaves the list.

The bank also shows money that went to a house with no payment recorded. Accounts payable counts those in a line, like **2 bank lines to supply houses have no payment recorded**. Press it to open the list. Then press **Say what it paid** on a line. **Record a payment** opens with the amount, the day and the method filled. Tick the bills it paid and press the green button.

A purchase at the counter that the Tally already sorted is not listed there. Neither is a line from before payments were recorded.

Some houses are paid in a way the bank feed does not show. Their payments get no offer. Type how each was sent, as before.

## See a payment, or remove one

A bill paid by a recorded payment names it on its row. The row reads the paid day, the method with its number, and how many bills the payment covered.

:::example A paid bill's row
**201 · Maple Lofts** · paid 11/12 · ACH 88213 · one of 4 bills on $5,000.00 · S1234567 · billed 10/3 · **See the bill ›** · **Receipt ›** · **$412.80** · {{button:outline|See the payment}}
:::

Press {{button:outline|See the payment}} on that row. The window lists every bill the payment paid, with the amount on each. The line at the bottom says what the lines add up to.

A bill paid by a recorded payment has no **Mark unpaid**. The money was sent, so you move it or remove the payment instead.

## The house applied the money to another bill

A supply house sometimes puts your money on a different bill than you recorded. Move it here so both sides agree.

1. Press {{button:outline|See the payment}} on a bill that payment paid.
2. Press **Move…** beside the bill the money should leave.
3. Check **How much to move**. It opens on everything the payment has on that bill. Type less to move part of it.
4. Pick the bill it goes to. The house's open bills are listed oldest first. **On account, no bill** is last.
5. Say why with a chip: **The house applied it differently**, **I picked the wrong bill** or **Something else**.
6. Read **What changes**. It shows both bills before and after.
7. Press the blue button. It names the move, like **Move $1,000.00 to S4398120**.

:::example What changes
S4393015 · paid $1,000.00 → $0.00 · open $0.00 → $1,000.00 · reads unpaid again. S4398120 · paid $0.00 → $1,000.00 · open $1,240.00 → $240.00. The payment still totals $5,000.00.
:::

The payment keeps its day, its amount and how it was sent. Only the bill changes.

Each bill then says where the money went on its own row. The bill it left reads like *$1,000.00 moved to S4398120*, with who moved it and why. The bill it reached reads like *$1,000.00 moved here from S4393015*.

Money on account moves the same way. Press **Put on a bill…** beside **On account** in the payment's window.

Moved it by mistake? Open the payment again. **What happened to it** lists each move. Press **Take it back** beside the move.

## Remove a payment, or put it back

Recorded a payment that was never sent? Press **Remove this payment…** in the payment's window. The app says what will change and asks why. Type the reason and press {{button:outline|Remove payment}}. Every bill it paid reads unpaid again.

A removed payment waits under the house's bills for 30 days, in **Removed in the last 30 days**. Press **Put it back** there and its bills read as they did.

The app refuses to put a payment back when one of its bills was paid another way since. It names the bill. Record the payment again with the right bills.

Tick **Show paid invoices** at the top of Accounts payable to list the paid bills too. Paid bills sit in a **Paid** group at the bottom of the card. A bill paid before payments were recorded reads its paid day alone.

## What the two links are

- **See the bill ›** opens the **invoice** over the page. That is the scan or PDF saved on the bill when it was entered. The house's bills sit beside the paper, in the card's order. Press **Next** or the right arrow key to read the next one. The link icon beside it copies a link to the bill for a teammate. See [search and share a job's supply house invoices](/help/search-and-share-a-jobs-supply-house-invoices#flip-through-the-invoices).
- **Receipt ›** opens the receipt link you pasted in Record a payment. It is saved **beside** the invoice, never over it. Leaving the box blank changes neither link.

To fix a paid day, use the pencil on the bill's row. To unmark one bill, press {{button:outline|Mark unpaid}} on its row. A bill paid by a recorded payment keeps that payment's day, and its status is locked in the Edit window.

## See the bills inside an aging cell

The aging table shows unpaid dollars by how late they are. Press any colored cell to see the bills inside it. The window opens with a strip. It shows how much of the cell is on job accounts and how much is not. A bar under it draws the same split.

The bills sit under their job. Each job's heading says its job account state in words. Each bill shows its number, its PO and date, how late it is and its amount. The **↗** at the end of a row opens that bill over the window. **Next** then moves through the cell's bills. A late bill carries a {{chip:red|116 d}} chip. A bill on the house's job account reads {{chip:green|On it ✓}}. The bottom line always matches the cell.

:::example A cell's window
**Moore Supply** and **90+ days past due** in the title. The strip reads **$0.00** on job accounts and **$7,199.38** not on one. Seven jobs follow, each with {{chip:yellow|No job account at Moore Supply}}.
:::

The **Total** row opens the same window across every house, grouped by house. The **Owed** cell shows everything one house owes. The **Credits open** cell lists the house's credit memos. The blue button at the bottom is named for the house. Press it to open the house and work on those bills. What each job's state means is in [work a cell by job](/help/mark-an-invoice-on-a-job-account#work-a-cell-by-job).

## Fix a bill from the cell

Every bill in the window is a door. Press its number and the bill opens in the same Edit window the house uses. The cell's window stays behind it. Save, and the cell counts again.

A bill with no due date sits in the **No due date** cell. The row offers {{button:outline|Add a due date ›}}. Press it and the bill opens with the **Due date** box ready. Type the date and press {{button:green|Save}}. The bill moves to its aging column.

A bill with no job sits under **No job yet**. The row offers {{button:outline|Pick a job ›}}. Press it and the bill opens with the job search ready. Choose the job there. The window then shows the bill under that job.

A house's window offers {{button:outline|Record a payment ›}} at the bottom. Press it and the house's **Record a payment** window opens over the cell. Tick the bills and press the green button. The **Total** row's window spans every house, so it has no payment button.

:::example A No due date row
**S124687508.003** · PO 4112 · Jul 3, 2026 · no due date · **$412.80** · {{button:outline|Add a due date ›}}
:::

## On a phone

On a phone, Accounts payable is a list of houses with what each is owed. Tap a house and its own screen opens. That is the screen to hold while you are on the phone with them:

- the **balance**, the aging bar and the pay day, with {{button:blue|☎ Call counter}} beside it
- **Notes on this house** is where you type right there and press {{button:outline|Save notes}}. It is one shared note for the house. The Edit window shows the same one.
- {{button:outline|Add invoice}} and {{button:outline|Record a payment}}
- the invoices as rows under **Unpaid**, **Paid** and **Credits**. Each row shows the number, the due day, the jobs, and one amount. An overdue one carries a {{chip:red|22 d past due}} chip

Tap an invoice for its actions: **Mark paid**, **View the invoice**, **View the receipt**, **Edit**. A bill paid by a recorded payment offers **See the payment** in place of **Mark unpaid**.

In the Directory above it, each house's card shows what is owed and its pay day. That is for office logins only.

