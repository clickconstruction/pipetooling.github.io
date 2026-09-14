---
title: price a takeoff in sticks
category: Bids & Estimating
roles: dev, master_technician, assistant, estimator
keywords: sticks, sold in, minimum order, order rounding, 20 ft, coil, box, materials to order, request quotes, refresh sold in, takeoff, copper, pvc, pex
order: 88
---
Pipe comes in sticks, not by the foot. When a takeoff needs 105 ft of 3/4" copper and the house sells 20 ft sticks, you buy 120 ft — and the bid should carry the 15 ft you will not use. Takeoffs do that once the parts say how they are sold.

## Say how a part is sold, once

Most of the catalog is covered by its **Part Types**: a dev sets {{chip:purple|20 ft sticks}} on *Copper pipe* in Settings → Catalogs → Material Part Types and every copper part follows it. Six entries cover a plumbing catalog — copper, PVC DWV, PEX coils, black iron, and the rest by the each. A part can be different on its own form (**Sold in** on Add Part / Edit Part, or in the part's **Prices** window from the sheet) — a 10 ft stick, a 100 ft coil. Blank means sold by the each, and nothing rounds.

## What the sheet does with it

- Each line whose part rounds wears the pack as a small chip beside the part name — {{chip:purple|20 ft}}. Hover it for *105 ft needed on this bid → 120 ft (6 × 20 ft sticks) · +15 ft extra*.
- The part is rounded **once per bid**, across every fixture that uses it, never per line. A line is per fixture; the bid multiplies by the count and sums before it rounds.
- The strip's **Order rounding** tile says what the sticks add on this bid, and it is already in **Materials** — the same number Pricing, the Labor tab and the Workbench show. The extra is spread over the fixtures that use the part, so the per-fixture costs still add up.

## Materials to order

On the **Sheet** view the rail carries **Materials to order · rounded to what the house sells**: one row per part with a rule — *3/4" Type L Copper · 105 → 120 ft · 6 × 20 ft · +$41* — most expensive rounding first, with the total under it. On **One at a time** the same list folds under the strip. {{button:outline-blue|Request quotes}} sends the **ordered** quantities, so the house prices what you will actually buy.

:::example A rough-in with three kinds of pipe
Copper 105 → 120 ft (+$41), 2" PVC 64 → 80 ft (+$34), PEX 210 → 300 ft (+$58). Order rounding reads +$133 on the strip, Materials already includes it, and the order list is the shopping list.
:::

## Bids costed before the rule

A line remembers the rule the day its part was picked, so a later change never re-costs a bid you sent. For an open bid costed before a rule existed — or after a Part Type's rule changed — tap **Refresh Sold in rules from the catalog** under the order list: every line re-reads its part's rule, the chips appear, and the strip moves. Lines already matching are left alone.
