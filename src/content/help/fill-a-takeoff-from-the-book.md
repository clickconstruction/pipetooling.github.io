---
title: fill a takeoff from the book
category: Bids & Estimating
roles: dev, master_technician, assistant, estimator
keywords: takeoff book, fill from book, combined, assemblies, part lines, apply matching, fixtures, uncosted
order: 84
---
The **Takeoff book** remembers which assembly a fixture usually gets. On **Bids → Takeoffs** it can now fill a Combined takeoff in one click: every fixture the book recognizes that has no part lines yet gets its assembly expanded into priced part lines.

## How a fixture matches

A book entry has a fixture name and any number of aliases. A count row matches an entry when its name is the same as the entry's name or one of its aliases — ignoring case, extra spaces, and a trailing plan tag. So an entry called **wc** matches rows named `WC`, `wc-12`, or `Wc 3`; an entry for **lav** matches `LAV-1`. Line-feet rows (`ft of 2in waste`) match on their whole name.

:::example What the button tells you
{{button:blue|Fill from book · 5 matches}} means five fixtures on this bid match an entry and have no lines yet. {{button:gray|Fill from book · 0 matches}} is greyed out; hover it to see why — every matching fixture already has lines, or nothing in this book matches these fixtures.
:::

## Fill

1. Pick the **Takeoff book** for the bid (the dropdown remembers your choice per bid).
2. Click {{button:blue|Fill from book · N matches}}.
3. Each matched fixture gets the entry's assemblies expanded into part lines, priced at the lowest catalog price for each part — the same lines **Add assembly → expand** would give you, one fixture at a time.

The line beside the button sums it up: *Filled 5 fixtures from the book (23 lines) · 2 without a catalog price.* Parts with no catalog price land at $0 with the red **No catalog price** tag so you can price them or request quotes.

Fixtures that already have lines are never touched. Clicking again after a fill adds nothing.

## Grow the book

Entries live in the **Takeoff book** section at the bottom of the tab: add a fixture name, its aliases, and the assembly it should get. The more names the book knows, the more of each new bid it fills before you start.

## By Stage bids

On a bid using **By Stage** materials, the same button still reads **Apply Matching Fixture Assemblies** and maps each entry's assembly and stage onto the fixture, exactly as before.
