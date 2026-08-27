---
title: price a bid with the Workbench
category: Office
roles: dev, master_technician, assistant, controller, estimator
keywords: pricing, workbench, margin, target, solver, preview, apply, locked, pinned, unpriced, coverage, GC, packet, price option, alternate, versions
order: 94
---
The **Bids → Pricing** tab has two layouts, switched by the {{chip:gray|Old}} / {{chip:gray|New}} pills on the selected bid. Old is the classic grid; **New is the Workbench**, built for pricing to a target.

The pills sit right beside the bid's title, and the **?** next to them is the one help door: a short card that covers the page in four lines — typing prices, the solver, what this GC sees, labor & cost — with **▶ Take the tour** (it spotlights each part of the Workbench in order, right on your bid) and a link back to this guide in its footer.

## GCs, prices, and the star

One sentence covers it: **versions draft this bid for different GCs; price options send more than one price to the same GC.** The **Send to** strip at the top shows one packet per GC — its own counts, takeoff, prices, send date and answer — and {{button:blue|＋ Add GC}} starts a new packet as a copy of one you already have. Inside a packet, the Workbench shows that GC's **price options**: the {{chip:green|★ base}} is what the GC sees — Cover Letter, Share, Print, CSV and the bid value all use it — and any other priced option can be **offered** to the same GC as an alternate from the card's bottom bar; it lands on their letter as an alternate section. Every card's bottom bar says who sees it — *★ The price on their letter*, *On their letter · alternate*, or *Only you see this* — and everything else is yours to compare.

Most bids have one GC and one price, so the Workbench shows just one quiet line — your price, the star, and {{button:outline|＋ Add price}}. That button asks what you want: **Another price for this GC** (name it, and offer it as an alternate right away or keep it to compare), **Another GC** (opens the same GC-first modal as the strip — pick the GC and which packet to start from), or **Adopt an existing bid** — pull a bid that's already on the board in as one of this bid's packets: its counts, takeoff, prices and sent history come along, and its old board row retires (nothing is deleted; the number still looks up). Labor and cost are shared by the whole bid: switching packets changes revenue, not cost. Once a second price or packet exists, the full structure bar appears — **This GC**, **Price options — what {{chip:gray|GC}} receives**, **Labor & cost**.

Need the whole picture at once? The {{button:outline|🗺 Map}} button at the end of the **Send to** strip (on Counts, Takeoffs, Pricing, and Cover Letter) opens a tree of the entire bid — every GC packet, its versions, and every price option with its value, its margin, and who sees it (★ on their letter, alternate, or only you), plus sent dates and won/lost per GC. Click any price in the map to open it on the Pricing tab; that's viewing only, so the GC still sees their ★.

Clicking a price card just **views** it; the ★ only moves when you press **☆ make base** on a card's bottom bar and confirm. Viewing a different price and pressing **Share**, **Print**, or **CSV**? One question first — the GC's ★ price (default) or the one you're viewing (for a teammate to check). The view never switches. A card showing {{chip:yellow|No prices yet}} can't be starred yet — it offers a one-click **copy prices from** a priced option, or price it with the solver. A new packet or version starts with a copy of **every price option** on the version it was made from — names and offers intact, ★ on the copy of the source's ★ (a packet with no prices yet says **No prices yet for {{chip:gray|GC}}** and offers to copy them). The **Counts** tab shows the same Send to strip — each packet has its own count list. Need a same-GC variant with its own takeoff (a VE, say)? **+ version** inside that GC's group on the strip.

## Price from the book

The Workbench reads your price book directly. A **Book entry** column on every row shows the assigned entry (name · book price) — the book's price flows straight into the sale column — or an **assign…** search: it opens pre-filled with the row's name minus any "ft of"-style prefix, and matches **word by word** — entries containing the most of your words rank first, so a row like *ft of 2" water line* surfaces *feet of water line* without retyping. Pick one, priced. Typing over a book price still works and becomes an override, exactly like the Old view.

