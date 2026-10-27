---
title: see what money is coming in this week
category: Office
roles: dev, master_technician, assistant, controller
keywords: money in, coming in this week, last week, still out, checks, drawer, deposits, pending, bank, Mercury, Stripe, payout, came back, returned check, expected payments, promise, pace, new date, write down their word
---
The Money in bar sits under the four money cards on your Dashboard. The bar answers what is coming in this week. The bar also shows what has not come in from last week.

## The closed bar

The bar stays one line until you press it. The line shows three numbers.

- **Came in** is the money that reached the bank or Stripe this week.
- **Still expected** is the money still on its way this week.
- **Last week still out** is the money last week expected that never came.

A {{chip:red|1 RETURNED}} pill shows when a check came back. Press anywhere on the bar to open it. Press **Close ▴** to fold it again. The bar remembers how you left it on this device.

## The week line

The open bar lays out the week by day. Each payment is a chip on the day it landed or should land.

- The amber **Last week** column on the left holds last week's money that never came.
- Today's column has a blue line across its top.
- Each day's total sits at the top right of its column.
- Saturday and Sunday share one quiet cell, since the banks are closed.

Every chip shows who pays, how much, and a small tag that says what kind of money it is. A chip that moved to today from an earlier day carries a *was Mon* tag.

## What the tags mean

- *✓ Landed* in green is money in the bank or in Stripe.
- *At the bank* is a deposit Mercury still holds as pending. The chip sits on the day it should post.
- *In the drawer* is a check typed in but not yet seen at the bank. Drawer checks wait on the shelf above the days.
- *They say it's sent* is a customer who said they paid. The chip sits on the day the money should arrive.
- *Their word* is a promise to pay by that day.
- *Pace · a guess* is a bill with no promise. The day comes from how fast that customer usually pays. The chip is dashed because the day is a guess.
- *Came back* in red is a check the bank returned. Red money never counts as landed.
- *Stripe payout* is card money moving from Stripe to the bank. The bar never adds the payout to a total, because the card payments already counted.

## Set a new day when they tell you

A chip tagged *Their word* or *Pace · a guess* is also the pen. Press the chip, or press **New date ›** under it. The **Write down their word** sheet opens and shows where the day stands now. Pick one of the quick days, or type a day in **Pay by**. Fill in who said it and how, then press {{button:green|Save promise}}.

The chip moves to the new day as *Their word*. A small tag like *was Thu, by pace* shows where it came from. Every date they name stays on the record. A new date counts the earlier promise as broken.

A chip at the bank, in the drawer or from Stripe takes no new day. Those days come from the bank or from Stripe.

## Open the screen behind a chip

Every chip is a door to the screen that holds it.

- **Open the job →** under a bill's chip opens the job.
- A deposit or a drawer check opens [Accounts Receivable](/accounts-receivable).
- A returned check opens its case at Accounts Receivable.
- The Stripe payout opens Banking for the roles that can see Banking.

## When a number looks wrong

The bar adds up only what other screens already hold. Fix the source, and the bar follows on your next visit.

- A check leaves the drawer once its deposit is matched at [Accounts Receivable](/accounts-receivable).
- A promise puts a chip on its day. Record one from the call sheet in [chase late payments with call mode](/help/chase-late-payments).
- A check typed in more than ten days ago leaves the drawer. Accounts Receivable lists it as never deposited.

When a source cannot be read, the line under the days names it. Everything else on the bar stays live.
