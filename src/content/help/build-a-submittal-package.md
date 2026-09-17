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

Tap {{button:outline|Drop a vendor PDF}} and give it the house's whole submittal PDF — the 31-page catalog is fine. It is stored once on the revision and appears above the table as a strip. Tap {{button:outline|Show the pages}} and every page draws as a thumbnail.

Then it is one tap per page: tap the page, then the row it belongs to. Rows still owing a sheet come first in amber; a row nobody quoted never appears. The page wears the row's tag; tap the chip's **×** to take it off. Tap a second page for the same row and it joins the sheet. A page you put on two rows reads {{chip:red|2 rows}} — a page prints under one tag only — with a *keep it for* button per row.

The footer counts as you go: *6 of 31 pages on rows · 25 not used*. If you would rather type, the row's {{button:outline|Edit}} still takes a page range.

:::example Six rows from one file
NWS's submittal PDF is 31 pages. Wendi drops it, taps Show the pages, and works down the amber list: page 1 and 2 onto WC-1, 3 onto the flush valve, 5 onto DWH-1, 8 onto FD-1, 12 onto HB-3. The footer reads *6 of 31 pages on rows · 25 not used*.
:::

## Done with a file

The dropped PDF is a working file, not a record — the record is the pages on rows. When you are done with it, tap {{button:outline|Done with this file}}: the pages on rows stay, the rest go, the file shrinks in storage, and every row still points at its sheet. No dialog; the strip collapses to the kept pages and a quiet line reads *25 pages let go · Sep 15 · drop the file again if you need one*. A file with nothing on rows offers {{button:outline|Remove this file}} instead. Taking a page off after Done does not bring the others back; drop the file again if you need one.

## Rebuild, or start a new revision

- {{button:outline|Rebuild rows from picks}} (on a draft): you changed picks on the compare, or added a tag to the schedule. Rows are rebuilt from today's picks; sheets, reasons and lead times carry wherever the product is unchanged.
- {{button:green|New revision}}: the GC sent rows back, or the products changed after a share. Every row carries into the new draft and a **Since Rev N** column says what changed — *product changed*, *status changed*, *reason added*, *now missing*, *new row* — or *carried*. An unshared draft you revise reads *superseded*. Only the newest revision can be revised; older ones stay as the record.

## Build the package

Tap {{button:outline|Build package}}. One PDF: a cover table on our letterhead — every row with its tag, specified and submitted product, status, reason, lead time, and the page its cut sheet starts on — then the sheets in tag order, each page stamped **TAG · STATUS** and footed with the product. Rows still owing a sheet read *to follow* on the cover. The package is stored on the revision and opens in a new tab; {{button:outline|Open package}} brings it back, {{button:outline|Rebuild package}} refreshes it after you edit rows or pages.

:::example Rev 3 on SpaceX
22 rows, 14 sheets attached. The cover runs two pages, so DWH-1's sheet reads *p. 3*; the package is 31 pages. Wendi downloads it and sends it her own way — Share, with the GC's decisions coming back onto the rows, is the next release.
:::

## Share it — the review room

When Rev N is ready, tap {{button:blue|Share}} beside New revision. The bid gets one **review room** link — the same link through every revision — and it is copied to your clipboard. Paste it into the email chain you are already in with the GC; they forward it to whoever reviews products for the customer, usually the architect or the designer. Anyone with the link can read the rows in plain words: which match the plans, which differ and why, and the package to download. Nothing about money, the builder's account or the supply houses is on that page.

- **Know the reviewer already?** Name them on Share (name, email, role) and they get a personal link too; the room recognises their email if they arrive through the forward instead. Tick **watching** for the GC's PM — they see everything and decide nothing.
- **Before it goes**, Share does two things for you: Done with this file on any vendor PDF you never trimmed, and a package rebuild so the room's download matches the rows.
- After Share the tab reads *Room link · shared Sep 16 · opened 9×* above the revision chips, with {{button:outline|Copy link}} and {{button:outline|Close the room}}. Everyone who identifies themselves on the page appears under it with a **deciding / watching** switch and a personal link; *+ 4 opens by people who did not say who they were* counts the rest.
- Sharing Rev N+1 later never mints a new link. The same address now shows the new revision; the earlier ones sit under it as the record.

:::example The link into the chain
Wendi taps Share on Rev 2, names Dana Whitfield (architect) from the email thread, ticks Logan at Structura as watching, and pastes the room link into her reply to the chain. Two days later the tab reads *opened 5×*, Dana under it as *identified via the room link*, and one open by someone who did not say.
:::

### The thread