Above the table, {{button:blue|Fill N matching from book}} assigns every unassigned row whose name **exactly** matches a book entry, in one click — the button counts the matches before you press it, so "Fill 0 matching" means the remaining rows need the per-row search. The chip beside it names the book you're drawing from — and it's the **one door to the book**.

## The price book drawer

Click the book chip ({{chip:gray|WENDI · 111 entries ▸}}) and the price book slides in beside the table — the whole book, without leaving the rows it prices. (The old **▶ Price book** section at the page bottom, and its unused "This version's prices" mode, are gone.)

- **Your book, front and center**: the row shows just your book (★ marks the one feeding this bid) with a **›** — press it to reveal the others, **‹** tucks them back. Clicking another book just **looks inside it** — the bid keeps pricing from its ★ book until you press {{button:blue|Use … on this bid}}, which switches the bid to that book *and* makes it **your default for new bids** (the line under the chips says so). Browsing never changes the bid. **Add book** creates a new one; ✎ renames.
- **Combined price ⇄ Stage price**: Combined shows one price per entry; Stage shows Rough In / Top Out / Trim Set (a dim — where a stage is zero; hover the name for the combined total).
- **Editing follows the mode**: ✎ in Stage mode offers all three stages; in Combined mode it offers one **Price** — which lands in **Rough In**, so a quick combined price is never lost, and flipping to Stage shows exactly where it sits.
- Search filters the entries; **Add entry** sits beside the Combined/Stage toggle and works in either mode; Esc or ✕ closes.

## Price to a number

1. Your **Revenue, Our cost, Profit, and Margin** stay pinned at the top — they move as you work.
2. The solver lives behind the blue {{button:blue|Solve ›}} — press it and the controls unfold inside a **blue ring**; **‹** folds them away, and open or closed is remembered on your device. Inside: type a **margin**, or drag the slider (20–95) that **re-prices live as you drag** — totals, proposals, and the landing chip track the thumb. Small ticks under the track mark the markup multiples for reference: **2** at 50%, **3** at 66%, **4** at 75%, **5** at 80%. Either way it prices your costed rows at that margin (overhead included), and prices you set by hand on rows with no Takeoffs cost keep their value and **stack on top** of the bid. A green chip under the solver shows where the whole bid lands — *70% on 16 costed rows → bid is $62,191 · 83%* (the second number runs above the slider whenever no-cost rows carry revenue, since that revenue has no cost against it). Or type a **target bid total** and press Enter — that number is for the **whole bid**, hand-priced rows included, so the bid lands at what you typed. The **▾ beside Solve** holds *Price unpriced only* (fills only rows with no sale price; priced rows are held as-is).
3. **📌 pin** any row to hold its price while the rest re-solve. Fixed-price rows are always held, and rows with no Takeoffs cost are never auto-priced — while a solve is pending, a banner counts them (*23/39 have no cost: their $26,156.17 is unaffected*) and can filter to just those rows.
4. The **ⓘ at the end of any row** opens its **Margin breakdown** — sale, materials, tax, labor, profit, and margin for that fixture — with jump chips (**# Counts · 📐 Takeoffs · 🛠 Labor**) that take you straight to the tab a number comes from, bid in hand. Only the ⓘ opens it, so clicking around the row while you price never pops it up.
5. The **Apply margin** column prices one row at your target margin, right where you're reading it — your last-used margin as a chip (tap {{chip:gray|50%}} and the row's price becomes cost ÷ (1 − margin)), and **…** for your three recents with live price previews plus a custom box. Same chips as the Old grid; your recents follow you between bids on this device.

## Typed prices save themselves; the solver previews

**A price you type is saved the moment you press Enter or leave the field** — a quick green *saved ✓* confirms it, and there's nothing to Apply. Same as the Old view, same as every other grid.

**Typing is overwrite, not surgery.** Clicking (or tabbing) into a **Sale price/unit** box selects the number that's there — however slow the click — so what you type replaces it, decimals and all. Esc puts the old number back; tabbing through without typing changes nothing. At rest the box reads as money ({{chip:gray|$1,410.00}}); the moment you're in it, it's just the number.

