---
title: price a bid with the Workbench
category: Office
roles: dev, master_technician, assistant, controller, estimator
keywords: pricing, workbench, margin, target, solver, preview, apply, locked, pinned, unpriced, coverage, GC, packet, price option, alternate, versions
order: 94
---
The **Bids → Pricing** tab has two layouts, switched by the {{chip:gray|Old}} / {{chip:gray|New}} pills on the selected bid. Old is the classic grid; **New is the Workbench**, built for pricing to a target.

New to it? Click the **?** beside the New pill for a guided tour — it spotlights each part of the Workbench in order, right on your bid.

## GCs, prices, and the star

One sentence covers it: **versions draft this bid for different GCs; price options send more than one price to the same GC.** The **Send to** strip at the top shows one packet per GC — its own counts, takeoff, prices, send date and answer — and {{button:blue|＋ Add GC}} starts a new packet as a copy of one you already have. Inside a packet, the Workbench shows that GC's **price options**: the {{chip:green|★ base}} is what the GC sees — Cover Letter, Share, Print, CSV and the bid value all use it — and any other priced option can be **offered** to the same GC as an alternate from the card's bottom bar; it lands on their letter as an alternate section. Every card's bottom bar says who sees it — *★ The price on their letter*, *On their letter · alternate*, or *Only you see this* — and everything else is yours to compare.

Most bids have one GC and one price, so the Workbench shows just one quiet line — your price, the star, and {{button:outline|＋ Add price}}. That button asks what you want: **Another price for this GC** (name it, and offer it as an alternate right away or keep it to compare), **Another GC** (opens the same GC-first modal as the strip — pick the GC and which packet to start from), or **Adopt an existing bid** — pull a bid that's already on the board in as one of this bid's packets: its counts, takeoff, prices and sent history come along, and its old board row retires (nothing is deleted; the number still looks up). Labor and cost are shared by the whole bid: switching packets changes revenue, not cost. Once a second price or packet exists, the full structure bar appears — **This GC**, **Price options — what {{chip:gray|GC}} receives**, **Labor & cost**.

Clicking a price card just **views** it; the ★ only moves when you press **☆ make base** on a card's bottom bar and confirm. Viewing a different price and pressing **Share**, **Print**, or **CSV**? One question first — the GC's ★ price (default) or the one you're viewing (for a teammate to check). The view never switches. A card showing {{chip:yellow|No prices yet}} can't be starred yet — it offers a one-click **copy prices from** a priced option, or price it with the solver. A new packet for another GC starts with a copy of the ★ it was made from (a packet with no prices yet says **No prices yet for {{chip:gray|GC}}** and offers to copy them). The **Counts** tab shows the same Send to strip — each packet has its own count list. Need a same-GC variant with its own takeoff (a VE, say)? **+ version** inside that GC's group on the strip.

## Price from the book

The Workbench reads your price book directly. A **Book entry** column on every row shows the assigned entry (name · book price) — the book's price flows straight into the sale column — or an **assign…** search: type, pick, priced. Typing over a book price still works and becomes an override, exactly like the Old view.

Above the table, {{button:blue|Fill N matching from book}} assigns every unassigned row whose name **exactly** matches a book entry, in one click — the button counts the matches before you press it, so "Fill 0 matching" means the remaining rows need the per-row search. The line beside it names the book you're drawing from.

## Price to a number

1. Your **Revenue, Our cost, Profit, and Margin** stay pinned at the top — they move as you work.
2. Drag the **margin slider**, type a **margin**, or type a **target bid total** and press Enter — all for the whole bid, so revenue already sitting on no-cost rows counts toward them. The **▾ beside Solve** holds *Price unpriced only* (fills only rows with no sale price; priced rows are held as-is).
3. **📌 pin** any row to hold its price while the rest re-solve. Fixed-price rows are always held, and rows with no Takeoffs cost are never auto-priced — when they carry revenue anyway, an amber banner totals it and can filter to just those rows.

## Typed prices save themselves; the solver previews

**A price you type is saved the moment you press Enter or leave the field** — a quick green *saved ✓* confirms it, and there's nothing to Apply. Same as the Old view, same as every other grid.

**Solver results preview first.** A solve re-prices many rows at once, so those land as amber **preview** values — the card outlines amber and {{button:blue|Apply 12}} / **Discard** appear at the line's end, with a count of what's previewed beneath. Nothing is saved until you hit Apply — the button counts what it will write — and Discard throws the preview away. Typing your own price into a previewed row saves your number immediately and takes that row out of the preview.

**Solver previews wait on this device.** Visit any page, reload, close the tab, come back tomorrow — the preview is sitting where you left it, and one from an earlier sitting says when it's from (*solve from Tue 4:12 PM — restored*). Each price option keeps its own preview, so viewing another price just sets yours aside; it's restored when you view that price again. Previews stay on the computer they were made on — they don't follow you to another machine. A GC can never see a preview — Cover Letter, Share, Print, and CSV always use saved prices only. The **(i)** beside the bid name keeps a short version of this story.

Each price card's ✎ opens the **Price** modal — rename it or delete it (the ★ can't be deleted while the letter is built on it).

## Know where you stand

- The **coverage bar** counts what's still unpriced and can filter to just those rows.
- **Where the profit lives** shows profit by item and warns when most of it rides on one or two rows — the ones a GC's value-engineering pass goes after first. **Hover** any slice and it names itself instantly — item, profit dollars, share of job — while the rest of the bar fades so even the thinnest sliver reads. **Click** a slice (or a legend chip) to pin a detail card with the row's full economics — qty, unit cost, sale price, revenue, cost, profit, margin, and its book entry — and **↑ Jump to row in worksheet** scrolls you straight to that line and flashes it. The color legend under the bar tucks away with **Hide legend ▾** and stays how you left it.
- **This number vs your history** plots your decided bids on a margin scale — green dots are wins, red are price-losses — and calls where your current number sits. When bid tabs have been recorded on past bids (see *follow up with builders*), amber **▽** marks join the strip: each is the margin that would have **matched that tab's low**, and the line below counts the odds — *"At 32%, this number would have matched or beaten the low on 7 of 18 recorded tabs."* Pricing a bid for a GC with two or more recorded tabs, it also quotes that GC's range specifically.

:::example Working to a bid day number
You want this bid out the door at $42,000. Type 42000 in target total, Enter — every unpriced row fills, pinned rows hold, and the margin tile tells you what that number really earns.
:::
