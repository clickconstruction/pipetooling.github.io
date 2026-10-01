---
title: know whether a customer keeps their word
category: Billing & Money
roles: dev, master_technician, assistant, controller, primary
keywords: promise, promised date, kept, broken promise, late, their word, pay by, re-promised, payment promise, reliability, they said, tell us when, portal, never said that, wrong entry, take off the record, void
---
A customer says they will pay by the 25th. That sentence is now a record, not a memory.

Every promised date is kept forever. The app works out on its own whether the money came when they said it would.

## What counts as a promise

A promise is a date a customer named for paying a bill. It gets recorded in four places. The office never has to remember a form for the first one:

- **The customer names the date themselves.** On their portal statement, once a bill is a week old, a strip appears under *Balance due*. It says **Can't pay today? Tell us when to expect it.** It offers three Fridays and a *Pick a date* option. One tap, no sign-in. It lands on the Billed row as {{chip:green|✓ Promised Sep 12 · customer}}.
- **The Expected row** sits in the dates block at the bottom of a Billed row. That is **Jobs → Pipeline → Billed Awaiting Payment**. You click it. You pick the date and how they said it: phone, text, email, or in person. Who said it is optional. Call mode's "promised" outcome records one the same way. See *chase late payments with call mode*.
- **The word in GC Review.** A GC is the general contractor. The pay date on a GC's word or call sheet row goes on every bill that GC owes. You can untick some. See *run your GC statement round*.
- **Recording a late payment.** A payment may land two weeks or more after its bill with no promise on the job. Then the *Mark paid* window asks **Did they promise a date for this?** You tap the day it came, or one of the Fridays before it, or *No*. Answering writes the promise from memory while it is fresh. Skipping is fine. Nothing is guessed.

:::example Taking a promise on the phone
Tanya at Done Right says the cheque run is Friday. On the row, click *② Expected Sep 5 · 12d past* in the dates block, pick Friday, type "Tanya, their office", tap **Phone**, save. The row becomes *They said Fri* and the record has who said it.
:::

Each promise remembers who at the customer said it, who on our side heard it, and when. Changing the date on a row does **not** overwrite the old promise. The first one stays on record. The new one is a second promise on the same bill. The modal says so. Clearing a promised date takes it off the chip but keeps the promise in the record. It was still said.

## Taking a wrong promise off the record

A promise may be entered on the wrong bill, or with a date nobody gave. It should not count against the customer. You click the Expected row, or the They said row, on the Billed row. Under the form, **On record for this bill** lists every promise made on it. Each shows the day, who said it and how, who heard it, and the day it was written down.

:::example On record for this bill · 2 promises
**Oct 9 · on the board** — {{chip:red|never said that}}
Tanya, their office · by phone · heard by Robert · written Sep 28
**Sep 25** — {{chip:red|never said that}}
by text · heard by Taunya · written Sep 10
:::

- {{chip:red|never said that}} asks once, then takes that promise off the record. It stops counting for or against the customer.
- It may be the promise the board is showing. Then the date comes off the board too. The row goes back to the estimate. An older date is not put back.
- **Changed their mind is not "never said that".** When a customer moves the date, you save the new date. The earlier promise stays, and counts as broken. That is the record working.

## The one rule

The app never asks anyone whether a promise was kept. It reads the payments ledger and applies one rule, the same way every time:

:::example How a promise is judged
The customer promised **Friday, Sep 4** on a $250 bill.

- Paid by **Wed, Sep 9** (three business days of mail time after the promise): {{chip:green|kept}}.
- Paid **Sep 20**: {{chip:yellow|late by 16 days}}. The number of days is what we remember — it becomes that customer's usual slip.
- Still unpaid a week past the promise, or a new date was given for the same bill: {{chip:red|broken}}. A new date on the same bill always counts the old promise as broken, even if the money eventually arrives on the new date.
- A partial payment is never "kept." The promise was for the balance.
:::

Payments that landed before the promise was made count toward the balance. The promise is about what was still owed when it was said.

## What the record is for

Over time each customer builds a record. It holds promises made, how many were kept, and how far past their word the money usually lands. That record tells you whether "we'll pay Friday" means Friday. It is the honest basis for deciding whose word to plan around and whose to price for.

## Where this shows up

**Under the chip on every Billed row.** A small line reads the customer's record without anyone filling anything in:

- {{chip:gray|▂▅▃▇▂▁ Pays in 9–41d · keeps 3 of 7 · slips ~9d}} shows their record. The six bars are their last bills, days from bill to money. A bar is green at or under their usual. It is yellow up to half again. It is red beyond that. **Pays in 9–41d** is their real range over the last year. It comes from payments already recorded. So it is there from day one. **keeps 3 of 7** and **slips ~9d** appear once promises exist. They say how many promised dates they kept. They say how many days after their word the money usually lands. You hover for the sources.
- Office roles see the whole line. Primary sees the pay range only. A customer with fewer than two measured payments and no promises shows nothing. The row stays clean rather than pretending to a score.

**In the Payment forecast.** A promised bill is filed by the promise plus that customer's usual slip. The row says "usually slips ~9d". A promise from a customer who runs nine days late lands in the week the money actually tends to arrive. The chip still shows the date they gave.
- **The job's activity.** Every promise on record is a {{chip:green|They said}} line in the job's activity feed. The feed is the Pipeline row's box and the Job window. The line sits at the moment it was recorded, in order with the notes, reports and clock-ins around it. It shows the date with its year, who said it, how, who heard it, and the note. You take a promise off the record and its line leaves too.

## Deciding what to do about it

The record only has to be good enough to prompt a decision. The decision lives on the customer as **payment terms**. It follows them onto every screen where you might otherwise say yes by habit.

- **Set them** on the customer's Edit form. It is *Payment terms* under the standing discount. Or you set them from **Bids → Bid Board → Customer review**. There every customer now has *Pays in*, *Their word* and *Terms* columns and a {{chip:gray|set terms…}} link. Four choices, one note:
  - **Standard** means bill on completion and chase per the loop.
  - **Deposit required** means a deposit before work starts on new jobs and bids.
  - **No new work past an unpaid promise** means a warning while a promise is broken.
  - **Winding down** means finish open jobs and decline new ones.
- **See them** on **New Bid** and **New Job** the moment you pick the customer. You see {{chip:yellow|⚠ Deposit required before work starts · keeps 1 of 5 · slips ~23d}} in amber. Or you see {{chip:red|⛔ No new work — a payment promise is broken}} in red. Your note sits underneath. A {{button:outline|Terms}} button changes them right there. A customer on standard terms with a promise broken right now gets a quiet amber warning too. That is the whole point of the record.

:::example Working a difficult customer out of the book
Meadowbrook has kept one promise in five and slips about three weeks. On Customer review, click {{chip:gray|set terms…}}, choose **Winding down**, note "finish Cypress Bend, no Ph. 2 — Robert 9/11". The next time anyone opens New Bid for Meadowbrook, the red bar says so before a number is typed.
:::

**In the demand letter.** The Final Demand Desk's notice history lists every date the customer promised, in their words. A line reads *"Payment promised by Sep 12 — by the customer, in writing, from their statement page"*. So a broken promise is part of the paper trail.

## Who can do what

- **Record or clear a promise:** dev, master technician, assistant, controller. Customers record their own from the portal.
- **See promises and records:** the roles above plus primary.
- **Set payment terms:** dev, master technician, assistant, controller. Everyone who can open New Bid or New Job sees the bar.
- **"They never said that":** the roles that record a promise can take one off the record. It is hidden from the record, not deleted.
