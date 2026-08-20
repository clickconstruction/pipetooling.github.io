---
title: price a bid with the Workbench
category: Office
roles: dev, master_technician, assistant, controller, estimator
keywords: pricing, workbench, margin, target, solver, preview, apply, locked, pinned, unpriced, coverage
order: 94
---
The **Bids → Pricing** tab has two layouts, switched by the {{chip:gray|Old}} / {{chip:gray|New}} pills on the selected bid. Old is the classic grid; **New is the Workbench**, built for pricing to a target.

## Price to a number

1. Your **Revenue, Our cost, Profit, and Margin** stay pinned at the top — they move as you work.
2. Drag the **blended-margin slider** (or type a **target total** and press Enter) — the Workbench prices every row to hit it, spreading revenue in proportion to each row's cost.
3. **📌 pin** any row to hold its price while the rest re-solve. Fixed-price rows are always held, and rows with no Takeoffs cost are never auto-priced.

## Preview first, then Apply

Solver results (and your own typed prices) land as amber **preview** values — nothing is saved until you hit {{button:blue|Apply prices}}. **Discard** throws the preview away.

## Know where you stand

- The **coverage bar** counts what's still unpriced and can filter to just those rows.
- **Where the profit lives** shows profit by item and warns when most of it rides on one or two rows — the ones a GC's value-engineering pass goes after first.

:::example Working to a bid day number
You want this bid out the door at $42,000. Type 42000 in target total, Enter — every unpriced row fills, pinned rows hold, and the margin tile tells you what that number really earns.
:::
