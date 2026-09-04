---
title: cost a takeoff one fixture at a time
category: Bids & Estimating
roles: dev, master_technician, assistant, estimator
keywords: takeoff, new 1, one fixture at a time, guided, book, remember, previous bid, same as, use these lines, done next, uncosted, coverage
order: 85
---
**New 1** on **Bids → Takeoffs** walks a Combined takeoff one fixture at a time. Pick it with the {{chip:blue|New 1}} pill beside the bid name (the app remembers your pick on this device; {{chip:gray|Old}} is still the classic sheet).

## The strip

The top strip shows **Costed** (how many fixtures have part lines, with a bar), **Materials** (the same number Pricing uses as this bid's cost), and **$0 lines** (parts with no catalog price). {{button:blue|Fill from book · N matches}} fills every fixture the book recognizes in one go; {{button:outline|Sheet view}} hops to the New 2 sheet with the same fixture.

## The rail

Every fixture on the bid, with a dot: green = costed, amber ring = no lines yet, red = has a $0 line. Costed fixtures show their total; uncosted ones show **book** when the takeoff book has an entry for them. Click any fixture, or use **↑ ↓** when you are not typing in a field.

## What a fixture usually gets

Above the lines, the cards answer "what did we put on this last time?":

- **Book** — the entry for this fixture in the selected takeoff book. {{button:blue|Apply}} expands its assembly into priced part lines.
- **Previous bids** — up to three bids that costed the same fixture (a won bid comes first), each with its line count, cost per unit, and when it went out. {{button:outline|Use these lines}} copies them onto this fixture, **re-priced at today's lowest catalog price** — the old bid's hand-typed prices are not carried.

:::example Names match without the plan tag
A row named `WC-12` matches the book's `wc` entry and finds previous bids' `WC-3`, `wc`, and `Wc 1` rows alike. Line-feet rows (`ft of 2in waste`) match on their whole name.
:::

## Lines on this bid

The same line editor as Old: search parts, pick a catalog price or override it, set quantities, drag to reorder, add an assembly.

## Done, and remember

Tick **Remember these lines for "wc"** to teach the book: the fixture's parts are saved as an assembly named `wc · book` (a numbered sibling if that name is taken — nothing is edited in place) and the book gets an entry for the name, or the plan-tag form as an alias of an entry it already has. The next bid's `WC-7` row will show the suggestion.

{{button:blue|Done · next uncosted}} (or **Enter** when you are not typing) saves the Remember choice and moves to the next fixture with no lines. {{button:outline|Skip}} moves down one without remembering.

By Stage bids stay in Old; New 1 tells you so and offers the way back.
