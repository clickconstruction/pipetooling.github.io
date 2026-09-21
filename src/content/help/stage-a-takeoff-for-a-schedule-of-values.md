---
title: stage a takeoff for a schedule of values
category: Bids & Estimating
roles: dev, master_technician, assistant, estimator
keywords: schedule of values, sov, materials by stage, stage, rough in, top out, trim set, split, half, 1.5, factor, takeoff, sheet, assembly, bundle, fill from rules, print schedule
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

## Fill from rules

{{button:outline|Fill from rules}} in the rail's **Stages** panel gives every fixture the stage its name implies (the example above). Boxes you set by hand are kept; the note under the button says what happened — *32 fixtures staged by rule · 2 set by hand kept · 1 has no stage (allowance)*.

## What the Stages panel says

Each stage shows its raw material and, in bold, the raw number times the factor. The **Factor ×** field holds the company default from Settings → Bid Cover Letter Defaults; type another number and this bid uses its own (the field turns amber and says *this bid*). The sentence under it counts the fixtures staged and names how much money still has no stage.

## Printing the schedule

{{button:blue|Print schedule of values}} in the Stages panel prints two pages: the three stages with their raw material, the factored figure and the share (with the fixtures under each stage named), then every fixture with its stage — *3*, *1 + 2 (½ · ½)*, or *mixed* when its lines went their own way — so a reviewer can check the boxes against the numbers. The Rough Takeoff print now carries each fixture's stage beside its count, the way Wendi used to write it in the margin.

## Putting it in the letter

On **Cover Letter**, the {{chip:blue|Materials by stage}} pill beside {{chip:gray|Payment schedule}} adds a short **Materials by stage** section after the terms — one line per stage with the factored figure — to the letter and the Approval PDF. It is off unless you turn it on; the payment schedule stays its own section.
