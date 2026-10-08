---
title: see when a customer will pay
category: Office
roles: dev, master_technician, assistant, controller, primary
keywords: expected payment, pay speed, billed awaiting payment, accounts receivable, follow up, days to pay
---
Every row in **Jobs → Pipeline → Billed Awaiting Payment** predicts its own payment date. So "when should we expect payment?" is answered on the board, not in someone's head.

Each billed row's **View Bill** button also carries a small **PDF tail**. The tail is the page icon attached to the button's right edge. One click opens the invoice PDF in a new tab. The PDF is freshly made with the current payment history, ready to print or send. The tail is the board's one-click PDF.

## Where this fits in the receivables routine

The dates block at the bottom of each row is for reading. The doing happens in four places:

- Quickfill's **Billed Awaiting Payment** station is the daily look at every open bill.
- The Pipeline's **📞 Ask when they'll pay** card is **call mode**. Its badge counts the customers due a call, and **Start call mode →** opens it. The same card is also inside Quickfill → Jobs Cleanup. Call mode is where the promises below get recorded.
- **Accounts Receivable** is the bank-deposit matching desk. The desk's address is `/accounts-receivable`. {{button:blue|Match deposits}} on the Needs you card opens it in place. There, money that already landed gets applied to the bill it pays. Then the row here turns green on its own.
- **GC Review** certifies and sends the weekly GC statements.

"Who owes us?" in one figure is the Dashboard's **Accounts Receivable** card. The card's drill-down, this board, Quickfill and a customer's page all count the same bills.

## Reading the Expected row

Each billed row ends with the bill's dates in one block. The block is a short ledger, explained in [read the Pipeline's money view](/help/read-the-pipeline-money-view). The money is the Expected row:

- *Expected Sep 8 · in 12d* in green means on track. The date is the bill date, from the Billed row, plus the usual pay speed of whoever pays it. On a bill the GC pays, that is the GC. Pay speed is the **median** time between our bill going out and their payments landing. The median is the middle time: half their payments land sooner, and half later. Pay speed covers the last 12 months.
- *Expected Sep 8 · 12d past* in amber means the customer is now slower than **their own** history. Running late against their own history is the real follow-up signal. A 40-day-old bill is normal for a customer who pays in 45 days. The same bill is alarming for a customer who pays in 20.
- A customer with too little payment history gets the company-wide median instead. Too little means *no measurable payment yet*. Treat that median as a rough guess, not their norm.

You hover over the row and it spells out the math. In Collections, the row reads red whatever the dates say.

:::example Answering "when do we get paid on 964?"
Find the row on Billed Awaiting Payment — its dates read *Billed Aug 4* and *Expected Sep 8 · in 12d*. Knight Contracting usually pays about 35 days after billing, the bill went out Aug 4, so early September is the honest answer. No one has to ask the office.
:::

## When the customer names a real date

Statistics stop mattering the moment someone gives you an actual answer. Say a GC tells you "you're on the check run for the 25th". A check run is the day a company sends out its batch of checks. You click the **Expected** row in the dates block to record the answer. You record the date, who said it, and how. The row becomes *They said Sep 25*. The estimate stays as a quiet line under it. So the next person with the question sees the promise and the estimate. The record also keeps who took the call. A date the customer named themselves from their portal statement reads the same, *They said Sep 25*. Its hover says the customer marked it.

- A promise **overrides** the estimate everywhere, including the forecast.
- If the promised date passes unpaid, the row reads *They said Sep 25 · 5d past* in amber. Now you're following up on their word, not a statistic.
- You click the row again to record a new date, or to clear the old one. A new date does not erase the first promise. Every date a customer names stays on record. The app works out whether each one was kept. See *know whether a customer keeps their word*.

Anyone who can see the board sees promises. Marking them is for dev, leaders and assistant-type roles.

## The pay history under it

Under the Expected row, a small line reads how this customer actually pays. The line reads like *Pays in 9–41d · keeps 3 of 7 · slips ~9d*. With four or more payments, the range is the middle half of their payments. With fewer, it runs from their quickest to their slowest. One payment reads *Pays in ~9d*. The promise part appears once they have named dates. See *know whether a customer keeps their word*. The forecast uses the same record. A promise from a customer who usually slips nine days is filed nine days later than the date they gave.

## The payment forecast

The {{button:green|Forecast}} button at the top of the Pipeline rolls every chip up into one view. The Forecast button sits next to {{button:blue|New Job}} and {{button:outline-amber|Follow-ups}}. The same view also opens from the {{button:outline|Payment forecast}} button on the Billed Awaiting Payment header. The view opens from the stage strip's hamburger menu too. The view puts open dollars in buckets by expected payment date. **Past expected** comes first, in red. Past expected is your follow-up queue. Then come **This week**, **Next week** and beyond. The forecast reads two ways:

