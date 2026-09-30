---
title: create an assembly while doing a takeoff
category: Office
roles: dev, master_technician, assistant, estimator
keywords: assembly, add assembly, save as assembly, takeoff, bundle price, nested assembly, items, parts search
order: 83
---
When a fixture needs an assembly that does not exist yet, you can create one without leaving Bids → Takeoffs. An assembly is a saved bundle of parts.

There are two ways in:

- **Save as Assembly** sits under any fixture that already has part lines. The new assembly starts pre-loaded with those parts. Its name is filled in as the count name, a dash, and the project name. An example is **I-6 - MPH LIVSTE**. Edit it before saving if you want something else.
- **Add assembly** is in a fixture's assembly picker when nothing matches your search.

Both open the same **Add Assembly** form. It also maintains the shared catalog, so anything you create here appears in Materials → Assembly Book too.

{{gif:create-an-assembly-while-doing-a-takeoff.gif|Save as Assembly: the form opens pre-loaded with the fixture's parts. One search adds more. Save creates it in the shared book}}

## Build the item list with one search

There is a single search box for items. It looks through **parts and assemblies at the same time**, with results grouped under those two headers. Parts show their manufacturer and part type. Assemblies can be nested inside your new one.

**Picking a result adds it immediately** with a quantity of 1. There is no type dropdown and no separate add button. The search clears and stays focused, so you can type the next item right away. Picking the same part again bumps its quantity instead of duplicating the row.

Each added item is one line. It has a {{chip:blue|P}} or {{chip:gray|A}} chip, the name and an editable quantity. Parts also have a **Prices** link. An **×** removes the line. The **×** is mouse-only. Tabbing skips it.

:::example nothing matches
Type a part name that isn't in the catalog and the last row of the results offers **+ Add "your search" as a new part…** — it opens the Add Part form with the name pre-filled, and the saved part drops straight into your item list.
:::

## Bundle prices

You can record what a supply house quotes for the **whole assembly**. That is optional. It is one quote per house, entered with a searchable supply-house picker. Pressing **Enter** in the price field adds the row.

When you arrived via **Save as Assembly**, each bundle price also offers a **Use for takeoff** radio. Pick one and saving replaces that fixture's individual part lines with a single bundle line at that price.

Individual part lines work the same way. A line normally prices at the **lowest** supply house. The **Catalog prices** link under the price opens the part's price list. There every supply house row has a {{button:blue|Use}} button. Pick the house you are actually buying from, even when it is not the cheapest. The line switches to that price, marked **Bid override**. **Reset to catalog** snaps it back to the lowest.

## Finish

{{button:blue|Save assembly}} creates the assembly and its bundle prices in the shared catalog. If you came from a fixture's assembly picker, the new assembly is applied to that fixture automatically.

## Editing an assembly later

The **Edit Assembly** form works the same way. You reach it from a bundle line's breakdown or a By Stage mapping. One search over parts and assemblies sits at the top. Picking a result adds it to the assembly immediately at quantity 1. Adjust quantities right in the items list. Changes save when you leave the field. To change a bundle price, **click the price itself**, type the new number, and press Enter. Escape backs out without saving. The quick **Add Parts** dialog on a mapped assembly uses a searchable part picker too. It has the same create-a-part-on-the-spot option when nothing matches.
