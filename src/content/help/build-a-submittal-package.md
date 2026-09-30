---
title: build a submittal package
category: Bids & Estimating
roles: dev, master_technician, assistant, controller, estimator
keywords: procurement log, procurement, released, ordered, lead time, expected, required, float, order by, delivered, send update, submittal, submittals, walkthrough, tour, where you are, journey, next step, cut sheet, cut sheets, fixture schedule, specified, submitted, alternate, superseded, equal, design change, missing, accessory, revision, rev, package, vendor pdf, in lieu of, GC approval, product data
---
A submittal is the list of products you will install. The GC approves it before anything is ordered.

There is one row per tag on the plans' fixture schedule. Each row carries its cut sheet, the maker's page for the product. In PipeTooling you do not type the rows. The app builds them from what the bid already knows. That means the fixtures you counted, the picks you made on Pricing, or the plans' schedule. So the day you price a job, the submittal is half done.

## Where it lives

Open Bids and tap **Submittals**. It is the tab after Cover Letter. Office and estimator roles can use it. Pick a bid the way you do on Pricing. The tab shows the product decisions for that bid. For each row it shows the product the plans specified. It shows the product you are submitting. It shows the status against the schedule. It shows the reason and lead time you gave at the pick. And it shows the cut sheet pages.

## Where you are

The strip under the bid name shows the eight stages as pills. Four words sit over them: **Build**, **Send**, **Their answer** and **Order**. Build covers the sources, Build Rev 1 and the reasons and sheets. Send covers the package and the share. Their answer covers their call and the resubmit. Order is the procurement log. A ✓ means done. Blue means you are here. Amber means you are waiting on the reviewer. The line under the pills names the next thing to do. Its button does it. So the answer to "what now?" is always in the same place. Tap a pill and that stage opens, even a later one. The page scrolls to its controls and rings them.

The page below runs in the same order. Each stage is a numbered section down a rail on the left. A finished stage folds to one green line. The stage you are on is open and ringed. The rows stay open beside whatever reads them. A later stage is dashed, with a line saying what will appear there. Tap any stage's title and it opens and rings its buttons, the same as its pill. The page moves only if the buttons would be out of view. The small ▴ after the title folds it again. A revision is one version of the submittal. Rev 1 is the first. **Procure** at the bottom is always open, even before a revision exists. So a long-lead item can go in the moment you know about it. Tick **Open every stage** to see everything at once. The page remembers that on this device. The line under the bid name says which revision you are working on. It reads like *Working on Rev 3 · draft, started from Rev 2*. Older revisions are the chips on stage 2.

{{button:outline|See what the GC sees}} on the strip opens the GC's page beside the road. On a phone it opens as a sheet. It is the same page your link opens, read only. It follows every edit. Nothing is shared by looking. New to the page? Tap {{button:outline|Walk me through it ▶}} on the strip, or the {{icon:help}} beside the bid name. It walks every stage in order. It rings what is on the page and explains what will appear later. So you see the whole road on a fresh bid. Every step also has one plain sentence under its title saying what it is for. The {{icon:help}} beside it starts the walkthrough at that step. The first time a device opens Submittals, the strip offers the walkthrough in a line. **Not now** puts it away for good on that device.

## Without the robot

Nothing on this page needs the robot. On a bid with no schedule, stage 1 offers {{button:blue|Type or paste the schedule}}. Type the tags off the plans' fixture schedule, one per line. A line looks like *WC-1 TOTO CT708UVG water closet*. They save to the same schedule Pricing reads. With no picks, build Rev 1 anyway. Every row starts {{chip:red|Missing}}. Tap {{button:outline|Edit}} on a draft row to type the tag, the product and the lead time. {{button:outline|+ Add a row by hand}} starts a row for anything not on the schedule. A call that came by phone or email is entered on any revision from the same editor. It is recorded as *entered by you*. From there the procurement log on stage 8 prints as it would from any other path.

## Before you build: where the rows come from

Stage 1 shows the sources with a count on each. Any one of them is enough.

