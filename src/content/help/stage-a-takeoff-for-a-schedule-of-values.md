---
title: stage a takeoff for a schedule of values
category: Bids & Estimating
roles: dev, master_technician, assistant, estimator
keywords: schedule of values, sov, materials by stage, stage, rough in, top out, trim set, split, half, 1.5, factor, takeoff, sheet, assembly, bundle, fill from rules, print schedule, cover letter, of contract, pay application, payment schedule, labor and material, labor share, total only, note for the GC, my lines, by stage, g703, line items, mobilization, scale to contract, paste line names
order: 87
---
Every fixture on Bids → Takeoffs carries a stage, and the rail adds its material up by stage. You set each fixture's stage with its three boxes, then print the schedule or put it in the cover letter.

A schedule of values says what each stage of the job is worth. This schedule comes straight from the takeoff.

A takeoff turns the fixture counts into the list of parts a bid needs. Every fixture or tie-in on **Bids → Takeoffs** carries a stage. The stage can be {{chip:yellow|1 Rough In}}, {{chip:blue|2 Top Out}}, {{chip:green|3 Trim Set}}, or a split. A tie-in is a connection to an existing line. The rail, the side panel, adds the material cost up by stage. Then the rail multiplies each stage's total by the company factor. The factor is 1.5 unless Settings says otherwise.

## The boxes under each fixture

Under every fixture name on the sheet sit three small boxes, ***1 · 2 · 3***. Click one to put the fixture in that stage. Click a second one and the fixture splits evenly between the two. The text beside the boxes then reads ***½ · ½***. Click the split text to type your own shares, like **70 / 30**, and press Enter. Shift-click a box to make that stage the only one. With a row focused, the keys **1**, **2** and **3** do the same as a click.

:::example What the rules pick
Waste pipe goes half below the slab and half above: **½ · ½** on 1 and 2. Water, gas and vent pipe go in the wall: **2**. Drains, cleanouts, floor sinks, interceptors and sample wells go under the slab: **1**. Valves, hammer arrestors and mixing valves: **2**. Everything set at the end — water closets, lavs, sinks, water heaters: **3**. Travel and rentals get no stage.
:::

## When a line or a part belongs somewhere else

Every part line under a fixture follows the fixture's boxes, shown dashed. Click a line's own boxes and it goes its own way. The fixture cell then says *1 line has its own*. The small **↺** beside them returns it to the fixture. Inside an assembly bundle, each part has the same boxes. The P-trap can be **1** while the supply stops stay **3**. A bundle is one price. So when its parts disagree, the price splits by the parts' catalog value. A part with no catalog price counts as an average part.

## Fill from rules & book

{{button:outline|Fill from rules & book}} in the rail's **Stages** panel gives every fixture what the takeoff book remembers for it. Otherwise the button gives the stage the fixture's name implies, as in the example above. Boxes you set by hand are kept. The note under the button says what happened, like *4 fixtures staged from the book · 28 staged by rule · 2 set by hand kept · 1 has no stage (allowance)*.

## Teaching the book and the assembly

In One at a time, **Remember** on a finished fixture now remembers its stage as well as its lines. So the next bid that uses the book arrives staged. Inside an assembly, a part you stage by hand shows a small *remember for ‹assembly›* link. From then on every bid that uses that assembly stages the part the same way. The part shows dashed until you change it. Setting the whole line on a bid overrules the assembly for that job.

## What the Stages panel says

Each stage shows its raw material and, in bold, the raw number times the factor. The **Factor ×** field holds the company default from Settings → Bid Cover Letter Defaults. Type another number and this bid uses its own. The field turns amber and says *this bid*. The sentence under it counts the fixtures staged. The sentence also names how much money still has no stage.

## Printing the schedule

{{button:blue|Print schedule of values}} in the Stages panel prints two pages. First come the three stages with their raw material, the factored figure and the share. The fixtures under each stage are named. Then comes every fixture with its stage, like *3* or *1 + 2 (½ · ½)*. A fixture whose lines went their own way reads *mixed*. So a reviewer can check the boxes against the numbers. The Rough Takeoff print now carries each fixture's stage beside its count. Wendi used to write the stage in the margin that way.

## More on the schedule of values

- [Put a schedule of values in the cover letter](/help/put-a-schedule-of-values-in-the-cover-letter): the pill, labor and material, and My lines.
