---
title: price a bid with the Workbench
category: Office
roles: dev, master_technician, assistant, controller, estimator
keywords: pricing, workbench, margin, target, solver, preview, apply, locked, pinned, unpriced, coverage
order: 94
---
The **Bids → Pricing** tab has two layouts, switched by the {{chip:gray|Old}} / {{chip:gray|New}} pills on the selected bid. Old is the classic grid; **New is the Workbench**, built for pricing to a target.

New to it? Click the **?** beside the New pill for a guided tour — it spotlights each part of the Workbench in order, right on your bid.

## Versions, scenarios, and the star

The structure bar spells out the two levels: a **Version** has its own takeoff and counts (switch at the top of the page), and **price scenarios** inside it are different sell prices over the same counts. Clicking a scenario card just **views** it — the {{chip:green|★ Customer sees this}} scenario is what the Cover Letter, Share, and the bid value use, and it only changes when you press {{button:outline|☆ Make customer-facing…}} and confirm.

A scenario showing {{chip:yellow|No prices yet}} offers a one-click **copy prices from** your priced scenario, or price it with the solver. {{button:outline|+ Duplicate scenario}} clones the one you're viewing (the star stays put).

## Price from the book

The Workbench reads your price book directly. A **Book entry** column on every row shows the assigned entry (name · book price) — the book's price flows straight into the sale column — or an **assign…** search: type, pick, priced. Typing over a book price still works and becomes an override, exactly like the Old view.

Above the table, {{button:blue|Fill N matching from book}} assigns every unassigned row whose name **exactly** matches a book entry, in one click — the button counts the matches before you press it, so "Fill 0 matching" means the remaining rows need the per-row search. The line beside it names the book you're drawing from.

## Price to a number

1. Your **Revenue, Our cost, Profit, and Margin** stay pinned at the top — they move as you work.
2. Drag the **blended-margin slider** or type a **target bid total** and press Enter — both are for the whole bid, so revenue already sitting on no-cost rows counts toward them, and the note under the box shows exactly where the solve landed.
3. **📌 pin** any row to hold its price while the rest re-solve. Fixed-price rows are always held, and rows with no Takeoffs cost are never auto-priced — when they carry revenue anyway, an amber banner totals it and can filter to just those rows.

## Preview first, then Apply

Solver results (and your own typed prices) land as amber **preview** values — the summary bar names the scenario they belong to, and nothing is saved until you hit {{button:blue|Apply prices}}. **Discard** throws the preview away, and so does switching to another scenario — previews never follow you across.

## Know where you stand

- The **coverage bar** counts what's still unpriced and can filter to just those rows.
- **Where the profit lives** shows profit by item and warns when most of it rides on one or two rows — the ones a GC's value-engineering pass goes after first.

:::example Working to a bid day number
You want this bid out the door at $42,000. Type 42000 in target total, Enter — every unpriced row fills, pinned rows hold, and the margin tile tells you what that number really earns.
:::
