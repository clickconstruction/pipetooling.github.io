---
title: build a submittal package
category: Bids & Estimating
roles: dev, master_technician, assistant, controller, estimator
keywords: procurement log, procurement, released, ordered, lead time, expected, required, float, order by, delivered, send update, submittal, submittals, walkthrough, tour, where you are, journey, next step, cut sheet, cut sheets, fixture schedule, specified, submitted, alternate, superseded, equal, design change, missing, accessory, revision, rev, package, vendor pdf, in lieu of, GC approval, product data
---
A submittal is the list of products you will install, one row per tag on the plan's fixture schedule, with the cut sheet for each — the GC approves it before anything is ordered. In PipeTooling the rows are not typed: they are **built from what the bid already knows** — the fixtures you counted on the takeoff, the picks you made on the Pricing compare, or the plans' schedule — so the day you price a job the submittal is half done.

## Where it lives

Bids → **Submittals** (the tab after Cover Letter; office and estimator roles). Pick a bid the way you do on Pricing. The tab is a lens on the product decisions: the specified product from the schedule, the submitted product from the picked quote line or the part under the takeoff's fixture, the status against the schedule, the reason and lead time you gave at the pick, and the cut-sheet pages.

## Where you are

The strip under the bid name shows the eight stages as pills under four words — **Build** (sources → Build Rev 1 → reasons & sheets), **Send** (package → share), **Their answer** (their call → resubmit), **Order** (procure). A ✓ is done, blue is where you are, amber is waiting on the reviewer. The line under the pills names the next thing to do and carries the button that does it, so the answer to "what now?" is always the same place. Tap a pill and the page scrolls to that stage's controls and rings them.

The page below runs in the same order, one numbered section per stage down a rail on the left. A finished stage folds to one green line (tap its title to open it); the stage you are on is open and ringed, and the rows stay open beside whatever reads them; a later stage is dashed with a line saying what will appear there. Tick **Open every stage** to see everything at once — the page remembers that on this device. The line under the bid name says which revision you are working on (*Working on Rev 3 · draft, started from Rev 2*); older revisions are the chips on stage 2.

New to the page? Tap {{button:outline|Walk me through it ▶}} on the strip (or the {{icon:help}} beside the bid name). It walks every stage in order, ringing what is on the page and explaining what will appear later, so you see the whole road on a fresh bid. Every step also carries one plain sentence under its title saying what it is for, with a {{icon:help}} that starts the walkthrough at that step. The first time a device opens Submittals the strip offers it in a line; **Not now** puts it away for good on that device.

## Without the robot

Nothing on this page needs the robot. On a bid with no schedule, stage 1 offers {{button:blue|Type or paste the schedule}}: the tags off the plans' fixture schedule, one per line — *WC-1 TOTO CT708UVG water closet* — saved to the same schedule Pricing reads. With no picks, build Rev 1 anyway: every row starts {{chip:red|Missing}}, and {{button:outline|Edit}} on a draft takes the tag and the product you are submitting along with the lead time. {{button:outline|+ Add a row by hand}} starts a row for anything not on the schedule. A call that came by phone or email is entered on any revision from the same editor, recorded as *entered by you*. From there the procurement log on stage 8 prints as it would from any other path.

## Before you build: where the rows come from

Stage 1 shows the sources with a count on each. Any one of them is enough.

- **The takeoff** — the fixtures you counted, with the part under each as the product and the house it came from. {{button:blue|Choose from the takeoff}} opens a pick list: fixtures and equipment start ticked, fixtures with no part yet and pipe, sawcutting and allowances start unticked. Untick what the GC does not need to approve; {{button:outline|Tick all with a product}} when you want everything priced. Your ticks are remembered on the bid. Rows built this way read {{chip:blue|Proposed}} — what we intend to install — until the plans' schedule says otherwise; a ticked fixture with no part yet lands {{chip:red|Missing}}, to type with {{button:outline|Edit}}.
- **The plans' schedule** — {{button:outline|Type or paste the schedule}} here, or, right under that button, *ask the robot to read it off the plans* (see below). Optional: with it, rows read {{chip:green|As specified}} or {{chip:yellow|Alternate}} instead of Proposed.
- **Quotes compared** — this card appears only on a bid with quote lines picked on the Pricing compare; it is the one source that carries the reason and lead time from each pick. A tag nobody picked reads {{chip:red|Missing}}; a picked line with no tag on the schedule becomes an {{chip:gray|Accessory}} row (carriers, stops, traps — the schedule leaves them to you).

