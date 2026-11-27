---
title: set a payer's pay calendar
category: Billing & Money
roles: dev, master_technician, assistant, controller, primary, estimator
keywords: pay calendar, pay terms, estimator, won bid, send to dispatch, check and use, cutoff, pay day, due, due date, pay application, 10th of the month, contract terms, payer, general contractor, GC, pay when paid, net 30, net 45, days after the bill, expected payment
---
Some customers pay on a set day of the month. You record that once on the customer, and the app keeps both days.

Most customers pay some days after each bill, and the app already measures that. A few pay on a calendar instead. Their contract names a day bills must be in by, and a day they pay.

## What a pay calendar is

A contract of this kind names two days.

- **The cutoff** is the day a bill must be in by. Often that is the last day of the month.
- **The pay day** is the day they pay. Often that is the 10th of the next month.

A bill sent on the 1st and a bill sent on the 30th are due the same day. A bill one day past the cutoff waits a whole extra month.

:::example Reading a contract
The contract says progress payments are made on the 10th of the month after a pay application is received. That is a cutoff on the last day of the month, and a pay day on the 10th of the next month.
:::

A pay application is the bill a commercial job sends in each month.

## Open the window

:::steps
1. Open the customer who pays the bills. On a job a general contractor pays, that is the general contractor.
2. Find **Pays in** in the money strip.
3. Press *Set a pay calendar…* under it.
:::

You reach the customer two ways. On **Jobs → Pipeline**, press the customer's name on a row. Or open **Customers** and pick them.

There are two shorter ways from a billed row. Press the *Pays in* words under the row's dates, and the same line sits on the customer's card in Pay speeds. Once a calendar is set, the calendar's own words sit under the row's dates. Press them to open the window.

Once a calendar is set, the line reads like *In by month end, paid the 10th*. Press the line to change the calendar.

## Fill it in

:::steps
1. Pick the cutoff under **Bills must be in by**.
2. Pick the pay day under **They pay on the**. Then pick the month the pay day falls in.
3. Tick **They pay when the owner pays them** if the contract says so.
4. Type the clause number and a few of its words under **Where the contract says it**.
5. Press {{button:blue|Save pay calendar}}.
:::

The blue box says the calendar back in dates. Read the box before you save.

:::example The blue box
**A bill in by Nov 30 is due Dec 10.**
A bill in on Dec 1 is due Jan 10.
:::

## Read their record

The amber box checks the calendar against what the customer really did. The app takes their past payments. It works out when each bill was due under what you typed. Then the box says how many days after that the money landed.

:::example Their record against this
Their last 4 payments landed 0 to 14 days after the due day. Usually about 6. 1 of 4 were on time.
:::

- A small number means the calendar fits how they pay.
- A large number means they pay late against their own contract. The calendar is still right.
- *No payment on record yet* means the contract is all the app knows about them.

The contract says when a bill is due. The record says when the money lands. The app keeps the two apart.

The record uses their newest 12 payments. Change a choice and the box works the record out again.

## A number of days after the bill

Some contracts name no day of the month. Such a contract says a bill is paid a number of days after it is accepted, like 45.

The window does not ask for these terms today. None of our contracts pays that way, so the choice is put away. When a contract needs these terms, ask for the choice to be turned back on.

A payer or a job already on these terms still shows them. Its window then opens with **How they pay** as the first choice.

:::steps
1. Under **How they pay**, keep **A number of days after the bill**.
2. Type the number under **Days after the bill is accepted**.
3. Tick **They pay when the owner pays them** if the contract says so.
4. Type the clause number and a few of its words.
5. Press {{button:blue|Save pay calendar}}.
:::

:::example The blue box
**A bill accepted today, Nov 12, is due Dec 27.**
Each bill has its own due day. No cutoff decides a month.
:::

These terms have no cutoff. So the *Send by* lines and **Cutoffs coming** do not show for them.

The line then reads like *Paid 45 days after the bill*. Everything else works as it does for a calendar.

