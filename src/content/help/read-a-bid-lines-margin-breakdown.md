---
title: read the margin breakdown for a bid line
category: Office
roles: dev, master_technician, assistant, estimator
keywords: margin, breakdown, per unit, unit price, extended price, pricing tab, profit, sale price, materials, labor, tax
order: 81
---
On **Bids → Pricing**, the **Margin/Total** column shows each line's margin percentage. The number is clickable — it opens a breakdown of exactly how that margin was computed.

## Open the breakdown

Click the underlined margin percentage on any Pricing row (for example {{chip:green|46.2%}}). You can also click the row's **Revenue** amount — both open the same breakdown.

## What the modal shows

Every money line appears in two columns:

- **Per unit** — the figure for a single fixture or tie-in.
- **Total** — the same figure multiplied across the line's full count (the count is shown in the header, e.g. {{chip:gray|12 units}}).

From top to bottom:

1. **Revenue** — the Sale Price per unit and the extended total.
2. **Our cost** — Materials (from Takeoffs, or proportional when no parts are assigned yet), Tax when the bid carries a tax rate, and Labor, with a costed subtotal.
3. **Profit** — Revenue minus Our cost, in both columns.
4. **Margin** — Profit ÷ Revenue, in a colored band that matches the grid's flag colors: green at 40% or better, yellow below 40%, red below 20%.

:::example a 12-count fixture
Sale Price $450.00 per unit → $5,400.00 total. Costs add to $214.50 per unit → $2,574.00 total. Profit is $235.50 per unit, and the band shows **52.3%** in green.
:::

## Special cases

- **Fixed-price lines** aren't multiplied by count — the Per unit column shows "—" for the Sale Price and a note explains the total is flat.
- **Count of 1** — the Per unit column is hidden, since it would repeat the total.
- **No Takeoffs cost yet** — an amber note warns that the figures only use costs entered so far, so the real margin will be lower once the fixture's parts are added in Takeoffs.
