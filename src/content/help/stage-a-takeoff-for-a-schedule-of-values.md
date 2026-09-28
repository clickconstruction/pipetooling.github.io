---
title: stage a takeoff for a schedule of values
category: Bids & Estimating
roles: dev, master_technician, assistant, estimator
keywords: schedule of values, sov, materials by stage, stage, rough in, top out, trim set, split, half, 1.5, factor, takeoff, sheet, assembly, bundle, fill from rules, print schedule, cover letter, of contract, pay application, payment schedule
order: 87
---
A schedule of values says what each stage of the job is worth. This one comes straight from the takeoff: every fixture or tie-in on **Bids → Takeoffs** carries a stage — {{chip:yellow|1 Rough In}}, {{chip:blue|2 Top Out}}, {{chip:green|3 Trim Set}}, or a split — and the rail adds the material cost up by stage and multiplies it by the company factor (1.5 unless Settings says otherwise).

## The boxes under each fixture

Under every fixture name on the sheet sit three small boxes, **1 · 2 · 3**. Click one to put the fixture in that stage. Click a second one and the fixture splits evenly between the two (the text beside the boxes reads **½ · ½**). Click the split text to type your own shares — **70 / 30** — and press Enter. Shift-click a box to make that stage the only one. With a row focused, the keys **1**, **2** and **3** do the same as a click.

:::example What the rules pick
Waste pipe goes half below the slab and half above: **½ · ½** on 1 and 2. Water, gas and vent pipe go in the wall: **2**. Drains, cleanouts, floor sinks, interceptors and sample wells go under the slab: **1**. Valves, hammer arrestors and mixing valves: **2**. Everything set at the end — water closets, lavs, sinks, water heaters: **3**. Travel and rentals get no stage.
:::

## When a line or a part belongs somewhere else

Every part line under a fixture follows the fixture's boxes, shown dashed. Click a line's own boxes and it goes its own way (the fixture cell says *1 line has its own*); the small **↺** beside them returns it to the fixture. Inside an assembly bundle, each part has the same boxes: the P-trap can be **1** while the supply stops stay **3**. A bundle is one price, so when its parts disagree the price splits by the parts' catalog value; a part with no catalog price counts as an average part.

## Fill from rules & book

{{button:outline|Fill from rules & book}} in the rail's **Stages** panel gives every fixture what the takeoff book remembers for it, and otherwise the stage its name implies (the example above). Boxes you set by hand are kept; the note under the button says what happened — *4 fixtures staged from the book · 28 staged by rule · 2 set by hand kept · 1 has no stage (allowance)*.

## Teaching the book and the assembly

**Remember** on a finished fixture (One at a time) now remembers its stage as well as its lines, so the next bid that uses the book arrives staged. Inside an assembly, a part you stage by hand shows a small *remember for ‹assembly›* link: from then on every bid that uses that assembly stages the part the same way, shown dashed until you change it. Setting the whole line on a bid overrules the assembly for that job.

## What the Stages panel says

Each stage shows its raw material and, in bold, the raw number times the factor. The **Factor ×** field holds the company default from Settings → Bid Cover Letter Defaults; type another number and this bid uses its own (the field turns amber and says *this bid*). The sentence under it counts the fixtures staged and names how much money still has no stage.

## Printing the schedule

{{button:blue|Print schedule of values}} in the Stages panel prints two pages: the three stages with their raw material, the factored figure and the share (with the fixtures under each stage named), then every fixture with its stage — *3*, *1 + 2 (½ · ½)*, or *mixed* when its lines went their own way — so a reviewer can check the boxes against the numbers. The Rough Takeoff print now carries each fixture's stage beside its count, the way Wendi used to write it in the margin.

## Putting it in the letter

On **Cover Letter**, the {{chip:blue|Schedule of values}} pill spreads the letter's amount across the three stages by the shares you set here — *Rough In — $35,596.80 (41.2%)*, one line per stage, then a *Total* that always equals the amount — in the letter and the Approval PDF. Nothing to type: the box under the pill shows the same lines, says how many costed fixtures are staged, and warns in amber when some still need a stage (their money is left out of the shares, so stage them first). {{button:outline|Print the full schedule}} in that box prints the two pages above with an **Of contract** column at the letter's amount, for a GC building a pay application. An alternate or a per-GC letter spreads its own amount by the same shares.

The {{chip:blue|Materials by stage}} pill adds a short **Materials by stage** section — one line per stage with the factored figure. Each pill is off unless you turn it on, and the sections read in order: what each stage is worth, when it is paid ({{chip:gray|Payment schedule}}, headed *Payment schedule:* in the letter), what the material costs.

In the payment schedule editor, {{button:outline|Use stage shares}} sets the *before Rough In / Top Out / Trim Set* percents from the takeoff's stage shares, scaled into whatever the retainage or deposit rows leave, in whole percents that still add to 100.
