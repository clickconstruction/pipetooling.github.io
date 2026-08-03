---
title: add a part and its prices fast
category: Office
roles: dev, master_technician, assistant, estimator
keywords: add part, new part, part type, supply house, prices, takeoffs, materials, parts book, keyboard, tab, save and add another
order: 82
---
The **Add Part** form is the same everywhere it appears — Bids → Takeoffs (from any part picker), the assembly modals, and Materials → Parts Book. It's built for keyboard-first entry so you can add a run of parts without touching the mouse.

## The fast flow

1. The **Name** field is focused as soon as the form opens — just start typing.
2. **Tab** to Manufacturer, then **Part Type** — click it (or press {{chip:gray|Enter}} / {{chip:gray|↓}}) and the box itself becomes a search field: type a few letters to filter, then Enter to pick.
3. Keep tabbing into **Prices**. Each price is one line: supply house, price, effective date. The supply house picker searches the same way as Part Type.
4. **A blank price row is always waiting at the bottom.** The moment you fill anything in the last row, a fresh one appears below it — just keep tabbing and typing. Empty rows are ignored on save.
5. Press **Enter** anywhere (or click {{button:blue|Save}}) to save.

The **×** remove buttons are mouse-only — tabbing skips them so the keyboard path stays supply house → price → date → next row.

## Entering several parts in a row

Use {{button:outline-blue|Save & add another}}: the part saves, a "Saved" confirmation appears, and the form clears with the cursor back in Name for the next part. When you're done, save the last part with the regular {{button:blue|Save}} — in Takeoffs that final save also drops the part into whichever picker you started from.

:::example a takeoff session
You're building a takeoff and hit five parts that aren't in the catalog yet. Open Add Part once, enter the first four with **Save & add another**, then the fifth with **Save** — it lands selected in the picker, and all five are now in the catalog with their Ferguson prices.
:::

## Notes

- **Part Type** is optional; leave it as "No part type" if none fits.
- **Effective date** on a price is optional — leave it blank for "current price".
- When a supply house has a website on file, an **Open website** link appears under its price row for quick price checks.