- **The takeoff.** These are the fixtures you counted. The part under each is the product, and the house it came from is the supplier. Tap {{button:blue|Choose from the takeoff}} to open a pick list. Fixtures and equipment start ticked. Fixtures with no part yet start unticked, and so do pipe, sawcutting and allowances. Untick what the GC does not need to approve. Tap {{button:outline|Tick all with a product}} when you want everything priced. Your ticks are remembered on the bid. Rows built this way read {{chip:blue|Proposed}}. That means what we intend to install, until the plans' schedule says otherwise. A ticked fixture with no part yet lands {{chip:red|Missing}}. Type it with {{button:outline|Edit}}.
- **The plans' schedule.** Tap {{button:outline|Type or paste the schedule}} here. Or ask the robot to read it off the plans, right under that button. See *Let the robot read it first* below. The schedule is optional. With it, rows read {{chip:green|As specified}} or {{chip:yellow|Alternate}} instead of Proposed.
- **Quotes compared.** This card appears only on a bid with quote lines picked on the Pricing compare. It is the one source that carries the reason and lead time from each pick. A tag nobody picked reads {{chip:red|Missing}}. A picked line with no tag on the schedule becomes an {{chip:gray|Accessory}} row. Carriers, stops and traps are accessories. The schedule leaves them to you.

:::example SpaceX, priced from the takeoff
BP375 has 26 fixtures on the takeoff, 22 with a part, no quotes compared and no schedule pasted. Wendi opens Submittals, taps Choose from the takeoff, unticks the two hose bibbs, and builds Rev 1: 20 Proposed rows with the product and the house on each, in tag order. The procurement log on stage 8 prints from them.
:::

## Build Rev 1

Rev 1 is the first version of your submittal. Open the bid on the Submittals tab. Tap {{button:blue|Build Rev 1 from the picks}}. Or tap {{button:blue|Choose from the takeoff}} and build from the ticked fixtures. From the picks you get one row per tag, in tag order, then the accessories. Each row carries what Pricing knew. Its status is one of {{chip:green|As specified}}, {{chip:blue|Superseded}}, {{chip:blue|Equal}}, {{chip:yellow|Alternate}}, {{chip:red|Design change}}, {{chip:red|Missing}} or {{chip:gray|Accessory}}. It carries the reason and lead time from the pick. It carries the house it came from.

One line under stage 3's title says where you stand. It counts rows, as specified, alternates, design changes, proposed, missing and accessories. It says how many alternates still need a reason. And it counts the **cut sheets in**.

:::example SpaceX, the way it should have gone
Wendi pastes the P002 schedule, picks NWS on the compare, and opens Submittals. Rev 1 builds 22 rows: 6 as specified, 1 superseded, 1 equal, 8 alternates (3 still owe a reason), 1 design change, 1 missing, 4 accessories. Nothing was retyped from the quote.
:::

## Fix a row

Tap {{button:outline|Edit}} on any row. The editor takes the status. Superseded, equal or a design change is your call when the model numbers alone cannot tell. It takes the reason chips: {{chip:gray|Long lead time}} {{chip:gray|Discontinued}} {{chip:gray|In stock}} {{chip:gray|Or-equal clause}} {{chip:gray|Cost}} {{chip:gray|Other}}. An alternate or a design change owes a reason and a note. It takes the lead time: {{chip:gray|In stock}} {{chip:gray|1 wk}} {{chip:gray|2 wk}} {{chip:gray|4+ wk}}, or a typed one. And it takes the cut sheet. A row that owes a reason reads **say why**. A row with no sheet reads **sheet needed**. On a draft, **×** beside Edit takes a row off. A takeoff row is unticked in the pick list too. {{button:outline|+ Add from the takeoff…}} ticks more fixtures on.

## Split a combined fixture

Counts name a fixture the way the plans group it, like *WC 1&2 × 10*. The submittal or the procurement log often wants WC-1 and WC-2 as two lines. There are two doors. The default keeps every row as counted.

