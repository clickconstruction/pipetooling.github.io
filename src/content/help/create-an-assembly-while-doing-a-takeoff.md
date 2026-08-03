---
title: create an assembly while doing a takeoff
category: Office
roles: dev, master_technician, assistant, estimator
keywords: assembly, add assembly, save as assembly, takeoff, bundle price, nested assembly, items, parts search
order: 83
---
When a fixture needs an assembly that doesn't exist yet, you can create one without leaving **Bids → Takeoffs**. Two ways in:

- **Save as Assembly** under any fixture that already has part lines — the new assembly starts pre-loaded with those parts.
- **Add assembly** from a fixture's assembly picker when nothing matches your search.

Both open the same **Add Assembly** form. It also maintains the shared catalog, so anything you create here appears in Materials → Assembly Book too.

## Build the item list with one search

There's a single search box for items — it looks through **parts and assemblies at the same time**, with results grouped under those two headers. Parts show their manufacturer and part type; assemblies can be nested inside your new one.

**Picking a result adds it immediately** with a quantity of 1 — no type dropdown, no separate add button. The search clears and stays focused, so you can type the next item right away. Picking the same part again bumps its quantity instead of duplicating the row.

Each added item is one line: a {{chip:blue|P}} or {{chip:gray|A}} chip, the name, an editable quantity, a **Prices** link for parts, and an **×** to remove (mouse-only — tabbing skips it).

:::example nothing matches
Type a part name that isn't in the catalog and the last row of the results offers **+ Add "your search" as a new part…** — it opens the Add Part form with the name pre-filled, and the saved part drops straight into your item list.
:::

## Bundle prices

Optionally record what a supply house quotes for the **whole assembly** — one quote per house, entered with a searchable supply-house picker. Pressing **Enter** in the price field adds the row.

When you arrived via **Save as Assembly**, each bundle price also offers a **Use for takeoff** radio: pick one and saving replaces that fixture's individual part lines with a single bundle line at that price.

## Finish

{{button:blue|Save assembly}} creates the assembly (and its bundle prices) in the shared catalog. If you came from a fixture's assembly picker, the new assembly is applied to that fixture automatically.