- **As a cash forecast**: "about $35k should land this week, $47k next week."
- **As a work list**: everything in Past expected is a customer running slower than their own norm. You click any row to jump straight to that bill on the board.

A bill with no bill date sits in **No pay history** at the end. So no money ever hides from the total.

The **Pay speeds** strip under the buckets gives the medians at a glance. The strip shows the company-wide pay time next to the {{chip:blue|Res}} and {{chip:yellow|Comm}} medians. Each median says how many payments it's based on. Res means residential and Comm means commercial. Every row also wears its customer's Res/Comm tag. Commercial GCs usually pay on check runs, while homeowners pay on the spot. So the same "late by 10 days" reads very differently between the two.

## Emailing the forecast

The {{button:outline|✉ Email…}} button in the forecast's header sends this exact view as an email. The email has the bucket totals, the pay-speeds line, and every bill with its expected date. Past-expected follow-ups come first. The email is built **fresh at send time**. So a Monday 7 AM email shows Monday's numbers.

- **Send now** emails a teammate immediately. **Schedule…** picks a date and time, in Central time. **Repeat weekly** turns it into a standing subscription. The classic setup is Monday 7:00 AM. Then the week's cash-in picture is in the inbox before the day starts.
- **Preview** opens the email in a new tab. **Email me a test** sends it to your own address first.
- Pending sends list at the bottom of the dialog, each with a **Cancel**. Cancelling a weekly send ends the chain.
- Recipients are office-capable teammates: dev, leaders, assistant-type roles and primary. Scheduled sends also appear on the recipient's {{icon:gear}} **Settings → Your account → My email schedule**.
- Every job in the email links back to the app. The **Open the forecast in ClickTooling** button lands right on this window.

Sending is for dev, leaders and assistant-type roles. Those roles are the same people who can share the Billed report.

## The months people worked, under a row

A lien is a legal claim on a property for unpaid work. Texas counts lien deadlines from the **month the work was done**, not from the bill date. So every forecast row whose job has clock sessions carries a small chevron arrow at its left edge. You tap it and the months worked open under the row, one line per month:

- **The weeks as bars**: each bar is one week, sized by hours. The number of people that week sits above it. You hover over a bar for the names, the hours, and how many days ago that week was. The hover reads like *Week of Jun 8 (98d ago)*. A hatched bar has sessions still awaiting approval. Only approved hours count toward the lien clock.
- **What counts** reads like {{chip:gray|5 people · 82.7 h · 5 days · 24% of hours}}. The share is this month's part of the job's hours. The share is a rough guide to how much of the open balance the month represents.
- **The notice, on jobs with a GC**: every unpaid month has its own § 53.056 notice date. The date shows {{chip:red|due tomorrow}} inside a week and {{chip:yellow|closes in 12d}} inside two. The date shows {{chip:green|notice sent}} once the Lien window has recorded one for that month. {{button:outline|Send notice…}} opens the **Lien desk** on that job. There the notice is drafted, approved and sent. See *send lien notices from the Lien desk*. Direct-with-owner jobs say *no monthly notice*. Those jobs show their single affidavit date instead. The affidavit is the sworn lien claim filed with the county.

:::example You do not have to open anything to see the one that matters
A sub row whose notice month closes within 14 days wears it on the row itself — {{chip:red|⏱ Jun notice due tomorrow}} — and one amber line above the buckets counts every month closing with the dollars riding on them. Rows with nothing closing look exactly as before.
:::

A {{chip:yellow|property kind unknown}} chip means no property record is linked. So the commercial dates are shown. A residential property is a month earlier on every line. You link the property on **Edit Job → Property record**. The rule itself is in *file a lien and never miss its deadlines*.

## The pay-speeds breakdown

The strip is a door. You click anywhere on the strip. The link at the strip's right end reads **See the breakdown ›**. A second view opens, showing *who* is behind those medians.

