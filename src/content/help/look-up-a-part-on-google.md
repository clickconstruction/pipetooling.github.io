---
title: look up a part on Google from the takeoff
category: Bids & Estimating
roles: dev, master_technician, assistant, estimator
keywords: takeoff, part, google, search, look up, magnifier, part number, spec, cut sheet, sheet, one at a time, assembly
order: 88
---
Every part line on the takeoff ends with a small magnifier. Click it and a new browser tab opens with a Google search for that part's name.

The lines live on **Bids → Takeoffs**. The magnifier is the {{icon:search}} icon. The search uses the part's name exactly as it is written on the line. The takeoff stays where it was. Nothing on the bid changes.

## Where the icon is

- **Inside an assembly**: at the end of each part's name, on the same line as the text. A long name that wraps carries the icon down with its last word.
- **On a single part line**: at the right end of the name box, once a part is picked. While you are typing in the box to pick a part, the icon steps aside.
- **One at a time** and **Sheet** both have it. Fixtures and assembly names do not, since those are your own labels.

## What gets searched

The whole name is searched, as written. `MCGUIR 2165LK CP 1/2IPSX3/8OD LAV SUPPLY L PN: LF2165LK` searches for exactly that. Google is good at picking the maker and part number out of a supply-house description. So the first result is usually the maker's page or a cut sheet. A cut sheet is the maker's spec page for the product.

:::example Opening several at once
The icon is an ordinary link, so ⌘-click (Ctrl-click on Windows), middle-click or right-click → **Open in new tab** all work. Go down an assembly clicking each magnifier and you have one tab per part to check against the spec.
:::

## When there is no icon

A part line with no part picked yet has nothing to search. So it shows no icon. Pick the part first.
