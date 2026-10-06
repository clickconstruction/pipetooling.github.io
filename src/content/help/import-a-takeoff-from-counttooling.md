---
title: import a takeoff from CountTooling
category: Bids & Estimating
roles: dev, master_technician, assistant, controller, estimator
keywords: counttooling, import, takeoff, copy to tooling, counts, line feet, ft of, unscaled, px, view link, plans link, undo import, set scale, group, alternate, with and without, import again, review, update, missing, rename
order: 96
---
CountTooling counts the drawings and ClickTooling prices them. The bridge is one clipboard copy with no retyping.

A takeoff is the count of fixtures and pipe runs from the drawings.

## Copy in CountTooling

In CountTooling, open the project and click {{button:blue|Copy to /Tooling}} in the sidebar. Then pick **This Canvas Only**, **All Visible Canvases**, or **All Canvases**. CountTooling puts the whole takeoff on the clipboard as tab-separated rows. There is one row per counter and one per line type. It also adds a **view link** back to the plans.

- Counters copy as a count: *`WC · 12 · pages 1, 2`*.
- Line types copy as feet: *`ft of 2in Copper · 148.50 · pages 1, 2`*.
- If a page has lines but no scale, CountTooling stops and asks you to **Set scale** first. If you choose **Export anyway**, those runs copy as `px of …`. Those are pixel lengths, not feet.

## Paste in ClickTooling

Open the bid in **Bids → Counts** and click {{button:outline|Import from /Tooling}}. It sits top-right, beside the ×. ClickTooling reads the clipboard and adds the rows straight onto the bid. If the browser won't share the clipboard, a paste box opens instead. Paste and click **Import** once. The button reads *Importing…* until every row lands. The green toast carries an {{button:outline|Undo}} for ten seconds. Click it and the rows that import just added are removed. The plans link goes back to what it was. Nothing else is touched.

The toast tells you what arrived: *Imported 35 rows: 29 counts (1,122 ea) · 6 line types (444.74 ft).* Each row lands with its unit set. Counters land as **ea**, line types as **ft**, and unscaled runs as **px**. So the Count Sheet totals them apart without guessing. The view link is saved to the bid as its **CountTooling plans** link. That is the crosshair icon on the Bid Board. Anyone pricing it can open the marked-up drawings.

CountTooling's **groups** come along. A row copied as `[Restroom A] WC` lands as **WC** in the **Restroom A** group, the Group column. So the name still matches your labor and price books. CountTooling can mark a group as an **alternate**. That is the section a customer wants priced with and without. It arrives as one here. Its rows sit under `--- Alternate: Break room ---` in the copied text. The toast adds *· 1 alternate: Break room (1 ea · 48.5 ft)*. The Count Sheet shows it apart from the base bid. See [count with the Count Sheet](?g=count-with-the-count-sheet). A **Duct** or **Water sizing** block in the text is read as a schedule, not as counts. Those are CountTooling's schedules, including an alternate's own *`--- Alternate: <name> · Water sizing ---`*. Its rows never become fixtures.

:::example Reading the result
The Count Sheet strip shows **Counts** and **Line feet** as separate totals, and each feet row carries a small **ft** tag. A red **Unscaled** tile means some runs came in as pixels: set the scale in CountTooling, copy again, and delete the `px of` rows.
:::

## Import again after a change

Say the drawings change after you counted. Fix the count in CountTooling and copy again. Then click {{button:outline|Import from /Tooling}} on the same bid. Nothing is added twice. A review opens instead. It sorts the copy against the sheet into four piles.

- **Changed** is a row with the same name and group but a new count or page. It starts on {{button:blue|Update all}}. Update keeps every part and price on the row. Each line says so, like *6 parts · priced · stays*.
- **New** is a row in the copy that is not on the bid. It starts on {{button:blue|Add all}}.
- **Missing** is a row on the bid that is not in the copy. A copy of every sheet starts on {{button:outline|Remove all}}. A This Canvas Only copy starts on {{button:outline|Keep all}}. A line with parts says *lost on remove* in red.
- **Same** rows match exactly. They fold to one line.

Every row has its own tick. Untick a row to leave it alone. Only the field that moved is drawn, old to new. A count going up is green. A count going down is red.

A row that left and a row that arrived with the same count may be one row renamed. The review says *Looks like a rename*. Click {{button:outline|Same row, renamed}} to keep its parts and prices under the new name. The same offer appears for a row that moved to another group.

Click {{button:green|Apply 9 changes}} when the piles read right. The toast says what happened and carries {{button:outline|Undo}} for ten seconds. Undo puts the old values back. It removes what was added and restores what was removed. A restored row comes back without its parts.

:::example Copying again with nothing changed
The toast reads *All 31 rows match this bid exactly. Nothing to import.* and the sheet is untouched.
:::

## Then price the materials

You price the counts on **Takeoffs**. Each fixture gets its parts there, and each part gets a price. See [cost a takeoff one fixture at a time](?g=cost-a-takeoff-one-fixture-at-a-time).

## Keep the names

Leave the `ft of …` prefix on imported rows. The labor and price books match count rows by name. So `ft of 2in Copper` is how those rows find their per-foot labor and pricing.
