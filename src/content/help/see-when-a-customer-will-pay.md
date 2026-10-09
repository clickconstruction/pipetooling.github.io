---
title: see when a customer will pay
category: Office
roles: dev, master_technician, assistant, controller, primary
keywords: expected payment, pay speed, billed awaiting payment, accounts receivable, follow up, days to pay
---
Each billed row on the Pipeline says when the customer will likely pay. You read the Expected row, and you record a date when the customer names one.

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

## Where the speed number comes from

The speed number is the same "pays in ~N days" stat the customer profile shows. Only payments that are linked to a billed invoice count. A payment with no bill date can't be measured. Only the last 12 months count, so a customer who cleaned up their act isn't haunted by old habits.

Jobs flagged for **Collections** keep their rows in the Collections section. Their Expected row reads red, and they are left out of the forecast. A job you've already flagged as hard to collect is past statistics. Jobs marked Uncollectible sit in their own band.

## The rest of the money picture

- [Read the payment forecast](/help/read-the-payment-forecast): open bills in buckets by when their money should land, and the forecast email.
- [See which customers pay slowly](/help/see-which-customers-pay-slowly): who is behind the pay-speed medians, and the Data health fixes.
- [Record payments so they count](/help/record-payments-so-they-count): how a payment reaches its bill and the customer's pay speed.
- [See which months need a lien notice](/help/see-which-months-need-a-lien-notice): the months people worked, under a forecast row.
