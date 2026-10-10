---
title: close out a trade and close a GC job
category: Bids & Estimating
roles: dev
keywords: gc mode, closeout, close out, close the job, retainage, retainage release, final pay application, accept the work, punch list, final release of lien, unconditional waiver, trade partner
order: 103
---
At the end of a job we pay each trade back the retainage we held. You walk each trade through its last steps in the Closeout window, then close the job.

Each trade with a signed statement of work has a card there. Only devs see the window for now. Closeout with the customer is in Bill the customer. [Close out a GC job with the customer](/help/close-out-a-gc-job-with-the-customer) covers that side.

## Open Closeout

1. Press {{button:outline|GC}} on the Bids page to open [GC projects](/gc).
2. Press {{button:outline|Closeout}} on the card of a job we are building.

The top of the window says whether the customer has paid us our retainage. The window also shows what we hold on the trades and what we have paid back. It counts the trades closed out too.

## The six steps

Each trade's card lists its steps in order. A done step shows a check. The step up next is blue, and only that step has a button.

1. **Every line billed.** The trade bills its last work on a pay application in the [Draws](/help/pay-a-trades-draw) window.
2. **We accept the work.** Press {{button:blue|Accept the work}} once their punch list is done.
3. **Final pay application.** The trade asks for the retainage we hold. The application comes with a conditional final release of lien.
4. **The customer pays us ours.** We pay a trade 10 days after the customer pays our final pay application.
5. **Retainage paid.** Press {{button:blue|Approve the release}}, then {{button:blue|Mark paid}} when the payment goes out.
6. **Unconditional final release.** The trade signs it once we pay.

:::example A trade waiting on us to accept its work
**We accept the work** {{button:blue|Accept the work}} 2 punch items are not checked fixed yet.
:::

## Accept the work

Accept the work waits on the trade's punch list. Every item must be checked fixed first. The card says how many are not.

Press {{button:blue|Accept the work}} when the list is done. The window opens their final pay application next.

## Record a final pay application that came by email

1. Press {{button:outline|Their final pay application came by email}} on the trade's card.
2. Pick the day it runs to. Type who signed it and their title.
3. Paste its Drive link. A note shows when our office may not be able to open it.
4. Press {{button:blue|Record it}}.

The window works out what it asks for, the retainage we hold on the trade. Press {{button:outline|Final pay application}} to read it.

## Pay their retainage

Approve the release waits until 10 days after the customer pays our final pay application. Before then the card says the day it opens. The button also waits on the company's papers, like insurance that ran out.

1. Press {{button:blue|Approve the release}}.
2. Press {{button:blue|Mark paid}} when the payment goes out.
3. Press {{button:outline|Their final release came in}} when their unconditional final release of lien arrives.

Tick **Email the trade about what I press here** to email them when you mark it paid. The tick starts off, and it is the same one the Draws window has.

## Close the job

{{button:blue|Close the job}} waits until every trade is closed out. Our own crew must be done too, and the customer must have paid our retainage. Until then the window lists what is left.

Press {{button:blue|Close the job}} when nothing is left. The job moves to the closed jobs on the board.
