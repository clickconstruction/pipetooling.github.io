---
title: get supply house prices on a bid
category: Bids & Estimating
roles: dev, estimator, master_technician, assistant
keywords: fixture schedule, specified, as specified, alternate, superseded, design change, submittal, set up on this mac, pricing robot, supply house, quotes, vendor prices, compare quotes, plug in a quote, paste quote, rfq, price request, ferguson, moore supply, parts pricing, best price, quote comparison, requests I sent myself, edit bid, price requests table, requested date, quote link, robot, price it with the robot, price matrix, robot pricing, kits, carriers, needs a choice, incomplete kit, option, settle
---

Getting parts priced used to mean texting a list and retyping three different replies into a spreadsheet. Now the whole loop lives on Bids → Pricing.

You send the list. You get the reply in whatever form the vendor likes. You compare houses part by part. Your sale prices never leave the building. Vendors only ever see names and counts.

{{gif:get-supply-house-prices-on-a-bid.gif|Plug in a quote: paste the vendor's reply, Match to fixtures, and save. Then compare by Division 22 section and tap a price to pick it}}

## Step 1 — Send the list

Open the {{button:green|▾}} menu beside Share and pick **Supply house list**. Scope it to what that vendor actually prices: {{chip:blue|Whole job}}, {{chip:blue|Pipe & fittings}}, or hand-picked rows. Then either:

- **{{button:green|Copy}}**: paste it into a text or email like always, or
- **{{button:blue|Copy with quote link}}**: the same paste, ending with a link where the vendor types prices straight in. See *send a supply house a quote link* for that lane.

When you pick a house for the link, a line tells you what they've quoted before. It reads *Ferguson has last-quoted prices for 9 of these 83 items · newest today*. That is handy for choosing who to ask.

## Step 2 — Get the reply in, any shape

If the vendor used the quote link, you're done. Their quote is already on the bid. If they texted, emailed, or called:

1. Open the same {{button:green|▾}} menu and pick **Plug in a quote**. You can also **drop the vendor's file** straight onto it. That is an .xlsx, .csv, or .pdf file. The extracted text lands in the paste box for you to see. Spreadsheets with an "Ext Price" column are handled safely. Only unit prices survive. Matching runs like always. Scanned image PDFs get a straight answer: copy and paste for now.

{{gif:plug-in-file-drop.gif|Drop a vendor spreadsheet. The extracted text lands in the paste box, extended-price columns dropped, and the match grid fills}}
2. Pick the supply house, the rep if you want, and the **good until** date from the quote.
3. Paste the reply exactly as it came. It may read *4" cast iron 18.90/ft*, *$368/box of 50* or *wc carriers no stock til Oct*. Then tap {{button:blue|Match to fixtures}}.
4. Each line lands on the part it names, with the original text beside it. A green ✓ matched cleanly. A **?** wants a look. "No stock" phrasing marks **can't supply** automatically. Box and per-foot pricing is converted to $/each. So every house compares in the same units. Fix anything with the dropdowns, drop a line with the ×, or add lines by hand.
5. {{button:green|Save quote → compare}}. The raw paste stays with the quote, so you can always see what the vendor actually said.

:::example A phone-call quote
The Ferguson rep reads prices over the phone. Wendi types them as rough lines in the paste box — "4 inch cast iron 18.90 a foot", "floor drains 148" — hits Match, confirms two guesses, and saves. Thirty seconds, structured quote.
:::

## Step 2½ — Plug in the fixture schedule

The plans say what is *specified*. The houses quote what they stock. The fixture schedule is the plan's table of fixtures with their makes and models. Give the compare the schedule once, so it can tell the two apart. Open the same {{button:green|▾}} menu and pick **Plug in the fixture schedule**. It is also a button on the compare itself. Paste the plan's PLUMBING FIXTURE SCHEDULE as text. Tap {{button:blue|Match to tags}}. Each line becomes one row. The row holds the tag, such as WC-1, LAV-2 or DWH-1. It holds the make and model, the description, and the count row it belongs to. A green ✓ shows where the match is sure. A **?** shows where it wants a look. Fix anything in place, add a tag by hand, and {{button:green|Save}}.

:::example One paste, eighteen tags
Wendi copies the schedule off P002 and pastes it. Eighteen tags come back; sixteen matched their count rows on their own, two want a look (the hose bibb and the expansion tank). She picks the two rows, saves, and opens the compare.
:::

## Step 3 — Compare and pick

Once any quote is saved, a {{chip:blue|Quotes (1)}} chip sits beside Share. It turns **green** when a quote link comes back. Open it:

- Parts run down the left, **grouped by Division 22 section**, one column per supply house. Division 22 is the plumbing division of the spec. The best live price wears a ★.
- **Tap a price to pick it** for that part. Split the order across houses line by line. The picked total at the bottom recomputes at today's counts. Picks are saved for a future PO handoff. A PO is a purchase order.
- A **Last quoted** column shows what each house said the last time anyone asked about that part name. It looks across every bid. A high number smells wrong before you commit.
- Once the schedule is on the bid, a **Specified** column names the tag and the specified make and model. Each row wears a status for the house you picked. The statuses are {{chip:green|As specified}}, {{chip:blue|Superseded}}, {{chip:blue|Equal}}, {{chip:yellow|Alternate}}, {{chip:red|Design change}} and {{chip:red|Missing}}. Missing means specified, but nobody quoted it. A line above the grid counts them. It reads *6 as specified · 8 alternates · 1 design change · 1 missing*. So the alternates are visible the day you pick a house, not the day the GC asks. GC means the general contractor. A row whose pick reads *Same unit · confirm* differs only by a suffix, such as B74-CH against B74C.
- **Say why, while you remember.** Tap the status on a row you have picked. The popover, a small panel, asks three things, none required. First, what this pick is against the schedule. It offers {{chip:yellow|As derived · Alternate}}, or your call: {{chip:blue|Superseded}}, {{chip:blue|Equal}} or {{chip:red|Design change}}. Your call is for when the model numbers alone cannot tell. Second, why. It offers {{chip:gray|Long lead time}} {{chip:gray|Discontinued}} {{chip:gray|In stock}} {{chip:gray|Or-equal clause}} {{chip:gray|Cost}} {{chip:gray|Other}}. Add a note for what the GC will ask. Third, when it lands. It offers {{chip:gray|In stock}} {{chip:gray|1 wk}} {{chip:gray|2 wk}} {{chip:gray|4+ wk}}, or you type *3 wk* or *10 days*. {{button:green|Save}} writes it onto the pick. A kit's lines are written together. Picking a price that differs from the schedule opens the popover on its own. A row still owing a reason reads **why?**. The counts line says *3 without a reason*. The footer repeats it. Nothing is blocked. {{button:outline|Mark reviewed}} still works. But the answer is on the row the day the GC asks, not rebuilt from memory.

:::example The flush valve that was 8 weeks out
The schedule calls for a TOTO CT708UVG; NWS quoted the CT728 kit and Wendi picked it. The row turns {{chip:yellow|Alternate}} and the popover opens. She taps **Long lead time** and **2 wk**, types *spec model is 8 weeks out per Moore*, and saves. The row now reads *Alternate · long lead time · 2 wk*, and the counts line drops from *1 without a reason* to none.
:::

### Kits, options, and the robot's picks

The robot may have read the quotes. Or a quote may have been plugged in with parts. Either way the grid shows them the way the vendor wrote them:

- A fixture priced as a **kit** shows **one price per each**. A kit is a bowl, flush valve and seat under one "EACH" subtotal. The carrier from the second sheet is attached to it. Tap ▸ on the row to see the parts, which are *in kit*, and where each came from. A house that skipped a part the others priced reads {{chip:yellow|incomplete}} with the missing part named. An incomplete kit is never the cheapest.
- A quote that lists **options** reads {{chip:yellow|needs a choice}} with the price range. Options are six sizes of backflow preventer, or eight carrier variants. Tap it and pick the one the plans call for. The row then prices normally. The amber strip under the grid lists every row still waiting on you.
- The **Robot** column says why the robot picked what it picked. It reads like *cheapest complete kit* or *only house with the carrier*. Change a pick and it says *you changed this*. The robot learns from it next time.

:::example Settling the RPZ
NWS quoted the RPZ in six sizes. The row reads *needs a choice · $2,864.85 – $14,528.00*. Wendi taps it, picks **4in**, and the row prices at $3,680.09 — the quote's own $42,135 "subtotal" never entered the total.
:::

## Requests you sent yourself

Every bid keeps a list of who you asked. Open **Edit Bid → Files & Links → Price requests**, right under the plans. Requests the app sent fill in on their own. There is one row per request, grouped by house. It shows the day it was requested, the vendor's page, and whether they have viewed it. It shows the quote once it is plugged in. Needed-by sits under the requested date. It shows {{chip:green|✓}} once a quote is in, and amber while you wait.

Sent them by email or phone instead? {{button:blue|+ Add a request}} records them. It takes as many houses as you asked. Pick the first house, or add a new one right there. It becomes a card of its own. {{button:outline|+ Add another supply house}} adds the next. Each card carries **its own day** and **its own quote link**. That is because a batch you mailed on Friday comes back one quote at a time. Leave the link empty when the quote is not back yet. The row then shows a **Paste the quote link…** box. The day it lands, you paste it right there and press Enter. Or use **Edit**.

Every row wears a **Status** chip. It reads {{chip:gray|waiting}}, or {{chip:green|quote in}}. It reads {{chip:yellow|late 7d}} once the needed-by date has passed with nothing in. The count above the table says how many are late. Beside the date, {{chip:blue|by app}} or {{chip:yellow|sent outside}} says how it went. The **Quote** column holds only the quote. A hand-sent row gets **Call** when the house's default rep has a phone on the Directory. An app-sent row keeps **Nudge**. Once at least one quote is in, the panel header offers {{button:blue|Price with robot · 1 quote in}}. It opens the robot's price sheet on Pricing, the same one Pricing's own button opens. A request that passes its needed-by date with nothing in shows on your Dashboard's **Needs You** card. The card reads *past the date you asked for, with nothing in*. **Open Price requests** takes you to that bid.

The picker tells you where you already stand. A house you have just added reads *already in this batch* and cannot be picked twice. A house this bid has asked before reads *asked Sep 2 · already on this bid*. That second one is still pickable. Asking again on a revised scope is a real thing.

Each card also says **how** the house is asked. A house with a job-accounts rep on file defaults to {{chip:blue|app emails Dan}}. The app then sends the same price-request email Pricing's **Send by email** sends. That email holds the bid's list of counts and a quote link, nothing about money. The row fills in as *sent by app* with **Nudge** on it. {{button:outline|Preview the email}} shows the exact message before anything goes. Flip it to {{chip:gray|I'll send it}} when you are emailing or phoning them yourself. That card keeps its day and its link box. It is recorded as *sent outside*. A house with no rep on file starts as *I'll send it*. Type an address to let the app send it instead. The list the app emails is the bid's **Base** counts. A named version's counts still go out from Pricing, where the version is chosen.

{{button:blue|Ask 3 houses}} sends what needs sending and records the rest in one press. When every card is *I'll send it* the button reads **Add 3 requests** as before. Pricing the quote still happens on Pricing. Plug it in there so the compare can read it.

:::example One house, two requests
Ferguson · Sep 2 · Vendor page · needed by Sep 5 ✓
↳ another request · Sep 6 · Vendor page · needed by Sep 9
Moore Supply · Sep 3 · drive.google.com/file/d/1EcQ… · needed by Sep 5 ✓
:::

Requests you record here also show on the Pricing desk, tagged *sent outside the app*. So the desk's list and the bid's list are the same list.

A request the app sent that is still waiting has {{button:blue|Nudge}} right on its row. You see the exact reminder first. Nothing goes out until you tap **Send this nudge**. It is the same one-tap, rests-24-hours rule as the desk.

## Package deals and landing prices on costs

- A vendor's best number is often a package. It reads like *carriers + bowls, $18,400 all in*. Check those lines in Plug in quotes and **Group as a lot** with the one total. The compare shows them as a package and picks them together. It never lets a fake per-line price sneak in.
- **Apply picks to costs** sits in the compare footer. It writes your picked prices onto the bid's row costs. That is materials only, labor untouched. The margin change is shown first. Package totals split across their rows proportionally. The split is editable, and the total must hold. Applied rows wear a {{chip:green|Ferguson ↩}} tag on the workbench. One click reverts to the takeoff number, the cost from the plan counts. Package rows revert together.

## Let the robot price it

When the vendor quotes are PDFs, the robot can read them for you. That may be a fixture schedule with a carrier sheet stapled behind it.

1. Paste each vendor's quote link on that house's row. The row is on **Edit Bid → Files & Links → Price requests**. The link is the PDF or its Drive folder.
2. On **Bids → Pricing**, open {{button:green|▾}} → **Supply house prices** → **Price it with the robot**. The sheet lists every quote link on the bid. Untick one to skip it. A house you asked that has nothing in the folder yet is listed as skipped. The robot never invents a quote.
3. Tap {{button:blue|Queue it for the robot}}. Nothing is sent to anyone and nothing on the bid changes. The **Price requests** chip reads {{chip:blue|Robot pricing · queued}} while it waits and while it works. Tap it to see where it stands. While it is still queued, you can also **Take it back**.
4. When the chip turns {{chip:green|Matrix ready}}, tap it. The compare opens with the robot's picks on it. Where the plans decide, the robot asks you instead of guessing. That is which carrier variant, or which size.

Who runs the robot? Anyone on the estimating team, from their own Mac, with Claude Desktop. On **Bids → 🤖 Robots → Scoreboard**, the *Pricing robot* card has {{button:purple|Set up on this Mac}}. Type whose Mac it is. Copy the one command it makes. Paste it into Terminal and press Return. The robot's key is made on the server and written straight into Claude Desktop. You never see it. Then Claude Desktop restarts with the robot connected and the kickoff on your clipboard. The kickoff is the message that starts the robot. Start a new incognito chat there and paste. The robot prices every queued request, oldest first. Next time, {{button:gray|Copy pricing kickoff}} on the same card is all you need. It is Mac only. It needs Node 18+ from nodejs.org and says so if it is missing.

The robot reads a fixture quote the way a vendor writes one. A group of parts under one "EACH" subtotal is a kit priced once. A carrier on the second sheet belongs to the fixture whose tag it sits under. A list of sizes is options, never added up. It never emails a vendor and never changes your costs. **Apply picks to costs** stays yours.

:::example The SpaceX quote
National Wholesale Supply sends a six-page fixture quote plus a carrier and drain sheet. Wendi pastes the link on the NWS row, queues the robot, and forty minutes later the chip says *Matrix ready · 23 picks, 4 to settle*. WC1&2 is priced as the $1,010 kit plus a Josam carrier; the robot asks which of the eight carrier variants the plan calls for rather than picking one.
:::

## The honesty rules

The comparison won't quietly mislead you:

- A quote past its **good until** date goes gray and crossed out and loses its ★. If it expires **before your needed-by date**, an amber warning says so up top.
- Coverage rides each house's chip. It reads like *9 of 14 lines*. The house totals only count **lines every house priced**. No house wins just by skipping the expensive parts.
- If a vendor re-quotes, the newest quote is what you see. Older ones stay as history.

:::example Two houses, one order
Wendi plugs in Ferguson's texted reply, then Moore Supply's link quote comes back green. Ferguson's better on cast iron, Moore on copper. She taps her picks line by line and the picked total shows what the split order costs at today's counts.
:::