- **Three tiles** echo the strip: Company, Res and Comm.
- **Money waiting** lists every customer whose oldest open bill has waited past their own normal, slowest first. The bar on each row **is their open bills**. The bar has one piece per job, sized by dollars. Each piece is colored by how late that bill runs against what this customer usually does. Green is on pace and amber is over it. Red is at twice it or more. Gray means the bill has no date. The row's numbers say it in words: *164d waiting · usually ~35d · $21,850 open on 3 jobs*. **Click the row and each job they owe lists out**. Each job shows its own wait clock, billed date and dollars, and clicks through to the job. There is also a jump to their bills on the board. Customers paying like they usually do collapse into one quiet line at the bottom. The {{button:outline|✉ Email this weekly…}} button in its header sends this exact list by email. That email works the same way as the forecast email above. The button's window has **Send now** and **Schedule…** with **Repeat weekly**, **Preview** and **Email me a test**. The email carries a color legend and every customer's full bill breakdown. The breakdown gives the job, the full address with city, the dollars and the wait. The email rebuilds fresh at send time. The email lands on the recipient's **My email schedule** like the rest.
- ***By customer — slowest first*** ranks every customer by their median. The list shows their payment count and the open dollars riding on their speed. The top of this list is your follow-up list. Customers with *no measurable payment yet* sit muted at the bottom of the same list, with a ***—*** median. Those customers' forecasts run on the company median. The list says so instead of showing a made-up number.
- **Data health** is one quiet line under the tiles. The line says how much of the last year's money the math can actually measure, like *238 of 545 measurable (44%)*. Two amber counts show what the office can fix: *N payments missing info* and *N undated bills*. A payment missing info is not applied to a bill, or its bill has no date. You hover over any number and it says what to do about it.
- **Fixing the misses**: you click the Data health line and every payment lists out with its billed → paid dates. A {{chip:yellow|no bill}} chip means the payment isn't applied to any bill. You open the job to link it. {{chip:yellow|no bill date}} means the bill just needs its date. {{chip:yellow|billed after paid}} means the recorded date sits *after* the money arrived. So that date can't be right, and the math refuses it until it's corrected. Either date problem is fixed the same way. A dev or a leader taps **＋ add date** and types it as MM/DD/YY. The row turns measurable on the spot. The same quick fix works down the whole **Undated bills** backlog.
- **The receipts**: you click any customer row and their story unfolds in two halves. ***Owes now — by job*** lists each open bill with its wait clock and dollars, straight into the job. *Paid before — the payments behind the median* shows when they owe something now. Each payment is a row: a {{chip:green|+8}} pill, then *05/01–05/09*, then the job. That one means billed May 1, and the money hit May 9, eight days later. Tap a row to open its job. Green is at or under the company median. Amber is above it. Red is twice it or more. So one glance shows whether a median is built on steady habits or one slow outlier. A customer with none says why: *No invoice-linked payments in the last 12 months — nothing measurable yet.*

:::example Who's actually slow?
The Comm median says ~25d — but the breakdown shows that's Knight Contracting at ~25d with $16,893 open, while TF Harper runs ~44d with $2,918 open. One number was hiding two very different customers.
:::

## Recording payments so they count

A payment only teaches the system when it's applied to a bill. The bill-to-paid gap comes from that link. The Edit-Job payments table helps that happen on its own:

- You type an amount on a new payment line. If the job has exactly **one** open bill that takes hand-entered payments, **Pays** fills itself in. You can still switch it back to {{chip:gray|Job (no bill picked)}} if the money really isn't for that bill.
- A bill that went out through **Stripe**, the online payment service, records its payments through Stripe. That bill's cash and check payments go through Stripe too. You use {{button:blue|Record payment}} on the bill itself, on the job's Bill tab. Record payment works for the whole balance or part of it. A part payment becomes a credit line on the Stripe invoice, so the pay link asks for the rest. A hand-entered line never attaches to a Stripe bill. If you type one on such a job, an amber note offers **Record on the $1,200.00 bill →**. The note carries your amount across.
- A real payment can be left unapplied on a job that *has* open bills. Then its bill choices show right under the row. Each open bill is a tappable chip with its amount, when it went out, and what's still left on it. A bill whose balance {{chip:green|matches this payment}} is highlighted and listed first. One tap applies the payment to that bill. {{button:outline|Keep as job payment}} leaves it general. The payment stays flagged, since an unapplied payment can't pay a bill down or feed the customer's speed.
- When **two or more** payments need placing, a summary bar appears above the table. You tap {{button:outline|Match payments…}} to place them all in one panel. Each bill's remaining balance updates as you assign.
- A paid date **earlier** than the bill's own date gets a red line. Money can't arrive before the bill goes out. So an early paid date is almost always a mistyped date. The line reads *Received 3 d before the bill went out. Check the date.*

## Where the speed number comes from

The speed number is the same "pays in ~N days" stat the customer profile shows. Only payments that are linked to a billed invoice count. A payment with no bill date can't be measured. Only the last 12 months count, so a customer who cleaned up their act isn't haunted by old habits.

Jobs flagged for **Collections** keep their rows in the Collections section. Their Expected row reads red, and they are left out of the forecast. A job you've already flagged as hard to collect is past statistics. Jobs marked Uncollectible sit in their own band.