:::example SpaceX, priced from the takeoff
BP375 has 26 fixtures on the takeoff, 22 with a part, no quotes compared and no schedule pasted. Wendi opens Submittals, taps Choose from the takeoff, unticks the two hose bibbs, and builds Rev 1: 20 Proposed rows with the product and the house on each, in tag order. The procurement log on stage 8 prints from them.
:::

## Build Rev 1

Open the bid on the Submittals tab and tap {{button:blue|Build Rev 1 from the picks}} — or {{button:blue|Choose from the takeoff}} and build from the ticked fixtures. From the picks: one row per tag, in tag order, then the accessories. Each row carries what Pricing knew: {{chip:green|As specified}}, {{chip:blue|Superseded}}, {{chip:blue|Equal}}, {{chip:yellow|Alternate}}, {{chip:red|Design change}}, {{chip:red|Missing}}, or {{chip:gray|Accessory}}; the reason and lead time from the pick; the house it came from.

One line under stage 3's title says where you stand: rows, as specified, alternates (and how many still need a reason), design changes, proposed, missing, accessories, and **cut sheets in**.

:::example SpaceX, the way it should have gone
Wendi pastes the P002 schedule, picks NWS on the compare, and opens Submittals. Rev 1 builds 22 rows: 6 as specified, 1 superseded, 1 equal, 8 alternates (3 still owe a reason), 1 design change, 1 missing, 4 accessories. Nothing was retyped from the quote.
:::

## Fix a row

Tap {{button:outline|Edit}} on any row. The editor takes the status (your call on superseded, equal or a design change when the model numbers alone cannot tell), the reason chips and a note an alternate or a design change owes ({{chip:gray|Long lead time}} {{chip:gray|Discontinued}} {{chip:gray|In stock}} {{chip:gray|Or-equal clause}} {{chip:gray|Cost}} {{chip:gray|Other}}), the lead time ({{chip:gray|In stock}} {{chip:gray|1 wk}} {{chip:gray|2 wk}} {{chip:gray|4+ wk}}, or typed), and the cut sheet. A row that owes a reason reads **say why**; a row with no sheet reads **sheet needed**. On a draft, **×** beside Edit takes a row off (a takeoff row is unticked in the pick list too), and {{button:outline|+ Add from the takeoff…}} ticks more fixtures on.

## Split a combined fixture

Counts name a fixture the way the plans group it — *WC 1&2 × 10* — and the submittal or the procurement log often wants WC-1 and WC-2 as two lines. Two doors, and the default keeps every row as counted.

- **In Choose from the takeoff**, a row whose name spells out more than one tag gets a {{chip:blue|Split}} switch. On, the row opens to show the rows it becomes, each with the same product and house; the bar reads *14 rows will go on Rev 1 · 1 split into 2*. The switch is remembered with your tick, so the next revision and *Add from the takeoff* split it the same way.
- **On a draft row**, {{button:outline|Split}} beside Edit does the same after the fact, for a row from any source — the takeoff, the schedule, or typed by hand as *WC-1, WC-2*. Product, house, lead time and sheet pages carry to each row; their calls start blank. Only on a draft; a shared revision is the record.

The app reads the tags off the name: *WC 1&2* reads WC-1 and WC-2; *UR 1, 2 & 3* reads three; *DWH1 & ET* reads only DWH-1, because "ET" has no number and the expansion tank stays with the heater; *12" DEEP MOP SINK* reads no tag at all. *When can a row split?* under the pick list shows this bid's own names as the rule reads them. A count the rule cannot read, such as *WC-1* that covers WC-1 and WC-1A on the plans, is renamed on Takeoffs to *WC 1&1A* or gets its second row by hand.

In the procurement log, rows split from one count read *counted with WC-2 on the takeoff*, so nobody orders the count twice; ordered, PO and expected dates are entered per row.

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

The moment a revision is shared its package PDF is also filed in the bid's job folder on Drive, under *Submittals*, as *Rev 2 · 2026-09-16.pdf* — the folder the plans went to — and the revision line reads {{chip:blue|filed in Drive ↗}}. An older shared revision that was never filed offers *File in Drive* on its line. Drafts are never filed.

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