- **In Choose from the takeoff**, a row whose name spells out more than one tag gets a {{chip:blue|Split}} switch. Turn it on and the row opens to show the rows it becomes. Each gets the same product and house. The bar reads *14 rows will go on Rev 1 · 1 split into 2*. The switch is remembered with your tick. So the next revision and *Add from the takeoff* split it the same way.
- **On a draft row**, {{button:outline|Split}} beside Edit does the same after the fact. It works for a row from any source: the takeoff, the schedule, or one typed by hand as *WC-1, WC-2*. Product, house, lead time and sheet pages carry to each row. Their calls start blank. It works only on a draft. A shared revision is the record.

The app reads the tags off the name. *WC 1&2* reads WC-1 and WC-2. *UR 1, 2 & 3* reads three. *DWH1 & ET* reads only DWH-1. "ET" has no number, and the expansion tank stays with the heater. *12" DEEP MOP SINK* reads no tag at all. *When can a row split?* under the pick list shows this bid's own names as the rule reads them. Some counts the rule cannot read. One is *WC-1* that covers WC-1 and WC-1A on the plans. Rename it on Takeoffs to *WC 1&1A*, or add its second row by hand.

In the procurement log, rows split from one count read *counted with WC-2 on the takeoff*. So nobody orders the count twice. Ordered, PO and expected dates are entered per row.

## Attach the cut sheets

Tap {{button:outline|Drop a vendor PDF}}. Give it the house's whole submittal PDF. A 31-page catalog is fine. It is stored once on the revision. It takes one line in the list above the table. The line shows the name and page count, then where it stands. It reads like *none on rows yet*, *57 of 75 on rows · 18 not used* or *trimmed · 6 pages kept · Sep 15*, with a small bar. The actions sit on the right: {{button:blue|Assign pages…}}, *Done with this file* once something is on rows, and a quiet *Remove*. As the file lands, the app reads it against the rows. A file whose pages name no row says so on its line. It reads *no page names a row · not a vendor submittal?*. That is how a contract dropped by mistake gives itself away. Tap the arrow at the left of the line and every page folds out as a thumbnail.

The fast way through a long file is {{button:blue|Assign pages…}} on the file's line. It is a full-screen walk, one page at a time at reading size. The answer is already filled in. The app reads each page's text. Where it finds a row's model number, it lights that row. It reads *Looks like WHA-500 · its model number is on the page*. Press **Space** to say yes and move to the next page. A page that names nothing keeps the row the page before was on. It reads *WHA-500 continues*. Or it offers the next row in the schedule. **Enter** or a click puts the page on a row. **X** marks a page that is not a cut sheet, like the cover, the index or a terms page. **← →** move without deciding. **Backspace** undoes the last pick. Type a tag or a model to find a row. The strip along the bottom colors every page by its row. So a wrong run shows before you finish, and any page is one click away. A row with nothing yet offers *find its pages*. The package goes to the customer, so every page has to be seen. The Done button counts *23 of 75 seen*. It unlocks only when every page is on a row or marked not a cut sheet. Nothing is written to the rows until Done. Cancel leaves them as they were.

If you would rather tap in the strip, it is one tap per page. Tap the page, then the row it belongs to. Rows still owing a sheet come first, in amber. A row nobody quoted never appears. The page wears the row's tag. Tap the chip's **×** to take it off. Tap a second page for the same row and it joins the sheet. A page you put on two rows reads {{chip:red|2 rows}}. A page prints under one tag only. A *keep it for* button per row settles it.

The footer counts as you go. It reads *6 of 31 pages on rows · 25 not used*. If you would rather type, the row's {{button:outline|Edit}} still takes a page range.

:::example Six rows from one file
NWS's submittal PDF is 31 pages. Wendi drops it, opens the arrow, and works down the amber list: page 1 and 2 onto WC-1, 3 onto the flush valve, 5 onto DWH-1, 8 onto FD-1, 12 onto HB-3. The footer reads *6 of 31 pages on rows · 25 not used*.
:::

## Done with a file

The dropped PDF is a working file, not a record. The record is the pages on rows. When you are done with it, tap {{button:outline|Done with this file}}. The pages on rows stay. The rest go. The file shrinks in storage. Every row still points at its sheet. There is no dialog. The line collapses to the kept pages. A quiet line reads *25 pages let go · Sep 15 · drop the file again if you need one*. A file with nothing on rows offers {{button:outline|Remove this file}} instead. Taking a page off after Done does not bring the others back. Drop the file again if you need one.

