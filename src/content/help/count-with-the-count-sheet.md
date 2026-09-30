---
title: count with the Count Sheet
category: Office
roles: dev, master_technician, assistant, controller, estimator, superintendent
keywords: counts, count sheet, plan page, audit, quick add, fixtures, duplicate, merge, totals, line feet, ft, unscaled, px, export, clear all, group, by group, alternate, with and without
order: 95
---
The **Bids → Counts** tab opens a selected bid straight onto the **Count Sheet**, built for checking your count against the drawings. (The classic Old table and the Old / New pills retired in September 2026 — everything it did lives on the sheet.)

Before you even pick a bid, the list leads each row with a subtle number — **how many fixtures and tie-ins are counted** on that bid. A dim **—** means nothing's counted yet, so "which bids still need counting" is answered before anyone clicks; hover the number for the long form.

## Read it like an audit

- The strip up top totals **Items**, then **Counts** (rows counted each — fixtures, tie-ins, fittings) and **Line feet** (rows measured in feet — the takeoff's `ft of …` line types) **separately**, so 12 water closets never get added to 148 ft of copper. The **Plan pages cited** tile shows how many plan pages the count cites and, in red, how many rows have **no plan page** — `1 (4 no pages)` — click it to see just those rows, click again to show all.
- Every row has a **unit** beside its count — **ea** (faint until you hover), **ft**, **sq ft**, or **px**. It follows the fixture name (`ft of …` is feet) until you pick one from the little dropdown; a picked unit sticks even if you rename the row. Lines copied from CountTooling without a scale come in as `px of …` — they get a red **Unscaled** tile and a red **px** tag: set the page scale in CountTooling and copy again rather than pricing pixels.

:::example What the strip says
Items 35 · Counts 1,122 ea · 29 items · Line feet 444.74 ft · 6 line types · Plan pages cited 1 (4 no pages) — the bid has 29 counted things and six pipe runs totalling 445 feet, and four rows still need a page.
:::
- Flip to **By plan page** and the sheet regroups under each page — "Plan page 26 — 13 items, 12 ea · 148.5 ft" — with a red **No plan page** bucket at the bottom to clean up before submitting.

- Flip to **By group** and the sheet regroups under each group — the ones CountTooling sent, or the ones you type in a row's Group cell — with **No group** between the base groups and the alternates.

## Alternates — priced with and without

A customer's plan set sometimes carries a section they call an **alternate**: they want the bid with it and without it. In CountTooling the estimator counts that section as a group and marks the group as an alternate; when the copy is imported here the group arrives as an alternate too. You can also mark one yourself: in **By group**, every group's heading carries an {{chip:yellow|Alternate}} switch — on, the heading turns amber and reads *Alternate: Break room · bid with and without*; off, the group is part of the base bid again.

- Every row in an alternate wears a small **ALT** mark beside its group, in every view.
- The strip gains an **Alternates** tile while any alternate holds a row.
- Under the sheet, the two numbers the customer asked for: **Base** (every row outside the alternates) and **+ Break room** (what that alternate adds), counts and feet kept apart as always.
- The same fixture can sit in the base and in an alternate — WC ×4 in Restroom A and WC ×1 in the Break room — and those are two rows on purpose. Quick add and a rename only call a row a duplicate when it is in the same group.

:::example One alternate on a bid
Base · 5 ea · 112.00 ft — + Break room · 1 ea · 48.50 ft. The customer's letter will say the base price, then what the break room adds — see [offer an alternate on a bid](?g=offer-an-alternate-on-a-bid).
:::

## The Reference grade chip — what this record can teach

Once a bid is **sent or decided**, its header grows a small **Reference grade** chip — the same {{chip:green|A}} / {{chip:yellow|B–D}} / {{chip:gray|X}} letter the Bid Board's robot icon wears on decided rows. It answers one question: how much can the robot estimators (and anyone studying our history) learn from this record?

- **A** — plans, a final value, takeoff rows, *and* priced rows: a full training reference.
- Below A, a quiet line names the one gap — *no priced rows — robots can't learn pricing from this bid*, *no takeoff rows…*, *no final value recorded…* — so the fix is obvious while the bid is still fresh.
- **X** means no plans link at all: nothing to rebuild the bid from.

Today's bids are tomorrow's training corpus — closing the named gap while you still remember the bid is the cheapest reference we'll ever add.

## Edit any line in place

Every value on the sheet is editable — tap a count, fixture name, or plan page, type, and **Enter** saves (**Esc** reverts). Renaming a row to a fixture that's already on the bid offers to **merge** instead — the counts combine onto the existing row — so one fixture name stays one row and the takeoff assignment never forks.

In List mode, drag the **⣿ handle** at the left of a row to reorder the sheet — the order every other tab reads.

Under the sheet, {{button:green|Export as .csv}} downloads the rows and {{button:outline|Clear all counts}} removes every row on the bid after you type the confirmation.

:::example Fixing a mis-paged row
In By plan page, a WC-1 sits under "No plan page". Type `2` in its page cell, Enter — the row hops up into "Plan page 2" and the red bucket shrinks by one.
:::

## Add counts heads-down

Quick add starts tucked away — click {{button:outline|+ Quick add}} to open the panel (the count box is focused and ready), and **Hide** to put it away when you're done. The panel's **Group** box offers the bid's groups (an alternate reads *· ALT*); pick one, type a new one, or leave it blank. In **By group**, every heading has its own {{button:outline|+ add here}}, which opens quick add with that group filled in.

Tap a fixture chip (from your service type's fixture list), set the count, press **Enter** — the row is added and the count box is focused for the next one. No mouse needed between rows. The **ea / ft** toggle next to the count follows the name you typed (`ft of 2in copper` flips it to ft); click it to pin a unit for that row.

If you type a fixture that's already on the bid, Add pauses and offers **Merge into existing (+N)** — one fixture name, one row, so the takeoff assignment never forks.

:::example Checking page 26
Flip to By plan page, find "Plan page 26", and read straight against the sheet: 13 items, 146 ea · 12 ft. Anything the drawing shows that the group doesn't have — add it right there with quick add.
:::
