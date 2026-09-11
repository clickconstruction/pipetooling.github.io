---
title: know whether a customer keeps their word
category: Billing & Money
roles: dev, master_technician, assistant, controller, primary
keywords: promise, promised date, kept, broken promise, late, their word, pay by, re-promised, payment promise, reliability
---
When a customer says "we'll pay by the 25th," that sentence is now a record, not a memory. Every promised date is kept forever, and the app works out on its own whether the money came when they said it would.

## What counts as a promise

A promise is a date a customer named for paying a bill. It gets recorded in one of these ways:

- On **Jobs → Pipeline → Billed Awaiting Payment**, the {{chip:gray|mark promised date…}} link under a row's expected-pay chip (see *see when a customer will pay*).
- In **call mode** (*chase late payments with call mode*), when a call ends with a "promised" outcome.

Each promise remembers who at the customer said it, who on our side heard it, and when. Changing the date on a row does **not** overwrite the old promise: the first one stays on record and the new one is a second promise on the same bill. Clearing a promised date takes it off the chip but keeps the promise in the record — it was still said.

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

For now the record is kept quietly. The next steps put it to work: a way for customers to name their own date from a past-due reminder, the record on every Billed row, and payment terms on the customer that follow them onto new bids and jobs. Each will appear here as it ships.

## Who can do what

- **Record or clear a promise:** dev, master technician, assistant, controller.
- **See promises and records:** the roles above plus primary.
- **"They never said that":** a promise can be voided by the roles that record them. Voiding hides it from the record; it is not deleted.
