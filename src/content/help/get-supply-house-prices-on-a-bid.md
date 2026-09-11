---
title: get supply house prices on a bid
category: Bids & Estimating
roles: dev, estimator, master_technician, assistant
keywords: set up on this mac, pricing robot, supply house, quotes, vendor prices, compare quotes, plug in a quote, paste quote, rfq, price request, ferguson, moore supply, parts pricing, best price, quote comparison, requests I sent myself, edit bid, price requests table, requested date, quote link, robot, price it with the robot, price matrix, robot pricing, kits, carriers, needs a choice, incomplete kit, option, settle
---

Getting parts priced used to mean texting a list, getting prices back in three different shapes, and retyping them into a spreadsheet. Now the whole loop lives on **Bids → Pricing**: send the list, get the reply in whatever form the vendor likes, and compare houses part by part. Your sale prices never leave the building — vendors only ever see names and counts.

{{gif:get-supply-house-prices-on-a-bid.gif|Plug in a quote: paste the vendor's reply, Match to fixtures, save — then compare by Division 22 section and tap a price to pick it}}

## Step 1 — Send the list

Open the {{button:green|▾}} menu beside Share and pick **Supply house list**. Scope it to what that vendor actually prices ({{chip:blue|Whole job}}, {{chip:blue|Pipe &amp; fittings}}, or hand-picked rows), then either:

- **{{button:green|Copy}}** — paste it into a text or email like always, or
- **{{button:blue|Copy with quote link}}** — the same paste, ending with a link where the vendor types prices straight in. See *send a supply house a quote link* for that lane.

When you pick a house for the link, a line tells you what they've quoted before — "Ferguson has last-quoted prices for 9 of these 83 items · newest today" — handy for choosing who to ask.

## Step 2 — Get the reply in, any shape

If the vendor used the quote link, you're done — their quote is already on the bid. If they texted, emailed, or called:

1. Open the same {{button:green|▾}} menu and pick **Plug in a quote**. You can also **drop the vendor's file** — .xlsx, .csv, or .pdf — straight onto it: the extracted text lands in the paste box for you to see (spreadsheets with an "Ext Price" column are handled safely — only unit prices survive), and matching runs like always. Scanned image PDFs get a straight answer: copy/paste for now.

{{gif:plug-in-file-drop.gif|Drop a vendor spreadsheet — extracted text lands in the paste box (extended-price columns dropped) and the match grid fills}}
2. Pick the supply house, the rep if you want, and the **good until** date from the quote.
3. Paste the reply exactly as it came — "4" cast iron 18.90/ft", "$368/box of 50", "wc carriers no stock til Oct" — and tap {{button:blue|Match to fixtures}}.
4. Each line lands on the part it names, with the original text beside it: a green ✓ matched cleanly, a **?** wants a look. "No stock" phrasing marks **can't supply** automatically; box and per-foot pricing is converted to $/each so every house compares in the same units. Fix anything with the dropdowns, drop a line with the ×, or add lines by hand.
5. {{button:green|Save quote → compare}}. The raw paste stays with the quote, so you can always see what the vendor actually said.

:::example A phone-call quote
The Ferguson rep reads prices over the phone. Wendi types them as rough lines in the paste box — "4 inch cast iron 18.90 a foot", "floor drains 148" — hits Match, confirms two guesses, and saves. Thirty seconds, structured quote.
:::

## Step 3 — Compare and pick

Once any quote is saved, a {{chip:blue|Quotes (1)}} chip sits beside Share — it turns **green** when a quote link comes back. Open it:

- Parts run down the left, **grouped by Division 22 section**, one column per supply house. The best live price wears a ★.
- **Tap a price to pick it** for that part — split the order across houses line by line. The picked total at the bottom recomputes at today's counts, and picks are saved for a future PO handoff.
- A **Last quoted** column shows what each house said the last time anyone asked about that part name, on any bid — a high number smells wrong before you commit.

### Kits, options, and the robot's picks

When the robot read the quotes (or a quote was plugged in with parts), the grid shows them the way the vendor wrote them:

- A fixture priced as a **kit** — bowl, flush valve and seat under one "EACH" subtotal, the carrier from the second sheet attached — shows **one price per each**. Tap ▸ on the row to see the parts, which are *in kit*, and where each came from. A house that skipped a part the others priced reads {{chip:yellow|incomplete}} with the missing part named; an incomplete kit is never the cheapest.
- A quote that lists **options** — six sizes of backflow preventer, eight carrier variants — reads {{chip:yellow|needs a choice}} with the price range. Tap it and pick the one the plans call for; the row then prices normally. The amber strip under the grid lists every row still waiting on you.
- The **Robot** column says why the robot picked what it picked ("cheapest complete kit", "only house with the carrier"). Change a pick and it says *you changed this* — and the robot learns from it next time.

:::example Settling the RPZ
NWS quoted the RPZ in six sizes. The row reads *needs a choice · $2,864.85 – $14,528.00*. Wendi taps it, picks **4in**, and the row prices at $3,680.09 — the quote's own $42,135 "subtotal" never entered the total.
:::

## Requests you sent yourself

Every bid keeps a list of who you asked: **Edit Bid → Files & Links → Price requests**, right under the plans. Requests the app sent fill in on their own — one row per request, grouped by house, with the day it was requested, the vendor's page, whether they have viewed it, and the quote once it is plugged in. Needed-by sits under the requested date: {{chip:green|✓}} once a quote is in, amber while you wait.

Sent one by email or phone instead? {{button:blue|+ Add a request}} records it: pick the house (or add a new one right there), keep or change the date, and paste a link to the request you sent — a Drive copy, a PDF. That is the whole row: the supply house, when you asked, and the link. When the quote lands, plug it in on Pricing; it does not go in this table.

:::example One house, two requests
Ferguson · Sep 2 · Vendor page · needed by Sep 5 ✓
↳ another request · Sep 6 · Vendor page · needed by Sep 9
Moore Supply · Sep 3 · drive.google.com/file/d/1EcQ… · needed by Sep 5 ✓
:::

Requests you record here also show on the Pricing desk, tagged *sent outside the app*, so the desk's list and the bid's list are the same list.

A request the app sent that is still waiting has {{button:blue|Nudge}} right on its row: you see the exact reminder first, and nothing goes out until you tap **Send this nudge**. Same one-tap, rests-24-hours rule as the desk.

## Package deals and landing prices on costs

- A vendor's best number is often a package — "carriers + bowls, $18,400 all in." Check those lines in Plug in quotes and **Group as a lot** with the one total; the compare shows them as a package, picks them together, and never lets a fake per-line price sneak in.
- **Apply picks to costs** (in the compare footer) writes your picked prices onto the bid's row costs — materials only, labor untouched, with the margin change shown first. Package totals split across their rows proportionally (editable, and the total must hold). Applied rows wear a {{chip:green|Ferguson ↩}} tag on the workbench — one click reverts to the takeoff number, and package rows revert together.

## Let the robot price it

When the vendor quotes are PDFs — a fixture schedule with a carrier sheet stapled behind it — the robot can read them for you.

1. Paste each vendor's quote link (the PDF or its Drive folder) on **Edit Bid → Files & Links → Price requests**, on that house's row.
2. On **Bids → Pricing**, open {{button:green|▾}} → **Supply house prices** → **Price it with the robot**. The sheet lists every quote link on the bid; untick one to skip it. A house you asked that has nothing in the folder yet is listed as skipped — the robot never invents a quote.
3. {{button:blue|Queue it for the robot}}. Nothing is sent to anyone and nothing on the bid changes. The **Price requests** chip reads {{chip:blue|Robot pricing · queued}} while it waits and while it works; tap it to see where it stands or, while it is still queued, to **Take it back**.
4. When the chip turns {{chip:green|Matrix ready}}, tap it: the compare opens with the robot's picks on it. Where the plans decide — which carrier variant, which size — the robot asks you instead of guessing.

Who runs the robot? Anyone on the estimating team, from their own Mac, with Claude Desktop. On **Bids → 🤖 Robots → Scoreboard**, the *Pricing robot* card has {{button:purple|Set up on this Mac}}: type whose Mac it is, copy the one command it makes, paste it into Terminal and press Return. The robot's key is made on the server and written straight into Claude Desktop — you never see it — then Claude Desktop restarts with the robot connected and the kickoff on your clipboard. Start a new incognito chat there and paste; the robot prices every queued request, oldest first. Next time, {{button:gray|Copy pricing kickoff}} on the same card is all you need. Mac only; it needs Node 18+ from nodejs.org and says so if it is missing.

The robot reads a fixture quote the way a vendor writes one: a group of parts under one "EACH" subtotal is a kit priced once; a carrier on the second sheet belongs to the fixture whose tag it sits under; a list of sizes is options, never added up. It never emails a vendor and never changes your costs — **Apply picks to costs** stays yours.

:::example The SpaceX quote
National Wholesale Supply sends a six-page fixture quote plus a carrier and drain sheet. Wendi pastes the link on the NWS row, queues the robot, and forty minutes later the chip says *Matrix ready · 23 picks, 4 to settle*. WC1&2 is priced as the $1,010 kit plus a Josam carrier; the robot asks which of the eight carrier variants the plan calls for rather than picking one.
:::

## The honesty rules

The comparison won't quietly mislead you:

- A quote past its **good until** date goes gray and crossed out and loses its ★ — and if it expires **before your needed-by date**, an amber warning says so up top.
- Coverage rides each house's chip ("9 of 14 lines"), and the house totals only count **lines every house priced** — no house wins just by skipping the expensive parts.
- If a vendor re-quotes, the newest quote is what you see; older ones stay as history.

:::example Two houses, one order
Wendi plugs in Ferguson's texted reply, then Moore Supply's link quote comes back green. Ferguson's better on cast iron, Moore on copper. She taps her picks line by line and the picked total shows what the split order costs at today's counts.
:::
