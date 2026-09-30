---
title: add a part and its prices fast
category: Office
roles: dev, master_technician, assistant, estimator
keywords: add part, new part, part type, supply house, prices, takeoffs, materials, parts book, keyboard, tab, save and add another, sold in, sticks, coil, box, minimum order, 20 ft
order: 82
---
The **Add Part** form is the same everywhere it appears. It is built for the keyboard, so you can add a run of parts without touching the mouse.

It opens from any part picker in Bids → Takeoffs, from the assembly modals, and from Materials → Parts Book. A takeoff is the list of parts a bid needs. A modal is a pop-up window.

## The fast flow

1. The **Name** field is focused as soon as the form opens. Just start typing.
2. **Tab** to Manufacturer, then to **Part Type**. Click it, or press {{chip:gray|Enter}} or {{chip:gray|↓}}. The box itself becomes a search field. Type a few letters to filter, then press Enter to pick.
3. Keep tabbing into **Prices**. Each price is one line: supply house, price, effective date. A supply house is the store you buy the part from. The supply house picker searches the same way as Part Type. The **effective date fills itself with today** the moment you pick a supply house or type a price. Change it or clear it if the price is from an older quote.
4. **A blank price row is always waiting at the bottom.** The moment you fill anything in the last row, a fresh one appears below it. Just keep tabbing and typing. Empty rows are ignored on save.
5. Press **Enter** anywhere, or click {{button:blue|Save}}, to save.

The **×** remove buttons are mouse-only. Tabbing skips them, so the keyboard path stays supply house → price → date → next row.

## Entering several parts in a row

Use {{button:outline-blue|Save & add another}}. The part saves and a "Saved" confirmation appears. The form clears with the cursor back in Name for the next part. When you are done, save the last part with the regular {{button:blue|Save}}. In Takeoffs that final save also drops the part into whichever picker you started from.

:::example a takeoff session
You're building a takeoff and hit five parts that aren't in the catalog yet. Open Add Part once, enter the first four with **Save & add another**, then the fifth with **Save** — it lands selected in the picker, and all five are now in the catalog with their Ferguson prices.
:::

## Sold in: sticks, coils, boxes

Pipe is sold in sticks, not by the foot. Some fittings only come in batches. **Sold in** on the form says how a part comes. You type the number and pick the unit. The units are `20` **ft sticks**, `100` **ft coils**, `5` **per pack** or `10` **per box**. With that rule, a takeoff that needs 105 ft knows it buys 120 ft. One that needs 13 nuts buys 15.

- Most parts get it from their **Part Type**. A dev sets {{chip:purple|20 ft sticks}} once on *Copper pipe* in Settings → Catalogs → Material Part Types. Every copper part follows it. On the form the inherited number shows grey.
- Type a number to make one part different, such as a 10 ft stick or a 100 ft coil. Blank with no type means sold by the each, and nothing rounds.
- A takeoff line remembers the rule the day its part was picked, the way it remembers the price. So changing a part's rule later never re-costs a bid you already sent.

:::example Six entries cover the catalog
Copper pipe · 20 ft sticks. PVC DWV · 20 ft sticks. PEX · 100 ft coils. Black iron · 21 ft sticks. Fittings and fixtures stay by the each.
:::

## Notes

- **Part Type** is optional. Leave it as "No part type" if none fits.
- **Effective date** defaults to today once a row has a supply house or price, but it is yours. Pick another date, or clear it for "current price". The app will not refill a date you cleared.
- When a supply house has a website on file, an **Open website** link appears under its price row. Use it for quick price checks.
