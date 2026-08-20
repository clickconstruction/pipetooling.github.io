---
title: see when a customer will pay
category: Office
roles: dev, master_technician, assistant, controller, primary
keywords: expected payment, pay speed, billed awaiting payment, accounts receivable, follow up, days to pay
---
Every row in **Jobs → Pipeline → Billed Awaiting Payment** now predicts its own payment date, so "when should we expect payment?" is answered on the board instead of in someone's head.

## Reading the chip

Each billed row carries a small chip under its buttons:

- {{chip:blue|Expect pay ~Sep 8 · pays in ~35d}} — on track. The date is the bill date plus this customer's usual pay speed: the **median** time between our bill going out and their payments landing, over the last 12 months.
- {{chip:red|12d past expected · pays in ~35d}} — the customer is now slower than **their own** history. This is the real follow-up signal: a 40-day-old bill is normal for a customer who pays in 45 days, and alarming for one who pays in 20.
- {{chip:gray|Expect pay ~Sep 10 · company avg}} — this customer doesn't have enough payment history yet (fewer than 3 measured payments), so the company-wide average fills in. Treat it as a rough guess, not their norm.

Hover any chip and it spells out the math.

:::example Answering "when do we get paid on 964?"
Find the row on Billed Awaiting Payment — the chip says {{chip:blue|Expect pay ~Sep 8 · pays in ~35d}}. Knight Contracting usually pays about 35 days after billing, the bill went out Aug 4, so early September is the honest answer. No one has to ask the office.
:::

## Where the speed number comes from

It's the same "pays in ~N days" stat the customer profile shows: only payments that are linked to a billed invoice count (a payment with no bill date can't be measured), and only the last 12 months, so a customer who cleaned up their act isn't haunted by old habits.

Jobs flagged for **Collections** keep their rows in the Collections section and don't get expectation chips — a job you've already flagged as hard to collect is past statistics.
