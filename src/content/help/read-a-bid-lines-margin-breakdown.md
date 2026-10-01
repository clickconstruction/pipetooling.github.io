---
title: read the margin breakdown for a bid line
category: Office
roles: dev, master_technician, assistant, estimator
keywords: margin, breakdown, per unit, unit price, extended price, pricing tab, profit, sale price, materials, labor, tax
order: 81
---
On Bids → Pricing, the Margin/Total column shows each line's margin percentage. You click the number to open a breakdown of exactly how that margin was computed.

Margin is profit as a share of the sale price. The column is **Margin/Total** on **Bids → Pricing**.

## Open the breakdown

You click the underlined margin percentage on any Pricing row, for example {{chip:green|46.2%}}. You can also click the row's **Revenue** amount. Both open the same breakdown.

## What the modal shows

Every money line appears in two columns:

- **Per unit** is the figure for a single fixture or tie-in.
- **Total** is the same figure multiplied across the line's full count. The count is shown in the header, for example {{chip:gray|12 units}}.

From top to bottom:

1. **Revenue** is the Sale Price per unit and the extended total. Extended means multiplied by the count.
2. **Our cost** is Materials, Tax and Labor, with a costed subtotal. Materials comes from Takeoffs, or is proportional when no parts are assigned yet. Tax shows when the bid carries a tax rate.
3. **Profit** is Revenue minus Our cost, in both columns.
4. **Margin** is Profit ÷ Revenue. It sits in a colored band that matches the grid's flag colors. Green is 40% or better, yellow below 40%, red below 20%.

:::example a 12-count fixture
Sale Price $450.00 per unit → $5,400.00 total. Costs add to $214.50 per unit → $2,574.00 total. Profit is $235.50 per unit, and the band shows **52.3%** in green.
:::

## Special cases

- **Fixed-price lines** aren't multiplied by count. The Per unit column shows *—* for the Sale Price. A note explains the total is flat.
- **Count of 1** hides the Per unit column, since it would repeat the total.
- **No Takeoffs cost yet** shows an amber note. It warns that the figures only use costs entered so far. The real margin will be lower once the fixture's parts are added in Takeoffs.
