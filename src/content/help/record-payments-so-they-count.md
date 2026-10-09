---
title: record payments so they count
category: Billing & Money
roles: dev, master_technician, assistant, controller, primary
keywords: record payment, apply a payment, pays, open bill, stripe, record on the bill, match payments, keep as job payment, unapplied payment, paid date, received before the bill
---
A payment only teaches the system when it's applied to a bill. The bill-to-paid gap comes from that link.

## Apply each payment to its bill

The Edit-Job payments table helps that happen on its own:
- You type an amount on a new payment line. If the job has exactly **one** open bill that takes hand-entered payments, **Pays** fills itself in. You can still switch it back to {{chip:gray|Job (no bill picked)}} if the money really isn't for that bill.
- A bill that went out through **Stripe**, the online payment service, records its payments through Stripe. That bill's cash and check payments go through Stripe too. You use {{button:blue|Record payment}} on the bill itself, on the job's Bill tab. Record payment works for the whole balance or part of it. A part payment becomes a credit line on the Stripe invoice, so the pay link asks for the rest. A hand-entered line never attaches to a Stripe bill. If you type one on such a job, an amber note offers **Record on the $1,200.00 bill →**. The note carries your amount across.
- A real payment can be left unapplied on a job that *has* open bills. Then its bill choices show right under the row. Each open bill is a tappable chip with its amount, when it went out, and what's still left on it. A bill whose balance {{chip:green|matches this payment}} is highlighted and listed first. One tap applies the payment to that bill. {{button:outline|Keep as job payment}} leaves it general. The payment stays flagged, since an unapplied payment can't pay a bill down or feed the customer's speed.
- When **two or more** payments need placing, a summary bar appears above the table. You tap {{button:outline|Match payments…}} to place them all in one panel. Each bill's remaining balance updates as you assign.
- A paid date **earlier** than the bill's own date gets a red line. Money can't arrive before the bill goes out. So an early paid date is almost always a mistyped date. The line reads *Received 3 d before the bill went out. Check the date.*

## Where it counts

Each payment on a dated bill gives one bill-to-paid gap. The middle of those gaps over the last 12 months is the customer's pay speed. See [see when a customer will pay](/help/see-when-a-customer-will-pay#where-the-speed-number-comes-from).
