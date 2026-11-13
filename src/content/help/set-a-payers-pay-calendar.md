---
title: set a payer's pay calendar
category: Billing & Money
roles: dev, master_technician, assistant, controller, primary
keywords: pay calendar, cutoff, pay day, due, due date, pay application, 10th of the month, contract terms, payer, general contractor, GC, pay when paid, net 30, expected payment
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

## When to leave it unset

Leave the calendar unset for a customer who pays some days after each bill. The app's usual guess is better for them.

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

On the Pipeline a job on its own calendar says so. Its row reads *This job's own* before the calendar's words. A job that was switched off reads *No pay calendar on this job*. Press either one to open the window on that job.

The customer's own window lists the jobs that do not follow it. Press a job there to open its calendar.

A job in a development offers one more tick, like *Also set on the other 12 jobs in Larkfield Commons*. Tick it to set them all at once. The button then names the count, like {{button:blue|Save for 13 jobs}}. A job that fails is named with its reason, and the rest are still saved.

To undo it, open the same window on the job and press {{button:outline|Follow Larkfield Construction again}}. The button carries the customer's own name.

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

A customer with no calendar reads exactly as before. So does a job with **This job has no pay calendar** ticked.

## Who can set one

Developers, master technicians, assistants and the controller set a pay calendar. A primary can open the window and read it.

## Remove one

Press {{button:outline|Remove the pay calendar}} in the window. Then confirm. Their bills go back to the usual guess.

## The rest of the money picture

- [See when a customer will pay](/help/see-when-a-customer-will-pay)
- [Read the payment forecast](/help/read-the-payment-forecast)
- [Know whether a customer keeps their word](/help/know-whether-a-customer-keeps-their-word)
