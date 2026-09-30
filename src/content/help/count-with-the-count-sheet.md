---
title: count with the Count Sheet
category: Office
roles: dev, master_technician, assistant, controller, estimator, superintendent
keywords: counts, count sheet, plan page, audit, quick add, fixtures, duplicate, merge, totals, line feet, ft, unscaled, px, export, clear all, group, by group, alternate, with and without
order: 95
---
The Bids → Counts tab opens a selected bid straight onto the Count Sheet. The sheet is built for checking your count against the drawings.

The classic Old table and the Old / New pills retired in September 2026. Everything they did lives on the sheet.

Before you even pick a bid, the list leads each row with a subtle number. It is **how many fixtures and tie-ins are counted** on that bid. A tie-in is where new pipe joins what is already there. A dim *—* means nothing is counted yet. So "which bids still need counting" is answered before anyone clicks. Hover the number for the long form.

## Read it like an audit

- The strip up top totals **Items** first. Then it totals **Counts** and **Line feet** **separately**. **Counts** are rows counted each: fixtures, tie-ins, fittings. **Line feet** are rows measured in feet, the takeoff's `ft of …` line types. So 12 water closets never get added to 148 ft of copper. The **Plan pages cited** tile shows how many plan pages the count cites. In red it shows how many rows have **no plan page**, like *1 (4 no pages)*. Click it to see just those rows. Click again to show all.
- Every row has a **unit** beside its count: **ea**, **ft**, **sq ft**, or **px**. **ea** is faint until you hover. The unit follows the fixture name, so `ft of …` is feet. That holds until you pick one from the little dropdown. A picked unit sticks even if you rename the row. Lines copied from CountTooling, the plan counting tool, without a scale come in as `px of …`. They get a red **Unscaled** tile and a red **px** tag. Set the page scale in CountTooling and copy again rather than pricing pixels.

:::example What the strip says
Items 35 · Counts 1,122 ea · 29 items · Line feet 444.74 ft · 6 line types · Plan pages cited 1 (4 no pages) — the bid has 29 counted things and six pipe runs totalling 445 feet, and four rows still need a page.
:::
- Flip to **By plan page** and the sheet regroups under each page. A heading reads like *Plan page 26 — 13 items, 12 ea · 148.5 ft*. A red **No plan page** bucket sits at the bottom to clean up before submitting.

- Flip to **By group** and the sheet regroups under each group. Groups are the ones CountTooling sent, or the ones you type in a row's Group cell. **No group** sits between the base groups and the alternates.

## Alternates — priced with and without

A customer's plan set sometimes carries a section they call an **alternate**. They want the bid with it and without it. In CountTooling the estimator counts that section as a group and marks the group as an alternate. When the copy is imported here the group arrives as an alternate too. You can also mark one yourself. In **By group**, every group's heading carries an {{chip:yellow|Alternate}} switch. On, the heading turns amber and reads *Alternate: Break room · bid with and without*. Off, the group is part of the base bid again.

- Every row in an alternate wears a small **ALT** mark beside its group, in every view.
- The strip gains an **Alternates** tile while any alternate holds a row.
- Under the sheet sit the two numbers the customer asked for. **Base** is every row outside the alternates. **+ Break room** is what that alternate adds. Counts and feet are kept apart as always.
- The same fixture can sit in the base and in an alternate. Say WC ×4 in Restroom A and WC ×1 in the Break room. Those are two rows on purpose. Quick add and a rename only call a row a duplicate when it is in the same group.

:::example One alternate on a bid
Base · 5 ea · 112.00 ft — + Break room · 1 ea · 48.50 ft. The customer's letter will say the base price, then what the break room adds — see [offer an alternate on a bid](?g=offer-an-alternate-on-a-bid).
:::

## The Reference grade chip — what this record can teach

Once a bid is **sent or decided**, its header grows a small **Reference grade** chip. It is the same {{chip:green|A}} / {{chip:yellow|B–D}} / {{chip:gray|X}} letter the Bid Board's robot icon wears on decided rows. It answers one question. How much can the robot estimators, and anyone studying our history, learn from this record?

- **A** means plans, a final value, takeoff rows, and priced rows. That is a full training reference.
- Below A, a quiet line names the one gap. It reads *no priced rows — robots can't learn pricing from this bid*, *no takeoff rows…* or *no final value recorded…*. So the fix is obvious while the bid is still fresh.
- **X** means no plans link at all. There is nothing to rebuild the bid from.

Today's bids are tomorrow's training corpus, the set of examples the robots learn from. Closing the named gap while you still remember the bid is the cheapest reference we will ever add.

## Edit any line in place

Every value on the sheet is editable. Tap a count, fixture name, or plan page, then type. **Enter** saves and **Esc** reverts. Renaming a row to a fixture that is already on the bid offers to **merge** instead. The counts combine onto the existing row. So one fixture name stays one row and the takeoff assignment never forks.

In List mode, drag the **⣿ handle** at the left of a row to reorder the sheet. That is the order every other tab reads.

Under the sheet, {{button:green|Export as .csv}} downloads the rows. {{button:outline|Clear all counts}} removes every row on the bid after you type the confirmation.

:::example Fixing a mis-paged row
In By plan page, a WC-1 sits under "No plan page". Type `2` in its page cell, Enter — the row hops up into "Plan page 2" and the red bucket shrinks by one.
:::

## Add counts heads-down

Quick add starts tucked away. Click {{button:outline|+ Quick add}} to open the panel. The count box is focused and ready. Click **Hide** to put it away when you are done. The panel's **Group** box offers the bid's groups. An alternate reads *· ALT*. Pick one, type a new one, or leave it blank. In **By group**, every heading has its own {{button:outline|+ add here}}. It opens quick add with that group filled in.

Tap a fixture chip and set the count. The chips come from your service type's fixture list. Press **Enter** and the row is added. The count box is focused for the next one. No mouse is needed between rows. The **ea / ft** toggle next to the count follows the name you typed. `ft of 2in copper` flips it to ft. Click the toggle to pin a unit for that row.

If you type a fixture that is already on the bid, Add pauses. It offers *Merge into existing (+N)*. One fixture name, one row, so the takeoff assignment never forks.

:::example Checking page 26
Flip to By plan page, find "Plan page 26", and read straight against the sheet: 13 items, 146 ea · 12 ft. Anything the drawing shows that the group doesn't have — add it right there with quick add.
:::