Three chores are reading, and the robot can do them — you confirm, it never sends or decides. Every offer reads the same way: what the robot does, what it needs and whether this bid has it, what you do after, and whether a robot is awake (*A robot was working 12 min ago*). No offer shows at all until a robot seat has run in the last seven days. **The schedule**: on a bid with no schedule, the plans' schedule card on stage 1 offers {{button:outline|Ask the robot to read the schedule}} under {{button:outline|Type or paste the schedule}} — it needs the plans on the bid; the card says what the robot is doing while it works, with Cancel beside it. When it is back, the tags list under the cards: the ones it is sure of with a ✓ and the ones that *want a look* with a checkbox — {{button:green|Confirm 15 · leave 3}} puts the chosen tags on the schedule (the same rows *Plug in the fixture schedule* writes) and drops the rest. **A vendor PDF**: {{button:outline|Ask the robot to split this file}} on the file card; its guesses land on the page strip as dashed chips ({{chip:green|WC-1}} sure, {{chip:yellow|DWH-1?}} unsure) — tap one to put that page on the row as always, or {{button:green|Confirm 14 · pick 2}} to take every sure page at once. **A reviewer's redlines**: on their redlined PDF's card, {{button:outline|Ask the robot to read the redlines}}; the proposed calls list under the file — {{button:green|Confirm 6 · settle 2}} enters the sure ones on the rows as *read from Dana's file, confirmed by you*, the unsure ones wait for *Take the unsure ones too*, and each question the reviewer wrote posts to the thread for you to answer.

:::example What the robot is sure of
A tag printed on the sheet, a model number that matches a row, a stamp that says REVISE AND RESUBMIT — sure. A hand-written mark with no tag, a page that could be two sheets — it asks you to look, and never confirms itself.
:::

## The procurement log

Once the GC has approved rows, the eighth stage, {{chip:blue|8 Procure}}, is the procurement log a GC asks for — one row per tag, under the rows table on the newest revision. Nothing is typed twice: **Released** is the room's approval and its date; **Lead** is the lead time from the pick; **Required** is the day the item's stage starts on the job's schedule (a trim-set fixture by Trim Set's first day), read through the stage the takeoff gave the fixture. You type the **Ordered** date and the **PO**; **Expected** fills itself from the order date plus the lead time, and turns amber when you type the supply house's own date over it. **Float** is the days between expected and required — in the red when the item lands after its stage starts — and, for a released row you have not ordered, reads *order by* the last safe date. Tick **Delivered** when it is on site. A long-lead item with no cut sheet (a grease interceptor, a lift station) goes in with {{button:outline|+ Add item}}: its name, lead time and stage.

{{button:blue|Send update…}} writes the update for you: what changed since the last one (a date that slipped, a delivery, a row sent back), who it goes to, and one line of your own. {{button:blue|Record, print and copy}} records it, opens the sheet to print or save as a PDF, and copies the text to paste into your email to the GC. The sheet is a letter to the GC: the company letterhead, the project and its address, the GC's name, the schedule they gave us and your name; **What we need from you** above the table — your line first, then every row waiting on them with the date their approval has to come by to make its stage; the rows under their stage with the stage's needed-on-site date once; every cell in their words (*Approved Sep 18*, *Awaiting your approval*, *Returned for revision*, *15 days ahead*, *14 days behind*, *delivered Sep 26*, *we order by Oct 10*, *approve by Nov 10*); the row's note in Notes, and on an update an amber dot on each changed row with what changed since. It ends with the room's link and QR code and a line for you to sign that it is true and current — the GC does not sign a schedule. **Updates sent** keeps every one; **Print the log** prints it as it stands — *as of* today, nothing marked; **Download CSV** saves it as a spreadsheet file, and **Open in Google Sheets** copies the rows and opens a new sheet for you to paste into (click A1, paste). The GC does not have to wait for an update: their review room link carries a **Procurement** card with every released, ordered or delivered tag, when it lands and when its stage needs it — status and dates only, never the PO or the house.

:::example What the GC reads
BFP-1 · Watts 909 RPZ · approved 09/22 · ordered 09/25, PO 119 · 4 wk · expected **10/20 (house)** · required 10/06 · **−14 d** · "Ferguson: 10/20 earliest". The next update leads with that row.
:::

## What comes next

The Needs You cards, the won question, and the question thread on the room — each in its own release.
