---
title: build a submittal package
category: Bids & Estimating
roles: dev, master_technician, assistant, controller, estimator
keywords: submittal, submittals, cut sheet, cut sheets, fixture schedule, specified, submitted, alternate, superseded, equal, design change, missing, accessory, revision, rev, package, vendor pdf, in lieu of, GC approval, product data
---
A submittal is the list of products you will install, one row per tag on the plan's fixture schedule, with the cut sheet for each — the GC approves it before anything is ordered. In PipeTooling the rows are not typed: they are **built from the picks** you already made on the Pricing compare, so the day you pick a house the submittal is half done.

## Where it lives

Bids → **Submittals** (the tab after Cover Letter; office and estimator roles). Pick a bid the way you do on Pricing. The tab is a lens on the product decisions: the specified product from the schedule, the submitted product from the picked quote line, the status against the schedule, the reason and lead time you gave at the pick, and the cut-sheet pages.

## Before you build: two things on Pricing

- **Plug in the fixture schedule** (Pricing → Supply house prices ▾ → Plug in the fixture schedule). Every row starts from a tag there. Without it, Rev 1 is accessories only.
- **Pick a house on the compare** for each part. A tag nobody picked reads {{chip:red|Missing}}; a picked line with no tag on the schedule becomes an {{chip:gray|Accessory}} row (carriers, stops, traps — the schedule leaves them to you).

## Build Rev 1

Open the bid on the Submittals tab and tap {{button:blue|Build Rev 1 from the picks}}. One row per tag, in tag order, then the accessories. Each row carries what Pricing knew: {{chip:green|As specified}}, {{chip:blue|Superseded}}, {{chip:blue|Equal}}, {{chip:yellow|Alternate}}, {{chip:red|Design change}}, {{chip:red|Missing}}, or {{chip:gray|Accessory}}; the reason and lead time from the pick; the house it came from.

Six tiles at the top say where you stand: rows, as specified, alternates (and how many still need a reason), design changes, missing, and **cut sheets in**.

:::example SpaceX, the way it should have gone
Wendi pastes the P002 schedule, picks NWS on the compare, and opens Submittals. Rev 1 builds 22 rows: 6 as specified, 1 superseded, 1 equal, 8 alternates (3 still owe a reason), 1 design change, 1 missing, 4 accessories. Nothing was retyped from the quote.
:::

## Fix a row

Tap {{button:outline|Edit}} on any row. The editor takes the status (your call on superseded, equal or a design change when the model numbers alone cannot tell), the reason chips and a note an alternate or a design change owes ({{chip:gray|Long lead time}} {{chip:gray|Discontinued}} {{chip:gray|In stock}} {{chip:gray|Or-equal clause}} {{chip:gray|Cost}} {{chip:gray|Other}}), the lead time ({{chip:gray|In stock}} {{chip:gray|1 wk}} {{chip:gray|2 wk}} {{chip:gray|4+ wk}}, or typed), and the cut sheet. A row that owes a reason reads **say why**; a row with no sheet reads **sheet needed**.

## Attach the cut sheets

Tap {{button:outline|Drop a vendor PDF}} and give it the house's whole submittal PDF. It is stored once on the revision and listed above the table with its page count. Then, on each row's {{button:outline|Edit}}, pick the file and type the pages that are that tag's sheet (*3-4*, *7*). The next release makes that a tap on a page strip instead of a typed range.

## Rebuild, or start a new revision

- {{button:outline|Rebuild rows from picks}} (on a draft): you changed picks on the compare, or added a tag to the schedule. Rows are rebuilt from today's picks; sheets, reasons and lead times carry wherever the product is unchanged.
- {{button:green|New revision}}: the GC sent rows back, or the products changed after a share. Every row carries into the new draft and a **Since Rev N** column says what changed — *product changed*, *status changed*, *reason added*, *now missing*, *new row* — or *carried*. An unshared draft you revise reads *superseded*. Only the newest revision can be revised; older ones stay as the record.

## Build the package

Tap {{button:outline|Build package}}. One PDF: a cover table on our letterhead — every row with its tag, specified and submitted product, status, reason, lead time, and the page its cut sheet starts on — then the sheets in tag order, each page stamped **TAG · STATUS** and footed with the product. Rows still owing a sheet read *to follow* on the cover. The package is stored on the revision and opens in a new tab; {{button:outline|Open package}} brings it back, {{button:outline|Rebuild package}} refreshes it after you edit rows or pages.

:::example Rev 3 on SpaceX
22 rows, 14 sheets attached. The cover runs two pages, so DWH-1's sheet reads *p. 3*; the package is 31 pages. Wendi downloads it and sends it her own way — Share, with the GC's decisions coming back onto the rows, is the next release.
:::

## What comes next

A page strip for the sheets (tap the pages instead of typing a range, and let unused pages go), sharing the package with the GC for decisions on rows, and the GC's portal — each in its own release.
