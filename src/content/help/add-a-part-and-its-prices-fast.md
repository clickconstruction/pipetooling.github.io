---
title: add a part and its prices fast
category: Office
roles: dev, master_technician, assistant, estimator
keywords: add part, new part, part type, supply house, prices, takeoffs, materials, parts book, keyboard, tab, save and add another, sold in, sticks, coil, box, minimum order, 20 ft
order: 82
---
The **Add Part** form is the same everywhere it appears — Bids → Takeoffs (from any part picker), the assembly modals, and Materials → Parts Book. It's built for keyboard-first entry so you can add a run of parts without touching the mouse.

## The fast flow

1. The **Name** field is focused as soon as the form opens — just start typing.
2. **Tab** to Manufacturer, then **Part Type** — click it (or press {{chip:gray|Enter}} / {{chip:gray|↓}}) and the box itself becomes a search field: type a few letters to filter, then Enter to pick.
3. Keep tabbing into **Prices**. Each price is one line: supply house, price, effective date. The supply house picker searches the same way as Part Type. The **effective date fills itself with today** the moment you pick a supply house or type a price — change it or clear it if the price is from an older quote.
4. **A blank price row is always waiting at the bottom.** The moment you fill anything in the last row, a fresh one appears below it — just keep tabbing and typing. Empty rows are ignored on save.
5. Press **Enter** anywhere (or click {{button:blue|Save}}) to save.

The **×** remove buttons are mouse-only — tabbing skips them so the keyboard path stays supply house → price → date → next row.

## Entering several parts in a row

Use {{button:outline-blue|Save & add another}}: the part saves, a "Saved" confirmation appears, and the form clears with the cursor back in Name for the next part. When you're done, save the last part with the regular {{button:blue|Save}} — in Takeoffs that final save also drops the part into whichever picker you started from.

:::example a takeoff session
You're building a takeoff and hit five parts that aren't in the catalog yet. Open Add Part once, enter the first four with **Save & add another**, then the fifth with **Save** — it lands selected in the picker, and all five are now in the catalog with their Ferguson prices.
:::

## Sold in: sticks, coils, boxes

Pipe is sold in sticks, not by the foot. **Sold in** on the form says how a part comes — `20` · **ft sticks**, `100` · **ft coils**, `10` · **per box** — so a takeoff that needs 105 ft knows it buys 120 ft.

- Most parts get it from their **Part Type**: a dev sets {{chip:purple|20 ft sticks}} once on *Copper pipe* in Settings → Catalogs → Material Part Types, and every copper part follows it. On the form the inherited number shows grey.
- Type a number to make one part different — a 10 ft stick, a 100 ft coil. Blank with no type means sold by the each, and nothing rounds.
- A takeoff line remembers the rule the day its part was picked, the way it remembers the price, so changing a part's rule later never re-costs a bid you already sent.

:::example Six entries cover the catalog
Copper pipe · 20 ft sticks. PVC DWV · 20 ft sticks. PEX · 100 ft coils. Black iron · 21 ft sticks. Fittings and fixtures stay by the each.
:::

## Notes

- **Part Type** is optional; leave it as "No part type" if none fits.
- **Effective date** defaults to today once a row has a supply house or price, but it's yours: pick another date, or clear it for "current price" — the app won't refill a date you cleared.
- When a supply house has a website on file, an **Open website** link appears under its price row for quick price checks.
