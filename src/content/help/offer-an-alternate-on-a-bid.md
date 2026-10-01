---
title: offer an alternate on a bid — priced with and without
category: Bids & Estimating
roles: dev, master_technician, assistant, controller, estimator
keywords: alternate, alternates, with and without, add alternate, group, counttooling, counts, takeoffs, labor, pricing, cover letter, bid value, base bid, add-on
order: 98
---
A customer's plan set sometimes carries a section they call an alternate. They want the job priced with it and without it.

One bid does both. You count the section as a group. You mark the group as an **alternate**. Then every tab prices the base and what the alternate adds.

## Count it as a group in CountTooling

CountTooling is the takeoff tool. A takeoff is the count of fixtures and pipe runs from the plans. In CountTooling, you put the alternate's fixtures and runs in a **group**. You turn on **Alternate** in the group's dialog. **Copy to /Tooling** puts that group's rows last, under `--- Alternate: Break room ---`. See [import a takeoff from CountTooling](?g=import-a-takeoff-from-counttooling).

## Import it, or mark it here

On **Bids → Counts**, you press {{button:outline|Import from /Tooling}}. It brings the group in as an alternate. The toast says *· 1 alternate: Break room (1 ea · 48.5 ft)*. An **Alternates** tile joins the strip. Every row in it wears **ALT**. Did you count the section by hand? You flip to **By group**. You turn on the {{chip:yellow|Alternate}} switch on the group's heading. You add to it later with the heading's {{button:outline|+ add here}}. Or you pick the group in quick add's **Group** box. See [count with the Count Sheet](?g=count-with-the-count-sheet).

:::example The two numbers, everywhere
Base · 5 ea · 112.00 ft — + Break room · 1 ea · 48.50 ft. Takeoffs, Labor, Pricing and the letter carry the same split in dollars.
:::

## Read the split on Takeoffs, Labor and Pricing

- **Takeoffs**, in Sheet view: under **Materials on this bid**, an amber block reads **Base**, **+ Break room**, **With the alternate**.
- **Labor**: a card above the bottom line splits field hours, labor at the rate, driving and materials the same way. It ends with each column's direct cost.
- **Pricing**: the Workbench's scoreboard grows a second line. It reads Base, + Break room, With the alternate, and the alternate's own margin. You price its rows like any other. You open the solver, and a **Solve for** row picks what the margin slider and the target total price. {{chip:blue|Base}} is the start, the number the letter leads with. You can pick the alternate on its own, or the whole bid. Rows outside the pick keep their prices.

## Offer it on the letter

On **Cover Letter**, under **In this cover letter**, each alternate has an **Offer** checkbox and ✎ its wording. The checkbox is on by default. With it on:

- the proposed amount is the **base**, the job without the alternate.
- a block under it reads ***Alternates — priced in addition to the proposal above***. Its line reads *Alternate 1 — Break room: add $2,717 (with it, $13,241.00)*. The fixtures it covers sit on the next line.
- you click the dashed wording on the preview, or ✎, to rename it or add a note. *Reset* returns to the automatic name.

You untick **Offer** and the alternate's price folds back into the proposed amount. It is as if it were never an alternate. An alternate whose rows have no sale price yet says {{chip:yellow|not priced yet}} here. The letter reads *price to follow* for it instead of an amount. The signable link leaves it out until it is priced.

## When they answer

You mark the bid **Won** from Edit Bid, or from a GC's packet on the Bid Board. GC means the general contractor. The app asks **which alternates they took**. Each one has {{chip:green|Taken}}, {{chip:gray|Declined}} and {{chip:yellow|Not sure}}. Each starts on Not sure. Taken ones make the **Agreed value** the sent base plus those add-ons. The sent value stays as history. A GC's packet asks the same, one yes or no per alternate. A bid may already be won. Then the alternate's heading on the Counts tab, By group, asks too: {{button:outline|Taken}} or {{button:outline|Not taken}}.

- Only an alternate marked **Declined** leaves the job. Its rows stay on the bid, greyed ***ALT · declined***. They drop out of the job's materials, book fill and labor hours. They also drop out of the schedule of values, the payment breakdown by line. Nothing is deleted. So a customer who comes back for it later is one click away.
- An alternate nobody has answered stays in the job. The Bid Board shows {{chip:yellow|alt ?}} until someone does. After that it shows the agreed value with a green **alt taken** chip. It shows **alt declined** when they passed.
- **The bid room asks for you.** On the signable link, each offered alternate is an add-on card. The customer can tick it beside the option they choose. It is ticked to start, with what it covers and what it adds. Their signature records the answer the same way. So the Won dialog shows it already ticked.

## What the Bid Board shows

**Mark sent today** stamps the base as the bid's value. The Bid Board shows the value with a small **+$2.7k alt** beside it. It is there as soon as the alternate is priced. It follows the price when you reprice. You hover it for each alternate's amount. A version priced *in lieu of* the proposal is a different thing. See [bid one project to multiple GCs](?g=bid-one-project-to-multiple-gcs). It keeps its own heading on the letter.
