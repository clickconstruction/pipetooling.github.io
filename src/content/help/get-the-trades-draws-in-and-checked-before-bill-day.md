---
title: get the trades' draws in and checked before bill day
category: Bids & Estimating
roles: dev, master_technician, controller
keywords: gc mode, bill day, from the trades, draw, draws, pay application, cut-off, gates, waiver, conditional waiver, unconditional waiver, nothing this period, ask for it, superintendent, walk, claims, we see, money
order: 101
---
Bill day is the 25th. Before it, each trade on a job we are building sends its pay application. From the trades shows who is in, who is not, and what is left before our bill can go.

From the trades is on the Money screen, for the money team.

## Open From the trades

1. Press {{button:outline|GC}} on the Bids page to open [GC projects](/gc).
2. Press {{chip:blue|Money}} above the projects.
3. On the **Bill day** card, press {{button:outline|From the trades}}.
4. Pick the job when more than one is being built.

Or press {{button:outline|Bill day · 3 of 7}} on a building job's card. The line under it gives the bill day and the cut-off. The line also counts the trades in and the gates clear.

{{button:outline|To the owner}} beside it goes back to what each job would ask the owner.

## What the top shows

:::example The top of From the trades
{{chip:red|Not in 3}} {{chip:yellow|Sent back 1}} {{chip:blue|Waiting on us 1}} {{chip:green|Approved 1}}
:::

- **The bar** shows the trades' draws by where they stand. A draw that is in counts at what it asked. A draw not in counts at what the schedule says it comes to by bill day.
- **To the owner** on the right is what we bill the owner, as it stands. Before bill day it comes from the forecast. On the day it comes from the draft.
- **The dates** under the bar run from the cut-off to the day the owner pays, with today among them. The dates are evenly spaced, so read the order.
- **The ring** counts the gates that are clear, out of seven. **Today** lists the first three still open, each with its own buttons.

Press **The dates in full** for each date with what happens on it. Press **the gates** under the ring for all seven.

## The seven gates

Our pay application can go when all seven are clear.

1. Every trade is in, or said it sends nothing this period.
2. Nothing is sent back.
3. Every claim is checked against the site.
4. The conditional waivers for this period are in.
5. The unconditional waivers for last period's payment are in.
6. No change order is billed before it is signed.
7. Last period's certificate and payment are in.

A first pay application on a job has no last period, so the last gate is clear.

## Ask a trade for its draw

1. Press {{button:blue|Ask for it}} on the trade's row. Or press {{button:blue|Ask the 3 not in}} under **Today** to ask each one.
2. Each ask is its own text, with their portal link last.
3. On a phone, press **Draft text** to open your Messages with the text in it. On a desk, press {{button:outline|Copy}} and send it from your phone.

Once the company number is linked, the same button sends the text from there. A trade with no portal link yet says so. Make its link in its company window first. See [share a trade partner its portal](/help/share-a-trade-partner-its-portal).

Their portal says when the next pay application is due and the bill it goes on. Press {{button:outline|Remind them}} on a draw we sent back. Press {{button:outline|Ask for the waiver}} when they still owe an unconditional waiver.

## When a trade sends nothing this period

1. Press {{button:outline|Nothing this period}} on its row.
2. Type who said it, like "Dana Kerr, by phone".
3. Press {{button:blue|Keep it}}.

The gates count it as in. If the trade sends a draw after all, press {{button:outline|Put it back}}. Only a dev can do either while Bill day is built.

## Check a draw against the site

Press {{button:outline|Open the lines}} on a draw waiting on us. Each line shows what they claim, what the superintendent saw and what the schedule says. A line under the claim shows its money at what we see, with the photo or note that says why.

Approve and send back happen in the Draws window. Press {{button:blue|Approve or send back in Draws}}, then see [pay a trade's draw](/help/pay-a-trades-draw).

The checked gate's button asks the job's superintendent to walk the claims. The text names the job and the day, and never a dollar. See [check the trades' claims on site](/help/check-the-trades-claims-on-site).

## Send our pay application

When every gate is clear on bill day, press {{button:blue|Send pay application 4}}. The button opens Bill the customer. See [bill the customer on a GC job](/help/bill-the-customer-on-a-gc-job).

The trades' pay applications are due 6 days before bill day, the cut-off, on every job. The money team changes it in Settings, under **Jobs & billing**, from 2 to 20 days.
