---
title: record what a GC customer paid
category: Bids & Estimating
roles: dev, master_technician, controller
keywords: gc mode, payment, paid, part payment, promise, late, unconditional waiver, customer, bill, billing job, pay by card, card fee, back to a check bill
order: 100
---
Record what the customer paid on a GC job's bill, and when they said they will pay.

The bill sits on the job's billing job in the Pipeline. A payment recorded there or paid by card shows here too. The owner, the leaders and the controller see the window.

## See what is due

1. Press {{button:outline|GC}} on the Bids page to open [GC projects](/gc). Press {{button:outline|Bill the customer}} on the job's card.
2. Find the bill under **Sent**. A certified bill shows when it is due.
3. It is due on the day they said they will pay. Without their word, it is due when they usually pay.
4. A red chip like {{chip:red|late · promised Oct 26, 3 days ago}} means that day has passed.

**Where we stand** lists every late bill and what is still open on it.

## Record a payment

1. Press {{button:blue|Mark paid}} when they paid the rest of the bill. It records the payment today.
2. When they paid only part, press {{button:outline|They paid part…}} instead.
3. Type what they paid and press {{button:blue|Record it}}.

The bill then shows what they paid of what it asks.

## Record when they will pay

1. Press {{button:outline|They said when…}}.
2. Pick the day they will pay by.
3. Pick how they told us. Type who said it.
4. Press {{button:blue|Record it}}.

Their newest day is the day the bill is due. A day they missed stays on the record.

## A bill they pay by card

A customer can turn a certified bill into a card bill in their portal. The card adds a 3% card fee. Only the customer does this, never us, and only on a bill with nothing paid on it. The owner turns the offer on in Settings, under Jobs & billing.

:::example A bill on card
{{chip:blue|on card}} They chose card in their portal on Oct 10. Stripe asks $297,545.37 with the $8,666.37 card fee. Their card page {{button:outline|Back to a check bill}}
:::

The bill still reads at what the architect certified. The fee covers what Stripe charges us, so it never counts in Money. Stripe records the card payment by itself, so there is no {{button:outline|They paid part…}} on a bill on card. Once it is paid, the line says the day and the fee.

## When they want to pay by check after all

1. Press {{button:outline|Back to a check bill}} on the bill.
2. Read what it does. It takes the card page down and the fee off.
3. Press {{button:blue|Back to a check bill}} again to do it.

The bill goes back to what the architect certified. Their portal does not offer the card on that bill again. Once Stripe shows a payment, the bill stays on card.

## Send our unconditional waiver

Our unconditional waiver goes with each payment. It gives up our lien rights for the amount they paid.

1. Press {{button:outline|Make our unconditional waiver}} on the bill.
2. The waiver window opens on the bill. The amount comes from what they paid.
3. Check the form, sign it and send it the way you send any waiver.

The bill then shows {{chip:green|our unconditional waiver went}}.
