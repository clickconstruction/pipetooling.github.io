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

## When the customer names a real date

Statistics stop mattering the moment someone gives you an actual answer. When a GC says "you're on the check run for the 25th," click **mark promised date…** under the row's chip and record it. The chip turns green — {{chip:green|✓ Promised Sep 25 · Malachi}} — showing the date *and who took the call*, so the next person with the question sees both.

- A promise **overrides** the estimate everywhere, including the forecast.
- If the promised date passes unpaid, the chip flips to {{chip:red|5d past promise · Malachi}} — now you're following up on their word, not a statistic.
- The same link becomes **edit promised date…** to change or clear it.

Anyone who can see the board sees promises; marking them is for dev, masters, and assistant-type roles.

## The payment forecast

The {{button:green|Forecast}} button at the top of the Pipeline (next to {{button:blue|New Job}} and {{button:outline-amber|Follow-ups}}) rolls every chip up into one view — the same view also opens from the {{button:outline|Payment forecast}} button on the Billed Awaiting Payment header and from the stage strip's hamburger menu: open dollars bucketed by expected payment date — **Past expected** (your follow-up queue, listed first in red), **This week**, **Next week**, and beyond. It reads two ways:

- **As a cash forecast** — "about $35k should land this week, $47k next week."
- **As a work list** — everything in Past expected is a customer running slower than their own norm; click any row to jump straight to that bill on the board.

Bills whose customers have no measurable history sit in **No pay history** at the end, so no money ever hides from the total.

The **Pay speeds** strip under the buckets gives the averages at a glance: the company-wide pay time next to the {{chip:blue|Res}} and {{chip:yellow|Comm}} averages, each with how many payments it's based on. Every row also wears its customer's Res/Comm tag — commercial GCs usually pay on check runs while homeowners pay on the spot, so the same "late by 10 days" reads very differently between the two.

## Emailing the forecast

The {{button:outline|✉ Email…}} button in the forecast's header sends this exact view as an email — the bucket totals, the pay-speeds line, and every bill with its expected date, past-expected follow-ups first. The email is built **fresh at send time**, so a Monday 7 AM email shows Monday's numbers.

- **Send now** emails a teammate immediately; **Schedule…** picks a date and time (Central), and **Repeat weekly** turns it into a standing subscription — the classic setup is Monday 7:00 AM, so the week's cash-in picture is in the inbox before the day starts.
- **Preview** opens the email in a new tab; **Email me a test** sends it to your own address first.
- Pending sends list at the bottom of the dialog with a **Cancel** each — cancelling a weekly send ends the chain.
- Recipients are office-capable teammates (dev, masters, assistant-type roles, and primary). Scheduled sends also appear on the recipient's {{icon:gear}} **Settings → Your account → My email schedule**.
- Every job in the email links back to the app, and the **Open the forecast** button lands right on this modal.

Sending is for dev, masters, and assistant-type roles — the same people who can share the Billed report.

## The pay-speeds breakdown

The strip is a door: click anywhere on it (**See the breakdown ›**) and a second view opens showing *who* is behind those averages.

- **Three tiles** echo the strip — Company, Res, Comm.
- **Where customers land** — a chart of every customer with open billed money and enough history. Two ways to look at it, switched with pills: **Every customer a dot** puts each customer on a days axis (bigger dot = more open dollars, so a slow customer holding big money jumps out; the dashed line is the company median), and **Count by speed bucket** counts how many customers pay at each speed.
- **By customer — slowest first** — every customer ranked by their median, with their payment count and the open dollars riding on their speed. The top of this list is your follow-up list.
- **Thin history** — customers with under 3 measured payments sit in their own muted tier, because their forecasts run on the company median; the breakdown says so instead of showing a made-up number.
- **Data health** — one quiet line under the tiles says how much of the last year's money the math can actually measure ("238 of 545 payments measurable"), with amber counts for the two things the office can fix: payments not applied to a bill, and bills with no date. Hover any number and it says what to do about it. The **+ Weekly hygiene task** link turns the worklist into a recurring checklist task — you pick who does it and when.
- **Fixing the misses** — click the Data health line and every payment lists out with its billed → paid dates. A {{chip:yellow|no bill}} chip means the payment isn't applied to any bill (open the job to link it); {{chip:yellow|no bill date}} means the bill just needs its date — tap **＋ add date**, type it as MM/DD/YY, and the row turns measurable on the spot. The same quick fix works down the whole **Undated bills** backlog.
- **The receipts** — click any customer row and the payments behind their number unfold: {{chip:green|+8 05/01–05/09}} means billed May 1, money hit May 9, eight days. Green is at or under the company median, amber is above it, red is twice it or more — so one glance shows whether a median is built on steady habits or one slow outlier. Customers with no chips say why: no payments linked to a billed invoice in the last 12 months.

:::example Who's actually slow?
The Comm average says ~25d — but the breakdown shows that's Knight Contracting at ~25d with $16,893 open, while TF Harper runs ~44d with $2,918 open. One number was hiding two very different customers.
:::

## Recording payments so they count

A payment only teaches the system when it's applied to a bill — that's where the bill-to-paid gap comes from. The Edit-Job payments table now helps that happen on its own:

- Type an amount on a new payment line and, when the job has exactly **one** open bill, **Applies to** fills itself in. You can still switch it back to {{chip:gray|Job (unassigned)}} if the money really isn't for that bill.
- A real payment left unapplied on a job that *has* open bills wears a small ⚠ note until someone picks the bill — an unapplied payment can't pay a bill down or feed the customer's speed.
- A paid date **earlier** than the bill's own date gets a red ⚠ — money can't arrive before the bill goes out, so that's almost always a typo'd date.

## Where the speed number comes from

It's the same "pays in ~N days" stat the customer profile shows: only payments that are linked to a billed invoice count (a payment with no bill date can't be measured), and only the last 12 months, so a customer who cleaned up their act isn't haunted by old habits.

Jobs flagged for **Collections** keep their rows in the Collections section and don't get expectation chips — a job you've already flagged as hard to collect is past statistics.
