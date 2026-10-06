---
title: see where you win and lose with a builder
category: Office
roles: dev
keywords: builder review, bid map, GC, won, lost, hit rate, map, geography
order: 72
---
Every GC/Builder card on **Bids → Builder Review** tells you how the relationship is actually going. The card also tells you where.

## The card tells the score

Each builder's card shows count chips for their bids: {{chip:green|4 won}} {{chip:red|7 lost}} {{chip:yellow|3 pending}}. No chips means no classified bids yet.

## The Bid map shows the geography

1. Click {{button:outline|Bid map}} on a builder's card. The button appears when the builder has at least one bid with an address.
2. The Map page opens focused on that builder. The page shows **only their bids**, each pin colored by outcome. Green is won and red is lost. Yellow is pending, which means sent but undecided.
3. The banner at the top keeps score: won, lost, pending and the **hit rate**. The hit rate is won ÷ decided. A bid sent to several GCs counts by **this builder's packet**. A packet is the bid as sent to one GC. If it was won with them, it counts as won. If it was lost with them, it counts as lost. Its pin takes that color too.

:::example Reading the map
A cluster of green in one part of town means that builder actually awards you there. A cluster of red means they're shopping you in that area — or you're not competitive there. Both are worth knowing before the next invite.
:::

## Tips

- The stage chips still work in focus mode. The chips are Unsent, Pending, Won, Started and Lost. You turn everything off but **Lost** to see only where you're losing.
- Unsent bids are hidden by default in focus mode. You toggle **Unsent** on to include them. Unsent bids show as gray pins.
- The **×** on the banner returns to the normal all-layers map.
- The focused view is a plain link, `/map?builder=…`. You copy it from the address bar to share it.