## Rebuild, or start a new revision

- {{button:outline|Rebuild rows from picks}} is for a draft. Use it when you changed picks on the compare, or added a tag to the schedule. Rows are rebuilt from today's picks. Sheets, reasons and lead times carry wherever the product is unchanged.
- {{button:green|New revision}} is for after a share. Use it when the GC sent rows back, or the products changed. Every row carries into the new draft. A **Since Rev N** column says what changed. It reads *product changed*, *status changed*, *reason added*, *now missing*, *new row* or *carried*. An unshared draft you revise reads *superseded*. Only the newest revision can be revised. Older ones stay as the record.

## Build the package

Tap {{button:outline|Build package}}. The package is one PDF for the GC. It starts with a cover table on our letterhead. The table lists every row with its tag, the specified and submitted product, the status, the reason and lead time. It also says the page each cut sheet starts on. Then come the sheets in tag order. Each page is stamped *TAG · STATUS* and footed with the product. Rows still owing a sheet read *to follow* on the cover. The package is stored on the revision and opens in a new tab. {{button:outline|Open package}} brings it back. {{button:outline|Rebuild package}} refreshes it after you edit rows or pages.

:::example Rev 3 on SpaceX
22 rows, 14 sheets attached. The cover runs two pages, so DWH-1's sheet reads *p. 3*; the package is 31 pages. Wendi downloads it and sends it her own way — Share, with the GC's decisions coming back onto the rows, is the next release.
:::

## Share it: the review room

Under the rows, a line reads what the GC's page will say for them as they stand. It reads like *The GC's page will read: "2 rows need a call"*. It reminds you the GC sees nothing until you share. It changes as you edit. When Rev N is ready, tap {{button:blue|Share}} beside New revision. The bid gets one **review room** link. The room is the page where the GC reads your rows. It is the same link through every revision. It is copied to your clipboard. Paste it into the email chain you are already in with the GC. They forward it to whoever reviews products for the customer, usually the architect or the designer. Anyone with the link can read the rows in plain words. They see which match the plans, which differ and why, and the package to download. Nothing about money, the builder's account or the supply houses is on that page.

- **Know the reviewer already?** Name them on Share, with their name, email and role. They get a personal link too. The room recognises their email if they arrive through the forward instead. Tick **watching** for the GC's PM. They see everything and decide nothing.
- **Before it goes**, Share does two things for you. It runs Done with this file on any vendor PDF you never trimmed. And it rebuilds the package so the room's download matches the rows.
- After Share, the tab reads *Room link · shared Sep 16 · opened 9×* above the revision chips. It has {{button:outline|Copy link}} and {{button:outline|Close the room}}. Everyone who identifies themselves on the page appears under it. Each has a **deciding / watching** switch and a personal link. A line like *+ 4 opens by people who did not say who they were* counts the rest.
- Sharing Rev N+1 later never mints a new link. The same address now shows the new revision. The earlier ones sit under it as the record.

:::example The link into the chain
Wendi taps Share on Rev 2, names Dana Whitfield (architect) from the email thread, ticks Logan at Structura as watching, and pastes the room link into her reply to the chain. Two days later the tab reads *opened 5×*, Dana under it as *identified via the room link*, and one open by someone who did not say.
:::

### The thread

Under the rows, the room has **On this submittal**. A reviewer or a watcher writes a question there, about one tag or the whole revision. It lands on your inbox as a customer waiting. It also lands on the tab's **Thread** panel. Nobody's question is a decision. The rows above are. Decisions and each shared revision post their own line. So the thread reads as the record. It reads like *Rev 2 is up*, then *Dana Whitfield decided 3 rows · 2 revise · 1 reject*, then *Dana asked about DWH-1*, then your answer. Reply from the Thread panel. The room shows your reply as {{chip:blue|Click Plumbing}}. The person gets it by email with their own link. The inbox request closes with your answer as the note. Five asks an hour per person is the limit.

