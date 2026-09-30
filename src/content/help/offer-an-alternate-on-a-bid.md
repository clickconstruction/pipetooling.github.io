---
title: offer an alternate on a bid — priced with and without
category: Bids & Estimating
roles: dev, master_technician, assistant, controller, estimator
keywords: alternate, alternates, with and without, add alternate, group, counttooling, counts, takeoffs, labor, pricing, cover letter, bid value, base bid, add-on
order: 98
---
A customer's plan set sometimes carries a section they call an **alternate**: they want the job priced **with it and without it**. One bid does both. Count the section as a group, mark the group as an alternate, and every tab prices the base and what the alternate adds.

## Count it as a group in CountTooling

In CountTooling, put the alternate's fixtures and runs in a **group** and turn on **Alternate** in the group's dialog. **Copy to /Tooling** puts that group's rows last, under `--- Alternate: Break room ---`. See [import a takeoff from CountTooling](?g=import-a-takeoff-from-counttooling).

## Import it, or mark it here

On **Bids → Counts**, {{button:outline|Import from /Tooling}} brings the group in as an alternate: the toast says *· 1 alternate: Break room (1 ea · 48.5 ft)*, an **Alternates** tile joins the strip, and every row in it wears **ALT**. Counted the section by hand? Flip to **By group** and turn on the {{chip:yellow|Alternate}} switch on the group's heading. Add to it later with the heading's {{button:outline|+ add here}}, or pick the group in quick add's **Group** box. See [count with the Count Sheet](?g=count-with-the-count-sheet).

:::example The two numbers, everywhere
Base · 5 ea · 112.00 ft — + Break room · 1 ea · 48.50 ft. Takeoffs, Labor, Pricing and the letter carry the same split in dollars.
:::

## Read the split on Takeoffs, Labor and Pricing

- **Takeoffs** (Sheet view): under **Materials on this bid**, an amber block reads **Base**, **+ Break room**, **With the alternate**.
- **Labor**: a card above the bottom line splits field hours, labor at the rate, driving and materials the same way, and ends with each column's direct cost.
- **Pricing**: the Workbench's scoreboard grows a second line — Base, + Break room, With the alternate, and the alternate's own margin. Price its rows like any other. Open the solver and a **Solve for** row picks what the margin slider and the target total price: {{chip:blue|Base}} to start (the number the letter leads with), the alternate on its own, or the whole bid. Rows outside the pick keep their prices.

## Offer it on the letter

On **Cover Letter**, under **In this cover letter**, each alternate has an **Offer** checkbox (on by default) and ✎ its wording. With it on:

- the proposed amount is the **base** — the job without the alternate;
- a block under it, **Alternates — priced in addition to the proposal above**, reads *Alternate 1 — Break room: add $2,717 (with it, $13,241.00)*, with the fixtures it covers on the next line;
- click the dashed wording on the preview (or ✎) to rename it or add a note — *Reset* returns to the automatic name.

Untick **Offer** and the alternate's price folds back into the proposed amount, as if it were never an alternate. An alternate whose rows have no sale price yet says {{chip:yellow|not priced yet}} here, and the letter reads *price to follow* for it instead of an amount; the signable link leaves it out until it is priced.

## When they answer

Mark the bid **Won** (Edit Bid, or a GC's packet on the Bid Board) and it asks **which alternates they took**. Tick the ones they did: the **Agreed value** becomes the sent base plus those add-ons, and the sent value stays as history. A GC's packet asks the same, one yes or no per alternate.

- A declined alternate's rows stay on the bid, greyed **ALT · declined**, and leave the job's materials, book fill, schedule of values and labor hours. Nothing is deleted, so a customer who comes back for it later is one tick away.
- The Bid Board shows the agreed value with a green **alt taken** chip, or **alt declined** when they passed.
- **The bid room asks for you.** On the signable link, each offered alternate is an add-on card the customer can tick beside the option they choose — ticked to start, with what it covers and what it adds. Their signature records the answer the same way, so the Won dialog shows it already ticked.

## What the Bid Board shows

**Mark sent today** stamps the base as the bid's value. The Bid Board shows the value with a small **+$2.7k alt** beside it — there as soon as the alternate is priced, and it follows the price when you reprice; hover it for each alternate's amount. A version priced *in lieu of* the proposal (see [bid one project to multiple GCs](?g=bid-one-project-to-multiple-gcs)) is a different thing and keeps its own heading on the letter.
