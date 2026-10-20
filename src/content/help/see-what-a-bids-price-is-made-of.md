---
title: see what a bid's price is made of
category: Office
roles: dev, master_technician, assistant, controller, estimator
keywords: pricing, workbench, breakdown, material, sales tax, tax free, equipment, labor, markup, kind, tags, by tag, by kind, split, expand all, collapse all, traditional breakdown, tag breakdown, kind breakdown, crew rate, what is left, margin
order: 95
---
A bid's price is one number per fixture. The Workbench can take it apart. Each row can show how much of its price is material and how much is sales tax. What is left is labor. Three cards under the table add the rows up.

## Open a row's split

Press the small arrow before a fixture's name. Three lines open under it.

- **Material** is the takeoff's parts, sold at the bid's markup.
- **Sales tax** is the bid's rate on that material.
- **Labor** is what is left of the price. It is never typed, so a row always adds up.

Each line has its cost per unit, its sale price per unit, its revenue, its profit and its margin. Press the arrow again to close it. **Expand all** and **Collapse all** sit under the Fixture header.

:::example a water closet at $1,500
Material $973.47 each, sold at +50% on $648.98 of parts. Sales tax $80.31. Labor $446.22, what is left. The three add to $1,500.00.
:::

## Type a row's own numbers

The dashed cells are the app's rule. Type over one and it goes solid.

- Type a per-unit **Material** price to replace the rule's number. Clear it to go back.
- Type a different markup in the row's **+ __ %** cell. It is that row's own. Clear it to go back to the bid's number.
- Press the tax words to make a row tax free, or taxed again.

The bid's own markup is the chip on the Traditional breakdown card's Material line. The company number lives in Settings → Bid Cover Letter Defaults. The bid's tax rate is the **Tax %** box on Takeoffs, or the Tax tool below.

## Set many rows at once

Beside **Margin ›** on the strip there are two more tools.

- **+% Markup ›** sets one markup on many rows at once. Pick every row, the rows still at the bid's number, a tag or a kind. The button says how many rows it will set. **Undo the last set** puts them back.
- **Tax ›** makes rows tax free or taxed the same way. Its **Taxed at __ %** cell is the bid's tax rate. Type the rate for that city and every taxed row follows.

## The three cards

Under the table, each card folds to one line. Press its title to open it.

- **Traditional breakdown** is material, sales tax, equipment and labor for the whole bid. Each line shows its cost, its price and its profit. With no hours on the Labor tab, the labor line reads **Labor and margin**. The two cannot be told apart yet. Open Labor once and the book fills the hours.
- **Kind breakdown** is fixtures, pipe, fittings, equipment and allowances. A row's kind is the chip under its name. The app guesses it from the name until you pick one. Equipment is the one pick that changes money. An equipment row is one item, never split.
- **Tag breakdown** is your own words. Press the **+** under a row's name, type a word and press Enter. A row can carry several. A row with two tags counts in both, and the card says so. Tags are never on paper.

## What the numbers mean

The Material line's profit is the markup on the parts. The Labor line's profit is what is left after the hours at the rate and the small costs. Driving, travel, permits and subs have no price of their own, so they sit inside labor. The bid line matches the strip above the table.

[Price a bid with the Workbench](/help/price-a-bid-with-the-workbench) covers the rest of the Workbench. [Read the margin breakdown for a bid line](/help/read-a-bid-lines-margin-breakdown) covers the ⓘ window.
