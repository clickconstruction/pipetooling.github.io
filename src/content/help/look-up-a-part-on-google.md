---
title: look up a part on Google from the takeoff
category: Bids & Estimating
roles: dev, master_technician, assistant, estimator
keywords: takeoff, part, google, search, look up, magnifier, part number, spec, cut sheet, sheet, one at a time, assembly
order: 88
---
Every part line on **Bids → Takeoffs** ends with a small magnifier {{icon:search}}. Click it and a new browser tab opens with a Google search for that part's name, exactly as it is written on the line. The takeoff stays where it was; nothing on the bid changes.

## Where the icon is

- **Inside an assembly** — at the end of each part's name, on the same line as the text. A long name that wraps carries the icon down with its last word.
- **On a single part line** — at the right end of the name box, once a part is picked. While you are typing in the box to pick a part, the icon steps aside.
- **One at a time** and **Sheet** both have it; fixtures and assembly names do not, since those are your own labels.

## What gets searched

The whole name, as written: `MCGUIR 2165LK CP 1/2IPSX3/8OD LAV SUPPLY L PN: LF2165LK` searches for exactly that. Google is good at picking the maker and part number out of a supply-house description, so the first result is usually the maker's page or a cut sheet.

:::example Opening several at once
The icon is an ordinary link, so ⌘-click (Ctrl-click on Windows), middle-click or right-click → **Open in new tab** all work. Go down an assembly clicking each magnifier and you have one tab per part to check against the spec.
:::

## When there is no icon

A part line with no part picked yet has nothing to search, so it shows no icon. Pick the part first.
