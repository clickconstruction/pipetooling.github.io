---
title: merge two copies of a part
category: Office
roles: dev, estimator
keywords: duplicate, duplicate materials, merge parts, same part twice, model number, parts book, clean up, keep this one, not the same part, also known as
order: 86
---
Sometimes the parts book holds one part twice. The two copies have different names, and each has its own prices.

You can merge them into one part. Nothing that points at either copy is lost.

## Open the page

Type **Duplicate materials** in the search at the top of the app, and press the result.

The page shows the copies in groups.

## Find the copies

Use the switch at the top of the page.

- **Same name** groups parts whose names match.
- **Same model number** groups parts that carry the same model number. The names can differ.

A model number is matched however it is typed. `Z8702-9B-PC` and `Z87029BPC` are one number.

Two sizes of one part are never grouped. A 3/4 valve and a 1/2 valve are two parts.

## Merge a group

1. Look at each part in the group. Pick the one that should stay.
2. Press {{button:blue|Keep this one}} on that row.
3. Read the window. It names both parts and says what moves.
4. Press **Merge the two parts**.

The other copy goes into the part you kept. These all move with it.

- Its prices from every supply house.
- The assemblies that use it.
- The takeoff lines on every bid.
- Its purchase order lines.
- Its house numbers.

A green line then says what now points at the part that stays.

:::example the same supply kit, twice
The book holds `AX8802XL-LR-PC ARLO SUPPLY KIT` and `ARLO AX8802XL LAV SUPPLY KIT`. You press **Keep this one** on the first. The second one's two assemblies and seven takeoff lines now point at the first.
:::

## When both copies have a price

Both copies may hold a price from the same supply house. The newer price stays.

The older price is still in the part's price history.

## The name you did not keep

The other name is saved in the part's notes, as *Also known as*. A search for the old name still finds the part.

## When two parts only look alike

Some parts share a model number and are still different parts.

Press **Not the same part** on the group. The group goes away, and it is not shown again.

## What cannot be merged

- A merge cannot be undone. Check the two parts first.
- A bid version that someone else locked stops the merge. The page says who holds the lock.
- Parts in two different service types are not merged.
