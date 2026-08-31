---
title: import a takeoff from CountTooling
category: Bids & Estimating
roles: dev, master_technician, assistant, controller, estimator
keywords: counttooling, import, takeoff, copy to tooling, counts, line feet, ft of, unscaled, px, view link, plans link
order: 96
---
CountTooling counts the drawings; ClickTooling prices them. The bridge is one clipboard copy — no retyping.

## Copy in CountTooling

In CountTooling, open the project and click {{button:blue|Copy to /Tooling}} in the sidebar, then pick **This Canvas Only**, **All Visible Canvases**, or **All Canvases**. CountTooling puts the whole takeoff on the clipboard as tab-separated rows — one per counter and one per line type — plus a **view link** back to the plans.

- Counters copy as a count: `WC · 12 · pages 1, 2`.
- Line types copy as feet: `ft of 2in Copper · 148.50 · pages 1, 2`.
- If a page has lines but no scale, CountTooling stops and asks you to **Set scale** first. If you choose **Export anyway**, those runs copy as `px of …` — pixel lengths, not feet.

## Paste in ClickTooling

Open the bid in **Bids → Counts** and click {{button:outline|Import from /Tooling}} (top-right, beside the ×). ClickTooling reads the clipboard and adds the rows straight onto the bid; if the browser won't share the clipboard, a paste box opens instead — paste and click **Import**.

The toast tells you what arrived: *Imported 35 rows: 29 counts (1,122 ea) · 6 line types (444.74 ft).* Each row lands with its unit set — counters as **ea**, line types as **ft**, unscaled runs as **px** — so the Count Sheet totals them apart without guessing. The view link is saved to the bid as its **CountTooling plans** link (the crosshair icon on the Bid Board), so anyone pricing it can open the marked-up drawings.

:::example Reading the result
Switch the Counts tab to {{chip:gray|New}} — the Count Sheet strip shows **Counts** and **Line feet** as separate totals, and each feet row carries a small **ft** tag. A red **Unscaled** tile means some runs came in as pixels: set the scale in CountTooling, copy again, and delete the `px of` rows.
:::

## Keep the names

Leave the `ft of …` prefix on imported rows. The labor and price books match count rows by name, so `ft of 2in Copper` is how those rows find their per-foot labor and pricing.
