---
title: record a supply-house bill from its PDF
category: Billing & Money
roles: assistant, controller, master_technician
keywords: supply house, bill, invoice, PDF, scan, counter ticket, photo, fill, autofill, read, credit memo, record this bill, bills to record, thread, messages, drive link, lines, line items, adds up, look, count it as read, what we buy
---
A supply-house bill comes as a PDF in the mail, or as a photo of the counter ticket. The Add invoice window can read that file and fill its own fields. You check the fields beside the paper and press Save, as you always have.

Nothing is written until you press {{button:blue|Save invoice}}. The form never writes over a field you typed. A bill with no PDF is typed exactly as before.

## Start from the bill

1. Open **Materials → Supply houses**, open the house and press {{button:blue|Add Invoice}}.
2. The first section is **The bill**. After *Start from:* you see each PDF or picture from the house's thread that is not on an invoice yet. Press one.
   A tech's ticket bought on a PO code at this house shows there too. The chip reads like **Jordan's ticket, Nov 4, PO 41207**. Press it and the fields fill from the ticket's photo. Save ties the ticket to the bill.
3. The fields fill in. A line under the picker says how many things are left to check.
4. Press {{button:outline|Another file…}} to pick a PDF or a picture from your computer or phone instead. The file is kept with the invoice.
5. Press {{button:outline|No PDF, I will type it}} to type the whole bill as before.

The bill sits beside the fields while you check them. On a phone it is a strip above the fields. Press it to open the whole file.

## What the colours mean

- A green field came from the paper. The form is quoting what is printed.
- An amber field is a guess. One sentence says where the guess came from. Press {{button:outline|Yes}} if it is right, or pick another.
- A plain field is yours to set. The paper cannot answer it. The status is always yours.

:::example The two guesses on most bills
The job: *The paper names no job. J1042 is a guess from PO 41207 and the ship-to address. Right job?* Press {{button:outline|Yes, J1042}} or {{button:outline|Pick another job}}. The job-account tick: *A guess, since the account is open. Untick if this bill is not on it.*
:::

Type into any field and it keeps what you typed. Pick another bill afterwards and your typed fields stay as they are.

## The checks under the fields

The form reads the paper against itself and against the house's list. Each check is one sentence under a field. Save still works whatever the sentence says.

- Under Amount, the form adds the lines up. It says *The 5 lines on the paper add up to $952.28 with the tax, so the total is right.* When they do not, the field turns amber. Two presses offer the lines' sum or the printed total.
- Under Invoice #: {{chip:yellow|S1183420 is already on the house's list}} when the same number is on a row. This may be the same bill twice.
- Under Invoice #: a red sentence when the letterhead names another house. Open that house's row to record it there.
- Under the picker: a statement is several invoices in one PDF. Record them one at a time, each from the thread.

A credit memo switches the form to {{chip:green|Credit}}. The invoice it credits is guessed from the paper's RE line. Press {{button:outline|Yes}} or pick another under **Credits invoice…**. See [record a return or credit from a supply house](?g=record-a-return-or-credit-from-a-supply-house).

## The paperwork

Under **Paperwork** the form names our copy of the file. It becomes the row's {{button:outline|View}} when you save. Press {{button:outline|Use a Drive link instead}} to paste the AP folder's link as before.

## Two doors into the form

- On the house's thread in **Messages**, a PDF or a picture gets an offer. It reads *This reads like a bill from Ridgeway Supply.* Press {{button:blue|Record this bill}} to open the form on that file. Press {{button:outline|Not a bill}} to take the offer away. The file stays on the line.
- On **Supply houses**, the house's row says {{chip:yellow|2 bills to record}} with {{button:outline|Record them}}. The press opens the house and the form on the first one.

A bill you save leaves the count and the thread's offer.

A bill from an address nobody has named gets no offer yet. Press {{button:blue|Who is this?}} on its thread and type the house's name. Pick the house, or the rep who sent it. Its PDFs then get the offer. They count on the house's row too.

## When the fill cannot read

The form says why in one line and stays typeable. The owner or a dev turns the fill on from the Supply houses tab. The model key lives on **Settings → Phone and texts → Model keys**. The fill reads a PDF or a JPEG, PNG, GIF or WebP picture up to 10 MB.

## The lines on the bill

A bill you save from its PDF keeps every line the reader saw. The **Lines** cell on the bill's row says what came of them.

- {{chip:green|6 lines · adds up}} means the lines sum to the paper's subtotal and the total matches the row.
- {{chip:yellow|5 lines · $12.40 short of the subtotal}} means a sum is off. Press {{button:outline|Look}}.
- *No lines yet* means the PDF has not been read yet.
- *No PDF on this bill* means there is nothing to read.

Only bills that add up count toward what the company buys. A bill with a gap waits for a person.

A bill you typed gets its lines too, when it has a Drive link. The app reads the linked PDF by itself within a few minutes of Save. A file that holds several bills is read once. Each bill takes the lines under its own invoice number.

A bill stays at *No lines yet* when the app cannot open its link. It also stays there when the bill's number is not in the file. Fix the link or the number on the bill, and the app reads it again.

:::steps

1. Press {{button:outline|Look}} on the bill's row. The paper opens on the left and the lines read on the right.

2. Read the strip at the top. It says which sum is off and by how much.

3. Fix a number in any line, or type the missing line in the last row. The strip turns green when the lines add up.

4. Press {{button:blue|Save 1 line}}. The press names how many lines you changed.

:::

A line whose own arithmetic fails is marked with an exclamation point. Fix its quantity, its price or its extension.

### What the check allows

Some papers are right and still look off. The check knows these cases.

- Pipe sold by the stick prints a price a foot, rounded. The line may miss its extension by a few cents.
- A box or a case may be priced by the piece. The strip then says *Line 7 is priced by the piece, 50 to a pack.*
- A shipping charge may be printed under the subtotal. The strip then says *A charge of $45.00 is printed outside the subtotal.*
- A rebate among the parts takes money off. Type its extension with a minus sign, such as *-30.00*.
- A line that was ordered and not shipped has no extension. It is left out of the arithmetic.

If you have checked the paper and the gap is the paper's own, press {{button:outline|Count it as read anyway}}. Confirm with {{button:blue|Count it as read}}. The lines then count, and the gap stays beside them with your name.
