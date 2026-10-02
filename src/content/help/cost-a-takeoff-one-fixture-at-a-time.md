---
title: cost a takeoff one fixture at a time
category: Bids & Estimating
roles: dev, master_technician, assistant, estimator
keywords: takeoff, one at a time, new 1, one fixture at a time, sheet, guided, book, remember, previous bid, same as, use these lines, done next, uncosted, coverage
order: 85
---
One at a time on Bids → Takeoffs walks a takeoff one fixture at a time. A takeoff is the list of fixtures counted from the plans.

The first time you open a bid on this device, a box appears. It asks **How do you want to cost this takeoff?** It shows a picture of each view. Click {{button:outline|One at a time}} or press **1** and it opens. Your pick is remembered, so the box does not come back. From then on bids open straight in the view you chose. The {{chip:blue|One at a time}} pill beside the bid name switches any time. {{chip:gray|Sheet}} is the whole sheet with the cost rail. The classic Old tab retired in September 2026. A device that had picked it opens One at a time.

## The strip

The top strip shows **Costed**, **Materials** and **$0 lines**. **Costed** is how many fixtures have part lines, with a bar. **Materials** is the same number Pricing uses as this bid's cost. **$0 lines** counts parts with no catalog price. {{button:blue|Fill from book · N matches}} fills every fixture the book recognizes in one go. The book is the takeoff book, the saved parts for each fixture name. {{button:outline|Sheet view}} hops to the Sheet, scrolled to the fixture you are on. The pills beside the bid name hop the same way, and the fixture follows you back.

## The rail

The rail lists every fixture on the bid, each with a dot. Green means costed. An amber ring means no lines yet. Red means it has a $0 line. Costed fixtures show their total. Uncosted ones show **book** when the takeoff book has an entry for them. Click any fixture, or use **↑ ↓** when you are not typing in a field.

## What a fixture usually gets

Above the lines, the cards answer "what did we put on this last time?":

- **Book** is the entry for this fixture in the selected takeoff book. {{button:blue|Apply}} expands its assembly, the bundle of parts, into priced part lines.
- **Previous bids** shows up to three bids that costed the same fixture. A won bid comes first. Each shows its line count, cost per unit, and when it went out. {{button:outline|Use these lines}} copies them onto this fixture, **re-priced at today's lowest catalog price**. The old bid's hand-typed prices are not carried.

:::example Names match without the plan tag
A row named `WC-12` matches the book's `wc` entry and finds previous bids' `WC-3`, `wc`, and `Wc 1` rows alike. Line-feet rows (`ft of 2in waste`) match on their whole name.
:::

## Lines on this bid

This is the same line editor as the sheet. You search parts, pick a catalog price or override it, set quantities, drag to reorder, and add an assembly.

## Done, and remember

Tick **Remember these lines for "wc"** to teach the book. The fixture's parts are saved as an assembly named *wc · book*. If that name is taken, a numbered sibling is made. Nothing is edited in place. The book gets an entry for the name. Or it gets the plan-tag form as an alias, another name for an entry it already has. The next bid's `WC-7` row will show the suggestion.

{{button:blue|Done · next uncosted}} saves the Remember choice and moves to the next fixture with no lines. **Enter** does the same when you are not typing and no button or dialog has the focus. Enter on a focused button presses that button. {{button:outline|Skip}} moves down one without remembering.
