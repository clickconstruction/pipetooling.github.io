---
title: count with the Count Sheet
category: Office
roles: dev, master_technician, assistant, controller, estimator, superintendent
keywords: counts, count sheet, plan page, audit, quick add, fixtures, duplicate, merge, totals, line feet, ft, unscaled, px
order: 95
---
The **Bids → Counts** tab has two layouts, switched with the {{chip:gray|Old}} / {{chip:gray|New}} pills on the selected bid. Old is the classic table (drag to reorder, edit rows in place); **New is the Count Sheet**, built for checking your count against the drawings.

## Read it like an audit

- The strip up top totals **Items**, then **Counts** (rows counted each — fixtures, tie-ins, fittings) and **Line feet** (rows measured in feet — the takeoff's `ft of …` line types) **separately**, so 12 water closets never get added to 148 ft of copper. It also counts rows with **no plan page** (red — click the tile to see just those) and how many plan pages the count cites.
- A row measured in feet shows a small **ft** tag beside its count. Lines copied from CountTooling without a scale come in as `px of …` — they get a red **Unscaled** tile and a red **px** tag: set the page scale in CountTooling and copy again rather than pricing pixels.

:::example What the strip says
Items 35 · Counts 1,122 ea · 29 items · Line feet 444.74 ft · 6 line types · No plan page 4 · Plan pages cited 1 — the bid has 29 counted things and six pipe runs totalling 445 feet.
:::
- Flip to **By plan page** and the sheet regroups under each page — "Plan page 26 — 13 items, 12 ea · 148.5 ft" — with a red **No plan page** bucket at the bottom to clean up before submitting.

## Edit any line in place

Every value on the sheet is editable — tap a count, fixture name, or plan page, type, and **Enter** saves (**Esc** reverts). Renaming a row to a fixture that's already on the bid offers to **merge** instead — the counts combine onto the existing row — so one fixture name stays one row and the takeoff assignment never forks.

In List mode, drag the **⣿ handle** at the left of a row to reorder the sheet — same order as the Old view.

:::example Fixing a mis-paged row
In By plan page, a WC-1 sits under "No plan page". Type `2` in its page cell, Enter — the row hops up into "Plan page 2" and the red bucket shrinks by one.
:::

## Add counts heads-down

Quick add starts tucked away — click {{button:outline|+ Quick add}} to open the panel (the count box is focused and ready), and **Hide** to put it away when you're done.

Tap a fixture chip (from your service type's fixture list), set the count, press **Enter** — the row is added and the count box is focused for the next one. No mouse needed between rows.

If you type a fixture that's already on the bid, Add pauses and offers **Merge into existing (+N)** — one fixture name, one row, so the takeoff assignment never forks.

:::example Checking page 26
Flip to By plan page, find "Plan page 26", and read straight against the sheet: 13 items, 146 ea · 12 ft. Anything the drawing shows that the group doesn't have — add it right there with quick add.
:::
