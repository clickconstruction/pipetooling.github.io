---
title: keep a supply house's number on a part
category: Office
roles: dev, master_technician, assistant, estimator
keywords: house number, item number, their number, sku, part number, supply house, parts book, prices, duplicate, price sheet, quote, catalog number
order: 83
---
Every supply house prints its own number for a part. You can keep that number on the part, so the part is found by it.

The name of a part changes from house to house. The number does not. A price sheet from that house will find the part by its number, with no search.

## Keep a number on one part

1. Open the part's prices. In **Materials → Parts Book**, open the part and press {{button:blue|Edit prices}}. In **Bids → Takeoffs**, press **Catalog prices** on a line.
2. Find **Their numbers** under the prices. There is a row for each supply house that prices the part.
3. Type the number as the house prints it. Press {{button:blue|Keep}}.

The number shows as a chip beside the house. Press **×** on a chip to take it off.

To keep a number for a house that has no price yet, pick it under **Another house…**.

:::example the same kit at two houses
Hillcrest Supply sells the Arlo supply kit as `512207`. Borden sells it as `77120-B`. You keep both on the one part. A sheet from either house now finds it.
:::

## One number means one part

A house uses a number for one part only. If you type a number the house already uses, the block names the other part.

Dashes and spaces do not matter. `77120-B` and `77120B` are the same number.

That message can mean the book holds the part twice. Check both parts before you go on.

## Keep the numbers you already typed

Many parts already carry a house's number at the start of the name, or in **Notes**.

1. In **Materials → Parts Book**, press {{button:gray|House numbers}}.
2. Read the list under **Found in names and notes**. Each row shows the number, the supply house and the part.
3. Press **Not a house's number** on any row that is wrong.
4. Press {{button:blue|Keep 12 numbers}}. The button shows your own count.

A number is offered only when one supply house prices the part. That house is the one the number came from.

The rest are listed under **held**, each with its reason. Open a held part's prices and type the number beside the right house.

## What comes next

These numbers are the first thing the price sheet reader looks for. A row whose number is on file is ready to file with the rest, with no question of its own.
