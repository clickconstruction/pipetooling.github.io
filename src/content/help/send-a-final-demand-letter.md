---
title: send a final demand letter
category: Billing & Money
keywords: demand letter, final demand, collections, certified mail, tracking number, deadline, escalate, liens on job, lien window, theft of services, chapter 53, attorney's fees, exhibits, statement of account, delivery record
roles: dev, master_technician, assistant, controller
---
A final demand letter gives a late payer one last dated deadline in writing. The app writes it from the job's own bills and history. Then it watches the deadline for you.

Send one when calls and re-sent bills have not brought the money in.

## Open the job's Lien window

Find the job's row under **Billed Awaiting Payment** or **Collections** on the Jobs Pipeline. Press the orange lien icon on the row. The window opens on its **Demand letter** tab. Its title reads *Liens on job* and the job's number.

On a phone, open the job card's menu and press *Lien window · timeline*.

The window has one tab for each paper.

- **Demand letter** is this guide.
- **§ 53.056 notice** is the monthly lien notice. It is covered in [send lien notices from the Lien desk](/help/send-lien-notices-from-the-lien-desk).
- **Mechanic's lien** is the lien affidavit. It is covered in [file a lien and never miss its deadlines](/help/file-a-lien-and-never-miss-its-deadlines).
- **Release of record** shows only once a lien affidavit is filed on the job.

{{button:outline|§ Rules}} sits beside the tabs. It opens [read the Texas lien rules the app follows](/help/texas-lien-rules-the-app-follows) in a new tab, at attorney's fees.

## The job's timeline

The window shows the job's timeline under the job's name. It lists every lien deadline in order. It says whose move each one is.

Once your letter is out, the letter is a square step at its reply by day. **Waiting on** names the GC or the owner. The steps are explained in [send lien notices from the Lien desk](/help/send-lien-notices-from-the-lien-desk), under Where a job stands.

On a phone, the timeline folds to one strip, so the letter gets the room.

- **Next** on the strip names the step to do now.
- The strip also says who you wait on. A red chip names any notice window that closed.
- Press **Steps** to drop the steps down over the letter. Press **Hide** to put them away.
- The tabs become one bar under the strip. With four papers, slide the bar sideways to reach the last one.

## What fills itself in

- *Demand covers bill(s)* lists every billed line with money still open. Press a chip to add or drop that bill. The window starts with the bill you opened it from, or with every unpaid bill.
- **One letter per payer.** When a job's bills went to different payers, each chip names its payer. Pick a bill for another payer, and the letter starts over for that payer.
- **Who owes it** is read from the bill and is never typed. A bill addressed to the GC is demanded of the GC. A bill to the customer is demanded of the customer. A bill with a typed payer is demanded of that payer.
- **A bill that went to the GC** adds a note under the block. The note points to the **§ 53.056 notice** tab. That notice is the paper the statute sends the property owner. It is not a demand.
- **Mailing address** fills from the payer's record, and you can change it. {{chip:red|needs a mailing address}} means none is on file.
- **The letterhead** shows the company name on the left. The return address sits on the right, line for line as typed in Settings. It comes from the **Physical invoice** block under Jobs & billing. The sender's name is not in the letterhead. It signs at the bottom.
- **What the letter claims** is a statement of account, with one block per bill. Each block shows the invoice number the customer saw. For a Stripe bill, that is the number Stripe printed. The block also shows when the bill was sent and due. Then come each line as billed, the payments and the balance.
- **The statement is read only on purpose.** A demand that does not match the bill costs you attorney's fees. Fix a wrong line on the bill, and the letter reads it again.
- **Notice history the letter cites** lists every dated contact. That means each invoice send, each Stripe re-send, each payment promise and each collection call. It reads like *July 15, 2026 — Invoice sent · August 5, 2026 — Invoice re-sent by email*. A payer who reads a dated list knows you keep records.
- **Payment deadline** starts 10 business days out. Press *+10 business days* to set it back to that.
- **The fee date** sits under the deadline. It is the day attorney's fees become recoverable, 30 days after the letter. Texas wants a claim presented before fees can be claimed, and the letter is that step. The letter says both dates.
- *Payment method line (optional)* adds one line on how to pay, like who a check is made out to.

**What counts as paid.** The claim subtracts every payment recorded against the bills it covers. Some payments are recorded on the job with no bill attached. That money first pays any part of the job that is on no bill. That part is the job's total minus the bills sent for it. What is left of the payment pays the oldest bill first. It fills the earliest bill up to what that bill still needs, then the next one. Anything left over sits on the job as a surplus, on no bill.

The letter, its enclosed invoice, the Bill tab and the customer's portal all read that same rule. So they cannot disagree about a balance. If a payment was meant for one bill, link it to that bill. Every reader then follows.

