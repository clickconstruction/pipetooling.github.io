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

## What it changes today

Saving a calendar changes no date on the Pipeline yet. The window and the line under **Pays in** are the whole of it for now. The billed rows and the payment forecast read the calendar in a later release.

## Who can set one

Developers, master technicians, assistants and the controller set a pay calendar. A primary can open the window and read it.

## Remove one

Press {{button:outline|Remove the pay calendar}} in the window. Then confirm. Their bills go back to the usual guess.

## The rest of the money picture

- [See when a customer will pay](/help/see-when-a-customer-will-pay)
- [Read the payment forecast](/help/read-the-payment-forecast)
- [Know whether a customer keeps their word](/help/know-whether-a-customer-keeps-their-word)
