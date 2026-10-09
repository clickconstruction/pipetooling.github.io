---
title: see which customers pay slowly
category: Office
roles: dev, master_technician, assistant, controller, primary
keywords: pay speeds, breakdown, money waiting, slowest first, by customer, data health, payments missing info, undated bills, billed after paid, add date, receipts, median, email this weekly
---
The pay-speeds breakdown shows who is behind the company's pay-speed medians. You open it from the Pay speeds strip under the payment forecast's buckets.

## The pay-speeds breakdown

The strip is a door. You click anywhere on the strip. The link at the strip's right end reads **See the breakdown ›**. A second view opens, showing *who* is behind those medians.

- **Three tiles** echo the strip: Company, Res and Comm.
- **Money waiting** lists every customer whose oldest open bill has waited past their own normal, slowest first. The bar on each row **is their open bills**. The bar has one piece per job, sized by dollars. Each piece is colored by how late that bill runs against what this customer usually does. Green is on pace and amber is over it. Red is at twice it or more. Gray means the bill has no date. The row's numbers say it in words: *164d waiting · usually ~35d · $21,850 open on 3 jobs*. **Click the row and each job they owe lists out**. Each job shows its own wait clock, billed date and dollars, and clicks through to the job. There is also a jump to their bills on the board. Customers paying like they usually do collapse into one quiet line at the bottom. The {{button:outline|✉ Email this weekly…}} button in its header sends this exact list by email. That email works the same way as the forecast email in [read the payment forecast](/help/read-the-payment-forecast#emailing-the-forecast). The button's window has **Send now** and **Schedule…** with **Repeat weekly**, **Preview** and **Email me a test**. The email carries a color legend and every customer's full bill breakdown. The breakdown gives the job, the full address with city, the dollars and the wait. The email rebuilds fresh at send time. The email lands on the recipient's **My email schedule** like the rest.
- ***By customer — slowest first*** ranks every customer by their median. The list shows their payment count and the open dollars riding on their speed. The top of this list is your follow-up list. Customers with *no measurable payment yet* sit muted at the bottom of the same list, with a ***—*** median. Those customers' forecasts run on the company median. The list says so instead of showing a made-up number.
- **Data health** is one quiet line under the tiles. The line says how much of the last year's money the math can actually measure, like *238 of 545 measurable (44%)*. Two amber counts show what the office can fix: *N payments missing info* and *N undated bills*. A payment missing info is not applied to a bill, or its bill has no date. You hover over any number and it says what to do about it.
- **Fixing the misses**: you click the Data health line and every payment lists out with its billed → paid dates. A {{chip:yellow|no bill}} chip means the payment isn't applied to any bill. You open the job to link it. {{chip:yellow|no bill date}} means the bill just needs its date. {{chip:yellow|billed after paid}} means the recorded date sits *after* the money arrived. So that date can't be right, and the math refuses it until it's corrected. Either date problem is fixed the same way. A dev or a leader taps **＋ add date** and types it as MM/DD/YY. The row turns measurable on the spot. The same quick fix works down the whole **Undated bills** backlog.
- **The receipts**: you click any customer row and their story unfolds in two halves. ***Owes now — by job*** lists each open bill with its wait clock and dollars, straight into the job. *Paid before — the payments behind the median* shows when they owe something now. Each payment is a row: a {{chip:green|+8}} pill, then *05/01–05/09*, then the job. That one means billed May 1, and the money hit May 9, eight days later. Tap a row to open its job. Green is at or under the company median. Amber is above it. Red is twice it or more. So one glance shows whether a median is built on steady habits or one slow outlier. A customer with none says why: *No invoice-linked payments in the last 12 months — nothing measurable yet.*

:::example Who's actually slow?
The Comm median says ~25d — but the breakdown shows that's Knight Contracting at ~25d with $16,893 open, while TF Harper runs ~44d with $2,918 open. One number was hiding two very different customers.
:::

## More on pay speed

- A median is explained in [see when a customer will pay](/help/see-when-a-customer-will-pay#reading-the-expected-row). Which payments count is in the same guide, under [Where the speed number comes from](/help/see-when-a-customer-will-pay#where-the-speed-number-comes-from).
- A payment counts only once it is on its bill. See [record payments so they count](/help/record-payments-so-they-count).
