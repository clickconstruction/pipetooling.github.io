---
title: see where you win and lose with a builder
category: Office
roles: dev
keywords: builder review, bid map, GC, won, lost, hit rate, map, geography
order: 72
---
Every GC/Builder card on **Bids → Builder Review** now tells you how the relationship is actually going — and where.

## The card tells the score

Each builder's card shows count chips for their bids: {{chip:green|4 won}} {{chip:red|7 lost}} {{chip:yellow|3 pending}}. No chips means no classified bids yet.

## The Bid map shows the geography

1. Click {{button:secondary|Bid map}} on a builder's card (it appears when the builder has at least one bid with an address).
2. The Map page opens focused on that builder: **only their bids**, each pin colored by outcome — green = won, red = lost, yellow = pending (sent, undecided).
3. The banner at the top keeps score: won · lost · pending and the **hit rate** (won ÷ decided).

:::example Reading the map
A cluster of green in one part of town means that builder actually awards you there. A cluster of red means they're shopping you in that area — or you're not competitive there. Both are worth knowing before the next invite.
:::

## Tips

- The stage chips (Unsent / Pending / Won / Started / Lost) still work in focus mode — turn everything off but **Lost** to see only where you're losing.
- Unsent bids are hidden by default in focus mode; toggle **Unsent** on to include them (gray pins).
- The **×** on the banner returns to the normal all-layers map.
- The focused view is a plain link (`/map?builder=…`) — copy it from the address bar to share.
