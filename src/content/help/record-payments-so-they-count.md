---
title: record payments so they count
category: Billing & Money
roles: dev, master_technician, assistant, controller, primary
keywords: record payment, apply a payment, pays, open bill, stripe, record on the bill, match payments, keep as job payment, unapplied payment, paid date, received before the bill, in kind, rent credit, credit instead of money, payment type
---
A payment only teaches the system when it's applied to a bill. The bill-to-paid gap comes from that link.

## Apply each payment to its bill

The Edit-Job payments table helps that happen on its own:
- You type an amount on a new payment line. If the job has exactly **one** open bill that takes hand-entered payments, **Pays** fills itself in. You can still switch it back to {{chip:gray|Job (no bill picked)}} if the money really isn't for that bill.
- A bill that went out through **Stripe**, the online payment service, records its payments through Stripe. That bill's cash and check payments go through Stripe too. You use {{button:blue|Record payment}} on the bill itself, on the job's Bill tab. Record payment works for the whole balance or part of it. A part payment becomes a credit line on the Stripe invoice, so the pay link asks for the rest. A hand-entered line never attaches to a Stripe bill. If you type one on such a job, an amber note offers **Record on the $1,200.00 bill →**. The note carries your amount across.
- A real payment can be left unapplied on a job that *has* open bills. Then its bill choices show right under the row. Each open bill is a tappable chip with its amount, when it went out, and what's still left on it. A bill whose balance {{chip:green|matches this payment}} is highlighted and listed first. One tap applies the payment to that bill. {{button:outline|Keep as job payment}} leaves it general. The payment stays flagged, since an unapplied payment can't pay a bill down or feed the customer's speed.
- When **two or more** payments need placing, a summary bar appears above the table. You tap {{button:outline|Match payments…}} to place them all in one panel. Each bill's remaining balance updates as you assign.
- A paid date **earlier** than the bill's own date gets a red line. Money can't arrive before the bill goes out. So an early paid date is almost always a mistyped date. The line reads *Received 3 d before the bill went out. Check the date.*

## A payment that is not money

Sometimes a customer pays with something other than money. A customer who is also your landlord may take finished work off the rent you owe. The job earned its price and the bill is paid down. No cash arrives. Record it as **In kind**.

:::steps

Open the job's **Bill** tab and press {{button:blue|Record payment}} on the open bill. On a job with no bill, press {{button:outline-blue|+ Record a cash or check payment}} under ③.

Type the amount and the date.

Under **Payment type** pick **In kind**.

The memo box now reads **What was given instead of money**. Say what it was, for example *Rent credit, March 2026*. The window will not record an in-kind payment without it.

Press {{button:blue|Confirm}}.

:::

An in-kind payment pays its bill down like any other. The job moves to {{chip:green|Paid}} when nothing is left. It counts toward what the customer has paid. It is never counted as money in the bank. The Dashboard's money-in week leaves it out. Accounts Receivable never waits for a deposit to match it. On the customer's statement it reads *Credit*, never cash.

:::example The rent credit, a month at a time
The landlord takes $1,000 off the rent each month until $22,643.46 of finished work is paid off. Each month, record $1,000 as In kind on the oldest job still open, with the memo *Rent credit, March 2026*. When a bill has less than $1,000 open, record what is open on it and the rest on the next job.
:::

On a bill that went out through **Stripe**, In kind takes the same path as cash. Under the open balance, Stripe puts a credit line on the invoice that reads *Credit applied Mar 3 · $1,000.00*. The pay link then asks for the rest. At the whole balance, the invoice is marked settled outside Stripe. The pay link stops working and no reminder goes out. Nothing claims cash arrived.

You can also type **In kind** in the **Type** box of a payment line under ③. The Memo box then asks what was given instead of money.

A customer who pays this way month after month has a card of their own. See [keep track of work paid in kind](/help/keep-track-of-work-paid-in-kind).

## Where it counts

Each payment on a dated bill gives one bill-to-paid gap. The middle of those gaps over the last 12 months is the customer's pay speed. See [see when a customer will pay](/help/see-when-a-customer-will-pay#where-the-speed-number-comes-from).