The days count from the day the customer accepts the bill. See [When they accepted a bill later](#when-they-accepted-a-bill-later).

One job can be on these terms alone. See [One job on a different calendar](#one-job-on-a-different-calendar).

## When to leave it unset

Leave the calendar unset for a customer whose contract names no pay terms. The app's usual guess is better for them.

A calendar holds one cutoff and one pay day. A customer with two pay days a month does not fit one.

## From a contract on their form

A general contractor's own subcontract is recorded as **Their paper** on the job. The record keeps the key terms with their clause numbers. One of them is **Pay calendar**.

:::steps
1. Open **Their paper** from the job's contract strip.
2. Type the clause number and a few of its words beside **Pay calendar**.
3. Press *Set their pay calendar…* under the key terms. The line carries the customer's name.
4. Pick the days in the window that opens. The clause is already filled in.
5. Save the calendar, then save the paper.
:::

The paper holds the clause. The calendar holds the days. You set the calendar for that job, or for every job that customer pays.

## One job on a different calendar

Most of a customer's jobs follow one calendar. One job may have a contract of its own, or none.

:::steps
1. Open the job and go to its **Edit** tab.
2. Find the **Pay calendar** row. It sits with the customer's rows.
3. Press the row's words.
4. Under **This calendar is for**, pick the choice that names the job.
5. Change the days, or tick **This job has no pay calendar**.
6. Press {{button:blue|Save for this job}}.
:::

The row's words say whose calendar the job reads.

- *Follows Larkfield Construction* means the job reads its customer's calendar.
- *This job's own* means the job has a calendar of its own.
- *No pay calendar on this job* means the job was switched off.
- *Set a pay calendar…* means nothing is set yet.

You can start from **Jobs → Pipeline** too. Press the calendar's words under the row's dates. On a Ready to Bill row, press the *Send by* line.

A row with no calendar reads *Pays in* there. Press it. Then press the pay calendar line in the window that opens.

On the Pipeline a job on its own calendar says so. The job's row reads *This job's own* before the calendar's words. A job that was switched off reads *No pay calendar on this job*. Press either one to open the window on that job.

The customer's own window lists the jobs that do not follow it. Press a job there to open its calendar.

### The record on a job's own calendar

A job on its own calendar pays under its own terms. So the app scores it on that job's own payments. The job needs two payments first.

- With two or more, the line under the due day ends *this job's record*.
- With one or none, the line ends *their record on other jobs*. The customer's other payments stand in until the job has two.

The amber box in the window says the same. On the job's side it reads **This job's record against this** once the job has two payments.

:::example A job with two payments of its own
This job's last 2 payments all landed by the due day.
:::

A job in a development offers one more tick, like *Also set on the other 12 jobs in Larkfield Commons*. Tick it to set them all at once. The button then names the count, like {{button:blue|Save for 13 jobs}}. A job that fails is named with its reason, and the rest are still saved.

To undo it, open the same window on the job and press {{button:outline|Follow Larkfield Construction again}}. The button carries the customer's own name.

## Pay terms an estimator read on a won bid

An estimator reads the general contractor's contract when a bid is won. An estimator cannot set a pay calendar. The estimator writes the terms down, and the office sets the calendar.

The estimator does this on the sheet they already send to Dispatch.

:::steps
1. Press {{button:green|Send to Dispatch}} on the won bid.
2. Press *+ Add their pay terms* under the general contractor.
3. Pick **Only this job** or the choice that names every job they pay.
4. Pick the cutoff and the pay day. Type the clause number.
5. Press {{button:outline|Done}}. The terms close to one line.
6. Press **Send to Dispatch**.
:::

Pick **Only this job** when this job's contract says it. Pick every job when their standard subcontract says it. The estimator sees the dates said back. The estimator never sees the customer's payments.

Leave the line alone for a customer whose contract names no pay terms.

The office meets the terms in New Job. Dispatch presses {{button:outline|Open the job}} on the won bid's row, as always.

:::steps
1. Find the line that starts *Pay terms from* above the customer.
2. Press *Check and use*.
3. Read the amber box. The box checks the terms against how they have paid.
4. Press {{button:blue|Use for this job}}, or pick every job they pay and press {{button:blue|Save pay calendar}}.
5. Finish New Job and press **Create Job**.
:::

:::example The line in New Job
Pay terms from Dana Whitfield's draft: **In by the 25th, paid the 10th** sets with the job
:::

Terms for this job alone are saved when the job is created. Terms for every job they pay are saved at once.

You can skip the line. The terms stay with the job. The job's **Pay calendar** row on its **Edit** tab then reads *From Dana Whitfield's draft* with *Check and use* beside it. The offer stays until you use it, or tick **This job has no pay calendar**.

Sometimes the job is already open, or the signed contract comes later. The estimator's won bid then shows *+ Send their pay terms to the office* beside the job's chip. Dispatch gets a row with two buttons.

- {{button:outline|Open the pay calendar}} opens the window on that job, filled in. Saving it closes the row.
- {{button:outline|Not a calendar payer}} closes the row and sets nothing.

The estimator is told the answer either way.

## When they accepted a bill later

A calendar counts from the day the customer accepts a bill. The app only knows the day the bill went in. Most of the time that is the same month, and nothing needs doing.

A bill sent back and accepted the next month is due a whole month later. You tell the app the day they accepted it.

:::steps
1. Find the bill on **Billed Awaiting Payment**.
2. Press *Counted from Nov 24* under the row's dates.
3. Pick **The day they accepted it**.
4. Read the box. It says what each day makes the bill.
5. Press {{button:blue|Save the accepted day}}.
:::

:::example What the box says
In on Nov 24, it is due Dec 10.
**Accepted Dec 2, it is due Jan 10.**
:::

The line under the row then reads *Accepted Dec 2*. Press it again to change the day, or to clear it.

## One bill due on a named date

Some bills have a date of their own in the contract. A retainage release is one. A dated draw is another.

A pay calendar cannot hold that date. So you set it on the bill.

:::steps
1. Find the bill on **Billed Awaiting Payment**.
2. Press *This bill is due on…* under the row's dates.
3. Pick **The day it is due**.
4. Type the clause number and a few of its words.
5. Read the box. It says what the bill read before, and what the day makes it.
6. Press {{button:blue|Save this bill's due day}}.
:::

:::example What the box says
By this job's own pay calendar it is due Dec 30.
**On its own day it is due Feb 15.**
:::

The row then reads **Due** on that day. The line under it reads *This bill's own day* with the clause number.

That day wins over the job's calendar and the customer's. Only that one bill reads it. The job's other bills read their calendar as before.

A date the customer named still wins the expected day. The bill's own day shows under it.

The app adds no usual lateness to a named date. The bill turns amber the day after it.

To change the day, press *Change this bill's day…* under the row's dates. To go back to the calendar, press {{button:outline|Clear this bill's own day}}.

## The cutoff, before a bill goes out

A bill that has not gone out yet shows its cutoff. You see it in five places.

- A row in **Ready to Bill** on the Pipeline reads *Send by Nov 30 to be due Dec 10. After that, Jan 10.*
- The **Ready to Bill** header shows the nearest cutoff, like *Next cutoff Nov 25 · 1 bill*.
- The Bill Customer window says what sending today makes the bill.
- A row in **Working** reads *Bill by Nov 30 to be due Dec 10. After that, Jan 10.* in the cutoff's last 10 days.
- The payment forecast opens with **Cutoffs coming**. See [read the payment forecast](/help/read-the-payment-forecast#cutoffs-coming).

The line is blue while the cutoff is far. It turns amber in the last 7 days. Press the first sentence on a row to open the calendar.

:::example One day decides a month
Send by Nov 30 to be due Dec 10. After that, Jan 10.
:::

The cutoff never stops a bill. It tells you what waiting costs.

## What it changes

Every bill that customer pays reads the calendar.

- A billed row on the Pipeline reads **Due** with the day the contract makes it due. See [see when a customer will pay](/help/see-when-a-customer-will-pay#when-the-payer-pays-on-a-calendar).
- The line under the row says when their money usually lands.
- The payment forecast puts the bill in the week their money usually lands, and shows its due day.
- The Lien desk weighs its deadlines against the day their money usually lands.
- **Money waiting** and the Dashboard's Accounts Receivable judge them by each bill's expected day. See [A customer on a pay calendar](/help/see-which-customers-pay-slowly#a-customer-on-a-pay-calendar).
- Quickfill's **Billed Awaiting Payment** calls their bill past due after its due day, not 30 days after it was billed.
- A development's **Money** look reads **Due** on their billed jobs. It counts a job past due after that day.

A customer with no calendar reads exactly as before. So does a job with **This job has no pay calendar** ticked.

One bill with a day of its own reads that day on every one of these screens. See [One bill due on a named date](#one-bill-due-on-a-named-date).

## Who can set one

Developers, master technicians, assistants and the controller set a pay calendar. A primary can open the window and read it.

An estimator cannot set one or read one. An estimator writes down the terms on a won bid, and the office sets the calendar. See [Pay terms an estimator read on a won bid](#pay-terms-an-estimator-read-on-a-won-bid).

## Remove one

Press {{button:outline|Remove the pay calendar}} in the window. Then confirm. Their bills go back to the usual guess.

## The rest of the money picture

- [See when a customer will pay](/help/see-when-a-customer-will-pay)
- [Read the payment forecast](/help/read-the-payment-forecast)
- [Know whether a customer keeps their word](/help/know-whether-a-customer-keeps-their-word)
