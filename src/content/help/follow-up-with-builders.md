---
title: follow up with builders on their bids
category: Office
roles: dev, master_technician, assistant, estimator, primary, superintendent
keywords: followup, builder review, call queue, submission, stale, snooze, PIA, quick log, call sheet, contact people, hit rate, pipeline
order: 69
---
The **Followup** tab (Bids → Followup) is where bid follow-up lives. It has two lenses — one job, two angles:

- **By builder** — the call queue. One card per builder, sorted so the builder you've ignored longest is on top. This is the lens for phone mornings: call one GC, walk through all their bids at once.
- **By status** — the outcome tables (Unsent, Not yet won or lost, Won, Started or Complete, Lost) with the per-person followup sheets, {{button:outline|Print}}/{{button:outline|PDF}}, and call scripts.

Flip between them with the {{button:blue|By builder}} / {{button:outline|By status}} toggle at the top. The **Stale after N days** box is shared — set it once and both lenses highlight the same bids in red.

## Work the queue

Each builder card shows the whole relationship at a glance: {{chip:green|7 won}} {{chip:red|9 lost}} {{chip:yellow|24 pending}} plus a **hit rate** chip (share of decided bids you won) and an **open $** chip (unsent + pending value). The builder's phone number is tappable right on the card, and **Contact people** with their numbers sit on the right.

Inside the card, every unsent and pending bid shows **when it last got an update** — red means it's past your stale threshold. That's your talking list for the call.

:::example run a call morning
Open **By builder**, and start at the top — that's whoever waited longest. Tap the number, go through their red bids one by one, then log the call (below). The card drops down the queue and the next builder is on top.
:::

## Log the call in one line

At the bottom of each card's bid list is a one-line composer: pick **Phone / Text / Email**, type what they said, and hit {{button:blue|Log for builder + 2 bids}}. One click writes the builder's contact log **and** stamps every check-marked bid above (pending bids are pre-checked). No more logging the same call three times.

## Snooze, PIA, and quiet builders

- {{button:outline|Snooze ▾}} on a card hides the builder from the queue until a wake date, with an optional note ("awarding after board mtg"). **The whole team sees it**, and the builder returns automatically. Snoozed builders wait in a block below the queue with a **Wake now** button.
- **PIA** still works like before — a permanent "stop asking" flag — and is now shared with the whole team too, on every device.
- Builders with **no bids yet** fold into a collapsed **Quiet builders** block at the bottom so the queue stays real.

## Print a call sheet

- {{button:outline|Call sheet}} on any card prints a one-pager: the builder's people and numbers, their open bids with last-update ages, and ruled space for call notes.
- {{button:outline|Print call sheet}} in the toolbar prints the **whole queue** in call order — the classic clipboard for a phone morning.
- The per-person followup sheets (pick a name, then {{button:outline|Print}} or {{button:outline|PDF}}) still live on the **By status** lens.

## Jumping between lenses

On **By status**, the small **↗** next to a GC/Builder name jumps to that builder's card on **By builder** — it flashes amber so you can't lose it. Going the other way, the {{icon:help|magnifier}} next to any bid on a builder card opens that bid on the status lens.