Under the rows, the room has **On this submittal**: a reviewer or a watcher writes a question — about one tag or the whole revision — and it lands on your inbox as a customer waiting and on the tab's **Thread** panel. Nobody's question is a decision; the rows above are. Decisions and each shared revision post their own line, so the thread reads as the record: *Rev 2 is up* · *Dana Whitfield decided 3 rows · 2 revise · 1 reject* · *Dana asked about DWH-1* · your answer. Reply from the Thread panel: the room shows it as {{chip:blue|Click Plumbing}}, the person gets it by email with their own link, and the inbox request closes with your answer as the note. Five asks an hour per person is the limit.

## Read their decisions

On the room, a reviewer taps {{chip:green|Approve}}, {{chip:yellow|Revise}} or {{chip:red|Reject}} on each row that differs. The first tap asks once who they are — name, email, and whether they are the architect, the owner's rep, the designer or the builder — then {{button:outline|Send my review}} records every call with their name. Someone you marked **watching** can tap but not send.

Their calls land on your rows: a **Their call** column (the decision, who, when, their note) and a line above the table — *Their call: 19 approved · 2 revise · 1 rejected · by Dana W.* — with {{button:outline|Copy their decisions as text}} for a GC who keeps their own log. When rows came back marked Revise or Reject, a new door appears: {{button:green|Rev 3 from the 2 rows sent back}}, a draft carrying only those rows; the rest stand as approved on the revision they were approved on. Share Rev 3 and the same room link shows it.

:::example The flush valve, round two
Dana marks the flush valve Revise — "hold 1.0 gpf" — and everything else approved. The tab reads *Their call: 21 approved · 1 revise · by Dana Whitfield*. Wendi taps *Rev 3 from the 1 row sent back*, picks TET2UB31 on the compare, rebuilds the row, and shares. Dana's link now shows Rev 3 with one row, marked resubmitted.
:::


## A reviewer who marked up the PDF

Some architects never open the room — they redline the package or answer in the GC's email. Keep their file on the revision: {{button:outline|Drop a reviewer's file}} beside *Drop a vendor PDF* takes the redlined PDF or the forwarded email (.eml, .msg, .txt), and a blue card under the sheet strip lists it with {{button:outline|Open the file}}. Then type their calls onto the rows: {{button:outline|Edit}} on a row → **Their call · on behalf of a reviewer** → pick who it came from (or *a reviewer not on the room…* with a name and email), tap {{chip:green|Approved}} {{chip:yellow|Revise}} {{chip:red|Rejected}}, add their note, Save. The row reads *Revise · Dana Whitfield · entered by Wendi · Sep 17*, the decisions line counts *2 entered by Wendi*, the room's thread gets a quiet line (*from Dana's file, entered by the office · 1 row · 1 revise*) and Dana's trail counts it — but the room never shows the file or your name. Wrong row? Edit → *clear it* → Save.

:::example The same call, two ways
Dana taps **Revise** on the room → *Revise · Dana Whitfield · Sep 17*. Dana emails "hold the elongated bowl" → you enter it → *Revise · Dana Whitfield · entered by Wendi · Sep 17*. Both count as sent back; **Rev N+1 from the rows sent back** carries both.
:::

## Let the robot read it first

Three chores are reading, and the robot can do them — you confirm, it never sends or decides. **The schedule**: on a bid with no schedule the tab offers {{button:outline|Ask the robot to read the schedule}}; when it is back, the panel lists the tags it is sure of with a ✓ and the ones that *want a look* with a checkbox — {{button:green|Confirm 15 · leave 3}} puts the chosen tags on the schedule (the same rows *Plug in the fixture schedule* writes) and drops the rest. **A vendor PDF**: {{button:outline|Ask the robot to split this file}} on the file card; its guesses land on the page strip as dashed chips ({{chip:green|WC-1}} sure, {{chip:yellow|DWH-1?}} unsure) — tap one to put that page on the row as always, or {{button:green|Confirm 14 · pick 2}} to take every sure page at once. **A reviewer's redlines**: on their redlined PDF's card, {{button:outline|Ask the robot to read the redlines}}; the proposed calls list under the file — {{button:green|Confirm 6 · settle 2}} enters the sure ones on the rows as *read from Dana's file, confirmed by you*, the unsure ones wait for *Take the unsure ones too*, and each question the reviewer wrote posts to the thread for you to answer.

:::example What the robot is sure of
A tag printed on the sheet, a model number that matches a row, a stamp that says REVISE AND RESUBMIT — sure. A hand-written mark with no tag, a page that could be two sheets — it asks you to look, and never confirms itself.
:::

## What comes next

The Needs You cards, the won question, and the question thread on the room — each in its own release.
