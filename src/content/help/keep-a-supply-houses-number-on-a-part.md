---
title: keep a supply house's number on a part
category: Office
roles: dev, master_technician, assistant, estimator
keywords: house number, item number, their number, sku, part number, supply house, parts book, prices, duplicate, price sheet, quote, catalog number, codes with no part, match a code, bill lines, this is it, not a part
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

## Match the codes on the bills

Every supply house bill is read line by line, and each line prints the house's code. The office can match those codes to parts in one place.

Press {{button:outline|Codes with no part}} on the Parts Book. The window lists every code no part answers to yet. The code with the most dollars behind it is first.

Each row shows the line as printed, how often it was bought and what was spent. **The book offers** shows a part when the book has one that fits.

:::steps

1. Press {{button:outline|This is it}} when the offered part is right.

2. Press *Pick a part* when it is not, or when nothing is offered. Type a few words and press the part.

3. Press *New part in the book* when the book has no such part. The Add Part form opens with the line's words as the name.

4. Press *Not a part* for a freight or a fee that prints a code.

5. Press *Later* to set a code aside until you open the window again.

:::

{{button:blue|Match 97 offered codes}} takes every sure offer at once. An offer is sure when the part was found by its manufacturer's number or by the same name. The press names any code it could not keep, with the reason, and goes on with the rest.

A matched code works on every bill, past and to come. See the result on [What we buy](/help/see-what-we-buy-from-supply-houses).

## What comes next

These numbers are the first thing the price sheet reader looks for. A row whose number is on file is ready to file with the rest, with no question of its own.
