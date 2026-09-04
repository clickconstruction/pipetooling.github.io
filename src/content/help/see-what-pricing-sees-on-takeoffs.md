---
title: see what pricing sees on takeoffs
category: Bids & Estimating
roles: dev, master_technician, assistant, estimator
keywords: takeoff, new 2, cost rail, what pricing sees, materials total, no takeoffs cost, needs a price, request quotes, copy from previous bid, book suggests
order: 86
---
**New 2** on **Bids → Takeoffs** keeps the sheet you know and adds a rail that explains what Pricing is about to work from. Pick it with the {{chip:blue|New 2}} pill beside the bid name.

## The sheet

The same fixtures and line editor as Old, with two additions:

- Every empty fixture the takeoff book recognizes shows **book suggests ‹assembly›** with an {{button:blue|Apply}} that expands it into priced part lines. {{button:blue|Fill from book · N matches}} in the strip does all of them at once.
- **All · Uncosted · $0 price** chips filter the sheet. The strip's **Costed** and **$0 lines** tiles are shortcuts to the same filters.

## What Pricing sees

The materials total here is exactly the number the Workbench uses as this bid's cost. When fixtures have no lines, the rail says so in red: Pricing shows those rows as **No Takeoffs cost**. **show** opens per-fixture unit costs; a fixture with a $0 line is marked **incomplete**.

## Needs a price

Part lines at $0 are listed with their fixture. {{button:blue|Request quotes · N parts}} opens the same quote request the Pricing tab uses, scoped to those fixtures with the parts named in the note; prices you pick from the replies land back on the lines.

## Copy fixtures from a previous bid

For the fixtures that still have no lines, the rail lists up to three earlier bids that costed the same fixture names, with how many they can fill. Pick one and {{button:outline|Copy N lines from B383}} fills only the uncosted fixtures. Parts are **re-priced at today's lowest catalog price**; the earlier bid's hand-typed prices are not carried.

:::example Matching by name
`WC-12` on this bid matches `WC-3` or `wc` on the earlier bid; `ft of 2in waste` matches on its whole name.
:::

## One at a time

{{button:outline|One at a time}} in the strip switches to New 1 for a guided pass, and New 1's **Sheet view** brings you back here.
