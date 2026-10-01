---
title: price a takeoff in sticks
category: Bids & Estimating
roles: dev, master_technician, assistant, estimator
keywords: sticks, sold in, minimum order, order rounding, 20 ft, coil, box, pack, batch, nuts, materials to order, request quotes, refresh sold in, takeoff, copper, pvc, pex
order: 88
---
Pipe comes in sticks, not by the foot. A takeoff buys whole sticks, and the bid carries the pipe you will not use.

A takeoff is the parts list for a bid. Say it needs 105 ft of 3/4" copper. The house, the supply house, sells 20 ft sticks, so you buy 120 ft. The bid should carry the 15 ft you will not use. Takeoffs do that once the parts say how they are sold.

## Say how a part is sold, once

Most of the catalog is covered by its **Part Types**. A dev sets {{chip:purple|20 ft sticks}} on *Copper pipe* in Settings → Catalogs → Material Part Types. Every copper part then follows it. Six entries cover a plumbing catalog: copper, PVC DWV, PEX coils, black iron, and the rest by the each. PVC DWV is the white drain pipe. PEX is the flexible water tubing. A part can be different on its own form. You set **Sold in** on Add Part or Edit Part, or in the part's **Prices** window from the sheet. A 10 ft stick or a 100 ft coil are examples. Blank means sold by the each, and nothing rounds.

**It is not only pipe.** Anything the house will not split gets the same rule. A flare nut sold in fives reads `5` **per pack**. A box of 100 wax rings reads `100` **per box**. Thirteen nuts needed buys fifteen. The sheet prices the two you will not use the same way it prices the sticks.

{{gif:price-a-takeoff-in-sticks-1-part-type.gif|Settings → Catalogs → Manage Parts → Material Part Types. The Sold in pair on a type, and the rule as a chip in the list.}}

{{gif:price-a-takeoff-in-sticks-2-add-part.gif|Add Part: the same pair between Part Type and Notes. Grey when it comes from the type, a number to make this part different.}}

## What the sheet does with it

- Each line whose part rounds wears the pack as a small chip beside the part name, like {{chip:purple|20 ft}}. Hover it for *105 ft needed on this bid → 120 ft (6 × 20 ft sticks) · +15 ft extra*.
- The part is rounded **once per bid**, across every fixture that uses it, never per line. A line is per fixture. The bid multiplies by the count and sums before it rounds.
- The strip's **Order rounding** tile says what the sticks add on this bid. That extra is already in **Materials**. Pricing, the Labor tab and the Workbench show the same number. The extra is spread over the fixtures that use the part, so the per-fixture costs still add up.

{{gif:price-a-takeoff-in-sticks-3-sheet.gif|The Sheet view. The Order rounding tile on the strip and the 20 ft chip on a copper line. Materials to order on the rail.}}

{{gif:price-a-takeoff-in-sticks-5-line-chip.gif|A line whose part rounds. The chip beside the part name says the pack. Hover it for what this bid needs and buys.}}

## Materials to order

On the **Sheet** view the rail carries ***Materials to order · rounded to what the house sells***. It shows one row per part with a rule, most expensive rounding first, with the total under it. A row reads *3/4" Type L Copper · 105 → 120 ft · 6 × 20 ft · +$41*. On **One at a time** the same list folds under the strip. {{button:outline-blue|Request quotes}} sends the **ordered** quantities, so the house prices what you will actually buy.

{{gif:price-a-takeoff-in-sticks-4-order-list.gif|Materials to order. 91 → 100 ft of 3/4" copper is 5 sticks and $24.75 extra. The 2" PVC lands on an exact 4 sticks.}}

:::example A rough-in with three kinds of pipe
Copper 105 → 120 ft (+$41), 2" PVC 64 → 80 ft (+$34), PEX 210 → 300 ft (+$58). Order rounding reads +$133 on the strip, Materials already includes it, and the order list is the shopping list.
:::

## Bids costed before the rule

A line remembers the rule the day its part was picked. So a later change never re-costs a bid you sent. An open bid may have been costed before a rule existed, or before a Part Type's rule changed. For that bid, you tap **Refresh Sold in rules from the catalog** under the order list. Every line re-reads its part's rule, the chips appear, and the strip moves. Lines already matching are left alone.

{{gif:price-a-takeoff-in-sticks-6-part-prices.gif|The part's Prices window from the sheet shows the rule and its source. It edits the part's own rule without leaving the takeoff.}}