The moment a revision is shared, its package PDF is also filed in the bid's job folder on Drive. It goes under *Submittals*, as *Rev 2 · 2026-09-16.pdf*. That is the folder the plans went to. The revision line reads {{chip:blue|filed in Drive ↗}}. An older shared revision that was never filed offers *File in Drive* on its line. Drafts are never filed.

## Read their decisions

On the room, a reviewer taps {{chip:green|Approve}}, {{chip:yellow|Revise}} or {{chip:red|Reject}} on each row that differs. The first tap asks once who they are. It takes their name and email. It asks whether they are the architect, the owner's rep, the designer or the builder. Then {{button:outline|Send my review}} records every call with their name. Someone you marked **watching** can tap but not send.

Their calls land on your rows. A **Their call** column shows the decision, who made it, when, and their note. A line above the table reads *Their call: 19 approved · 2 revise · 1 rejected · by Dana W.*. Beside it, {{button:outline|Copy their decisions as text}} is for a GC who keeps their own log. When rows came back marked Revise or Reject, a new door appears. It reads {{button:green|Rev 3 from the 2 rows sent back}}. That is a draft carrying only those rows. The rest stand as approved on the revision they were approved on. Share Rev 3 and the same room link shows it.

:::example The flush valve, round two
Dana marks the flush valve Revise — "hold 1.0 gpf" — and everything else approved. The tab reads *Their call: 21 approved · 1 revise · by Dana Whitfield*. Wendi taps *Rev 3 from the 1 row sent back*, picks TET2UB31 on the compare, rebuilds the row, and shares. Dana's link now shows Rev 3 with one row, marked resubmitted.
:::

## A reviewer who marked up the PDF

Some architects never open the room. They redline the package, or answer in the GC's email. Keep their file on the revision. {{button:outline|Drop a reviewer's file}} sits beside *Drop a vendor PDF*. It takes the redlined PDF or the forwarded email, as .eml, .msg or .txt. A blue card under the sheet list shows it, with {{button:outline|Open the file}}. Then type their calls onto the rows. Tap {{button:outline|Edit}} on a row. Under *Their call · on behalf of a reviewer*, pick who it came from. Or pick *a reviewer not on the room…* and type a name and email. Tap {{chip:green|Approved}}, {{chip:yellow|Revise}} or {{chip:red|Rejected}}. Add their note. If they made the call on an earlier day, set that day in the date box beside the three buttons. Save. The row reads *Revise · Dana Whitfield · entered by Wendi · Sep 17*. The date is the day you set. The decisions line counts *2 entered by Wendi*. The room's thread gets a quiet line: *from Dana's file, entered by the office · 1 row · 1 revise*. Dana's trail counts it. The room never shows the file or your name. Wrong row? Tap Edit, then *clear it*, then Save.

Did they approve all of it at once? Open *Their call* and tap {{button:outline|They approved all of it…}}. Say who approved it and on what day. One entry marks every row with no call yet as Approved. A row that already has a call keeps it. A row with no product is left out. The same door sits over the procurement log as *Enter their approval…*. It works on a draft too. Use it for a submittal the GC accepted before you shared it here.

:::example The same call, two ways
Dana taps **Revise** on the room → *Revise · Dana Whitfield · Sep 17*. Dana emails "hold the elongated bowl" → you enter it → *Revise · Dana Whitfield · entered by Wendi · Sep 17*. Both count as sent back; **Rev N+1 from the rows sent back** carries both.
:::

## Let the robot read it first

Three chores are reading, and the robot can do them. You confirm. It never sends or decides. Every offer reads the same way. It says what the robot does. It says what it needs and whether this bid has it. It says what you do after. And it says whether a robot is awake, like *A robot was working 12 min ago*. No offer shows at all until a robot seat has run in the last seven days.

**The schedule.** On a bid with no schedule, stage 1's schedule card offers {{button:outline|Ask the robot to read the schedule}}. It sits under {{button:outline|Type or paste the schedule}}. It needs the plans on the bid. The card says what the robot is doing while it works, with Cancel beside it. When it is back, the tags list under the cards. The ones it is sure of have a ✓. The ones that *want a look* have a checkbox. {{button:green|Confirm 15 · leave 3}} puts the chosen tags on the schedule and drops the rest. They are the same rows *Type or paste the schedule* writes.

