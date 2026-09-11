---
title: know whether a customer keeps their word
category: Billing & Money
roles: dev, master_technician, assistant, controller, primary
keywords: promise, promised date, kept, broken promise, late, their word, pay by, re-promised, payment promise, reliability, they said, tell us when, portal
---
When a customer says "we'll pay by the 25th," that sentence is now a record, not a memory. Every promised date is kept forever, and the app works out on its own whether the money came when they said it would.

## What counts as a promise

A promise is a date a customer named for paying a bill. It gets recorded in three places, and the office never has to remember a form for the first one:

- **The customer names the date themselves.** On their portal statement, once a bill is a week old, a strip under *Balance due* says **Can't pay today? Tell us when to expect it.** with three Fridays and a *Pick a date* option. One tap, no sign-in. It lands on the Billed row as {{chip:green|✓ Promised Sep 12 · customer}}.
- **They said…** on **Jobs → Pipeline → Billed Awaiting Payment**, the link under a row's expected-pay chip. Pick the date, who said it (optional), and how — phone, text, email, in person. Call mode's "promised" outcome records one the same way (see *chase late payments with call mode*).
- **Recording a late payment.** When a payment lands two weeks or more after its bill and no promise is on the job, the *Mark paid* window asks **Did they promise a date for this?** Tap the day it came or one of the Fridays before it, or *No*. Answering writes the promise from memory while it is fresh; skipping is fine — nothing is guessed.

:::example Taking a promise on the phone
Tanya at Done Right says the cheque run is Friday. On the row, click {{chip:gray|They said…}}, pick Friday, type "Tanya, their office", tap **Phone**, save. The chip turns green with the date and the record has who said it.
:::

Each promise remembers who at the customer said it, who on our side heard it, and when. Changing the date on a row does **not** overwrite the old promise: the first one stays on record and the new one is a second promise on the same bill — the modal says so. Clearing a promised date takes it off the chip but keeps the promise in the record — it was still said.

## The one rule

The app never asks anyone whether a promise was kept. It reads the payments ledger and applies one rule, the same way every time:

:::example How a promise is judged
The customer promised **Friday, Sep 4** on a $250 bill.

- Paid by **Wed, Sep 9** (three business days of mail time after the promise): {{chip:green|kept}}.
- Paid **Sep 20**: {{chip:yellow|late by 16 days}}. The number of days is what we remember — it becomes that customer's usual slip.
- Still unpaid a week past the promise, or a new date was given for the same bill: {{chip:red|broken}}. A new date on the same bill always counts the old promise as broken, even if the money eventually arrives on the new date.
- A partial payment is never "kept." The promise was for the balance.
:::

Payments that landed before the promise was made count toward the balance — the promise is about what was still owed when it was said.

## What the record is for

Over time each customer builds a record: promises made, how many were kept, and how far past their word the money usually lands. That record is what tells you whether "we'll pay Friday" means Friday, and it is the honest basis for deciding whose word to plan around and whose to price for.

## Where this shows up

**Under the chip on every Billed row.** A small line reads the customer's record without anyone filling anything in:

- {{chip:gray|▂▅▃▇▂▁ Pays in 9–41d · keeps 3 of 7 · slips ~9d}} — the six bars are their last bills, days from bill to money (green at or under their usual, yellow up to half again, red beyond). **Pays in 9–41d** is their real range over the last year, from payments already recorded, so it is there from day one. **keeps 3 of 7** and **slips ~9d** appear once promises exist: how many promised dates they kept, and how many days after their word the money usually lands. Hover for the sources.
- Office roles see the whole line; primary sees the pay range only. A customer with fewer than two measured payments and no promises shows nothing — the row stays clean rather than pretending to a score.

**In the Payment forecast.** A promised bill is filed by the promise *plus* that customer's usual slip, and the row says "usually slips ~9d". A promise from a customer who runs nine days late lands in the week the money actually tends to arrive, while the chip still shows the date they gave.

Next: payment terms on the customer that follow them onto new bids and jobs.

## Who can do what

- **Record or clear a promise:** dev, master technician, assistant, controller. Customers record their own from the portal.
- **See promises and records:** the roles above plus primary.
- **"They never said that":** a promise can be voided by the roles that record them. Voiding hides it from the record; it is not deleted.
