---
title: see what pricing sees on takeoffs
category: Bids & Estimating
roles: dev, master_technician, assistant, estimator
keywords: sticks, order rounding, sold in, minimum order, 20 ft, takeoff, sheet, new 2, cost rail, what pricing sees, materials total, no takeoffs cost, needs a price, request quotes, copy from previous bid, book suggests
order: 86
---
**Sheet** on **Bids → Takeoffs** keeps the sheet you know. It adds a rail that explains what Pricing is about to work from.

The first time you open a bid on this device, a box appears. It asks **How do you want to cost this takeoff?** Click {{button:outline|Sheet}} or press **2** and it opens. Your pick is remembered, so the box does not come back. From then on bids open straight in the view you chose.

The {{chip:blue|Sheet}} pill switches any time. It sits at the right end of the title row, beside **Print**. {{chip:gray|One at a time}} is the guided pass. The classic Old tab retired in September 2026.

## The sheet

The sheet has the fixtures and the line editor the classic tab had. It adds two things.

- An empty fixture the takeoff book knows shows *book suggests* and the assembly's name. {{button:blue|Apply}} expands it into priced part lines.
- {{button:blue|Fill from book · N matches}} in the strip does every match at once.
- The **All**, **Uncosted** and **$0 price** chips filter the sheet. The strip's **Costed** and **$0 lines** tiles are shortcuts to the same filters.

## What Pricing sees

The materials total here is exactly the number the Workbench uses as this bid's cost.

An **alternate** is a group marked on the Counts tab. It is a section the customer wants priced with and without. When the bid carries one, an amber block under the total splits the number. It shows **Base**, then what the alternate adds, for example **+ Break room**, then the total with it. Every fixture in an alternate wears a small **ALT** mark on the sheet and in the unit-cost list.

When fixtures have no lines, the rail says so in red. Pricing shows those rows as **No Takeoffs cost**. **show** opens the unit cost of each fixture. A fixture with a $0 line is marked **incomplete**.

### Sticks are in the number

Some parts are sold in packs. Copper comes in {{chip:purple|20 ft}} sticks. PEX comes in 100 ft coils. A part like that is rounded up **once per bid**, across every fixture that uses it. A bid that needs 105 ft buys 120 ft. The 15 ft you will not use is in the materials total.

The strip's **Order rounding** tile says what the sticks add. Hover it to see how many parts round. A line whose part rounds wears the pack as a small chip beside its name. Hover the chip and it reads *105 ft needed on this bid → 120 ft (6 × 20 ft sticks)*.

The extra is spread over the fixtures that use the part, so the fixture costs still add up. The rule itself lives on the Part Type or the part. See [add a part and its prices fast](/help/add-a-part-and-its-prices-fast).

## Needs a price

Part lines at $0 are listed with their fixture. {{button:blue|Request quotes · N parts}} opens the same quote request the Pricing tab uses. It covers those fixtures, with the parts named in the note. Prices you pick from the replies land back on the lines.

## Copy fixtures from a previous bid

The rail looks at the fixtures that still have no lines. It lists up to three earlier bids that costed the same fixture names. Each one says how many fixtures it can fill. Pick one and {{button:outline|Copy N lines from B383}} fills only the uncosted fixtures.

Parts are **priced again at today's lowest catalog price**. The earlier bid's hand-typed prices are not carried.

:::example Matching by name
`WC-12` on this bid matches `WC-3` or `wc` on the earlier bid; `ft of 2in waste` matches on its whole name.
:::

## One at a time

{{button:outline|One at a time}} in the strip switches to the guided pass. It opens on the fixture you were on. That is the last row you clicked or edited. If you touched nothing, it is the row at the top of your screen.

Its **Sheet view** button brings you back here. The sheet scrolls to that fixture and flashes the row. The pills beside **Print** hop the same way.