**A vendor PDF.** Tap {{button:outline|Ask the robot to split this file}} on the file card. Its guesses land on the page strip as dashed chips. {{chip:green|WC-1}} means sure. {{chip:yellow|DWH-1?}} means unsure. Tap one to put that page on the row, as always. Or tap {{button:green|Confirm 14 · pick 2}} to take every sure page at once.

**A reviewer's redlines.** On their redlined PDF's card, tap {{button:outline|Ask the robot to read the redlines}}. The proposed calls list under the file. {{button:green|Confirm 6 · settle 2}} enters the sure ones on the rows. They read *read from Dana's file, confirmed by you*. The unsure ones wait for *Take the unsure ones too*. Each question the reviewer wrote posts to the thread for you to answer.

:::example What the robot is sure of
A tag printed on the sheet, a model number that matches a row, a stamp that says REVISE AND RESUBMIT — sure. A hand-written mark with no tag, a page that could be two sheets — it asks you to look, and never confirms itself.
:::

## The procurement log

Once the GC has approved rows, the eighth stage, {{chip:blue|8 Procure}}, is the procurement log a GC asks for. It has one row per tag, under the rows table on the newest revision. Each row opens with the tag in bold and the product beside it. The supply house and the stage sit on the line under them. Nothing is typed twice. **Released** is the approval and its date. That is the GC's tap in the room, or the day you entered for them. **Lead** is the lead time from the pick. **Required** is the day the item's stage starts on the job's schedule. A trim-set fixture is required by Trim Set's first day. The stage comes from the takeoff. You type the **Ordered** date and the **PO**. A date saves when it is finished. Pick it from the calendar, or type it and press Enter or leave the box. A date left half typed is not saved. **Expected** fills itself from the order date plus the lead time. It turns amber when you type the supply house's own date over it. **Float** is the days between expected and required. It is in the red when the item lands after its stage starts. For a released row you have not ordered, it reads *order by* the last safe date. Tick **Delivered** when it is on site. A long-lead item with no cut sheet goes in with {{button:outline|+ Add item}}. A grease interceptor or a lift station is one. Give it its name, lead time and stage.

{{button:blue|Send update…}} writes the update for you. It says what changed since the last one: a date that slipped, a delivery, a row sent back. It says who it goes to. It takes one line of your own. {{button:blue|Record, print and copy}} records it. It opens the sheet to print or save as a PDF. And it copies the text to paste into your email to the GC.

The sheet is a letter to the GC. It has the company letterhead, the project and its address, the GC's name and your name. It names the schedule they gave us. **What we need from you** sits above the table. Your line comes first. Then every row waiting on them, with the date their approval has to come by to make its stage. The rows sit under their stage, with the stage's needed-on-site date once. Every cell is in their words. It reads *Approved Sep 18*, *Awaiting your approval* or *Returned for revision*. Or *15 days ahead*, *14 days behind* and *delivered Sep 26*. Or *we order by Oct 10* and *approve by Nov 10*. The row's note is in Notes. On an update, an amber dot marks each changed row with what changed since. It ends with the room's link and QR code. There is a line for you to sign that it is true and current. The GC does not sign a schedule.

**Updates sent** keeps every one. **Print the log** prints it as it stands, *as of* today, with nothing marked. **Download CSV** saves it as a spreadsheet file. **Open in Google Sheets** copies the rows and opens a new sheet for you to paste into. Click A1, then paste. The printed log puts the tag and the product in one Item column, as the screen does. The CSV and the Google Sheet keep Tag and Product as two columns, so you can sort by either. The GC does not have to wait for an update. Their review room link carries a **Procurement** card. It lists every released, ordered or delivered tag, when it lands and when its stage needs it. It shows status and dates only, never the PO or the house.

:::example What the GC reads
BFP-1 · Watts 909 RPZ · approved 09/22 · ordered 09/25, PO 119 · 4 wk · expected **10/20 (house)** · required 10/06 · **−14 d** · "Ferguson: 10/20 earliest". The next update leads with that row.
:::

## What comes next

The Needs You cards, the won question, and the question thread on the room. Each comes in its own release.