## What the letter may say

Every line the letter threatens must be one you can really do. Every charge it names must rest on a statute or the agreement. The Texas Debt Collection Act applies to you when the payer is a homeowner.

So each switch under **What the letter may say** shows its basis. A line that is not available is greyed, with the reason.

- **Suit in justice court** is offered while the balance is within the $20,000 limit. Above it, the switch reads **Suit in county or district court**.
- **Mechanic's lien under Chapter 53** is offered only while the filing window is open. The switch names the window's last day, and so does the letter. When a lien cannot be filed, the switch says why, like {{chip:red|not offered — the filing window closed …}}. A homestead turns it off. So does a job with no approved work month.
- **Interest at 1.5 % a month** is offered when the bill went out. The bill is the written payment request under the Prompt Payment chapter. The interest runs from the 36th day after the bill was sent.
- **Interest at 6 % a year** is the legal rate, for a bill that was never sent. It runs from the 30th day after the bill was due. With no sent date and no due date, there is no interest line.
- *Theft-of-services report (Penal Code § 31.04)* starts off. Leave it off until the attorney signs off on it. It reads {{chip:gray|not applicable}} once anything has been paid on the job. That counts a payment on any bill, or one recorded on the job with no bill. A partial payment defeats it.
- *Notarial block (certified mail only)* adds a notary's block at the end of the letter. It starts off.

:::example The lawyer's date
A letter sent September 14 names September 28 as the pay-by day. It names October 14 as the day fees become recoverable. The Legal desk lists the letter on the account's Paper tab, under Final demand letters. Its Fees & steps tab shows the same October date, as *fees from 2026-10-14*. So a matter referred after that day arrives with the presentment already done.
:::

## What goes out with it

The letter never goes alone. The **Enclosed** box lists its exhibits.

- **Exhibit A** is the invoice, and it always goes. It is the bill as the customer received it. A letter that covers several bills labels them A-1, A-2 and so on. Each one prints the invoice number and the due date the letter states.
- **The signed agreement** goes next, when the job has one on file. Untick it to leave it out. With none on file, the row reads {{chip:gray|no contract}}.
- **The delivery record** goes last. It puts the dated sends, re-sends, calls and promises the letter cites on one page. The payer can check it against their own inbox. Untick it to leave it out.

The exhibit letters run in order with no gap. With no agreement, the delivery record is Exhibit B.

Every exhibit page is stamped with its letter. The letter names the exhibits under the statement, and again in an *Enclosures* list at the foot. The letter opens with a box that holds the balance due and the day to pay by. The preview on the right shows the letter, then each exhibit as the page it will be.

{{button:outline-blue|Print packet}} opens one PDF in a new tab. It holds the letter, then every exhibit. {{button:outline-blue|Download PDF}} saves the same file. That button also counts the documents in the file.

## Email it too

{{button:outline-blue|Email with the PDF…}} opens a strip at the foot of the window. The **To** box is filled with the payer's email from the bill. The send button counts the documents, like {{button:blue|Send · 3 documents}}. Press it, and the letter and every exhibit go as one attachment.

The send is recorded on the job, with the email's id as its tracking. The deadline watch starts at once.

Email is a second channel, not a replacement. Certified mail with a return receipt is what proves delivery. The § 31.04 presumption and a chapter 53 notice both require it.

## Record the send

Mail the printed packet yourself. Then press {{button:amber|Save & record send…}} and say how it went out.

1. Pick the method. The choices are **Certified mail**, **Traceable courier**, **Email** and **Hand-delivered**.
2. Type the number in **Tracking / receipt number**.
3. Set the mailing day in *Sent on (effective on mailing)*. A notice counts from the day it is mailed.
4. Press {{button:amber|Record}}.

On a phone this step opens as its own page over the window. The top of the page names the letter, the amount and the pay-by date. **Back** returns to the letter.

Recording creates the record and starts the deadline watch. Nothing is mailed from the app. The legal path stays on paper, where it can be proven.

## The deadline watch

Once a letter is recorded, the app keeps it in sight.

- The job's lien icon sits in an amber box while the letter is out.
- **Sent on this job** lists every sent letter, at the top of the Demand letter tab. **View** opens the exact letter again. **Void** is for a letter that was withdrawn or recorded in error. Press **Confirm void** to finish.
- The timeline counts the days left on the letter's step. Past the deadline, it counts the days overdue.
- A red card appears on the Dashboard, under Needs you, when the deadline passes with the covered bills unpaid. It reads *A demand-letter deadline passed unpaid*. A demand letter is worth nothing if you do not do what it promised.
- The card clears itself when payment lands or the letter is voided.