**Solver results preview first.** A solve re-prices many rows at once, so each proposal appears as a **purple price with an arrow to the left of the row's current price** — {{chip:purple|$640.00 →}} — while the current price stays put (struck through, since it's what the proposal would replace). The card outlines purple and {{button:blue|Apply 12}} / **Discard** appear at the line's end, with a count of what's previewed beneath. Nothing is saved until you hit Apply — the button counts what it will write — and Discard throws the whole preview away.

**Click a purple proposal to drop just that row.** It flips red with an ✕ — {{chip:red|$1,335.00 ✕}} — meaning Apply will leave that row's price alone; the count on the Apply button and the strip's note keep score. Click it again to bring the proposal back. Clicked-off rows stay clicked off while you keep tuning the margin, so you can shape the solve row by row before committing. Typing your own price into a previewed row saves your number immediately and takes that row out of the preview.

**Revenue, Profit, and Margin are inputs too.** Click any of the three and type — the sale price/unit follows as you type: revenue spreads across the count, profit adds the row's cost back, margin solves cost ÷ (1 − margin). Enter or leaving the field saves it exactly like a typed price (*saved ✓*); Esc walks away without saving. Rows with no Takeoffs cost have no profit or margin to edit.

**Solver previews wait on this device.** Visit any page, reload, close the tab, come back tomorrow — the preview is sitting where you left it, and one from an earlier sitting says when it's from (*solve from Tue 4:12 PM — restored*). Each price option keeps its own preview, so viewing another price just sets yours aside; it's restored when you view that price again. Previews stay on the computer they were made on — they don't follow you to another machine. A GC can never see a preview — Cover Letter, Share, Print, and CSV always use saved prices only. The **?** beside the Old/New pills keeps a short version of this story.

Each price card's ✎ opens the **Price** modal — rename it or delete it (the ★ can't be deleted while the letter is built on it).

## Know where you stand

- The **coverage chip** on the solver line counts pricing at a glance — green *29/29 ✓* when every costed row has a price, amber while work remains. Its caret drops the full bar with **Show unpriced only** to filter to just those rows; open or closed is remembered on your device.
- **Where the profit lives** shows profit by item and warns when most of it rides on one or two rows — the ones a GC's value-engineering pass goes after first. **Hover** any slice and it names itself instantly — item, profit dollars, share of job — while the rest of the bar fades so even the thinnest sliver reads. **Click** a slice (or a legend chip) to pin a detail card with the row's full economics — qty, unit cost, sale price, revenue, cost, profit, margin, and its book entry — and **↑ Jump to row in worksheet** scrolls you straight to that line and flashes it. The color legend under the bar tucks away with **Hide legend ▾** and stays how you left it.
- **This number vs your history** plots your decided bids on a margin scale — green dots are wins, red are price-losses — and calls where your current number sits. When bid tabs have been recorded on past bids (see *follow up with builders*), amber **▽** marks join the strip: each is the margin that would have **matched that tab's low**, and the line below counts the odds — *"At 32%, this number would have matched or beaten the low on 7 of 18 recorded tabs."* Pricing a bid for a GC with two or more recorded tabs, it also quotes that GC's range specifically.

:::example Working to a bid day number
You want this bid out the door at $42,000. Type 42000 in target total, Enter — every unpriced row fills, pinned rows hold, and the margin tile tells you what that number really earns.
:::

## "My version is gone!" — it isn't

Landing on Pricing (say, from the board's price-tag jump) first **loads** the bid's packets and prices — you'll see a brief shimmer over the Send-to strip and the Workbench while that happens. Your versions, prices, and previews are exactly where you left them; the page just hasn't finished fetching yet. If the connection drops mid-load, Pricing says *"Couldn't load this bid's packets and prices"* and offers {{button:gray|Retry}} — nothing was deleted.
