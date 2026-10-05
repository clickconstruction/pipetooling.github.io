---
title: stage a takeoff for a schedule of values
category: Bids & Estimating
roles: dev, master_technician, assistant, estimator
keywords: schedule of values, sov, materials by stage, stage, rough in, top out, trim set, split, half, 1.5, factor, takeoff, sheet, assembly, bundle, fill from rules, print schedule, cover letter, of contract, pay application, payment schedule, labor and material, labor share, total only, note for the GC, my lines, by stage, g703, line items, mobilization, scale to contract, paste line names
order: 87
---
A schedule of values says what each stage of the job is worth. This schedule comes straight from the takeoff.

A takeoff turns the fixture counts into the list of parts a bid needs. Every fixture or tie-in on **Bids → Takeoffs** carries a stage. The stage can be {{chip:yellow|1 Rough In}}, {{chip:blue|2 Top Out}}, {{chip:green|3 Trim Set}}, or a split. A tie-in is a connection to an existing line. The rail, the side panel, adds the material cost up by stage. Then it multiplies it by the company factor. The factor is 1.5 unless Settings says otherwise.

## The boxes under each fixture

Under every fixture name on the sheet sit three small boxes, ***1 · 2 · 3***. Click one to put the fixture in that stage. Click a second one and the fixture splits evenly between the two. The text beside the boxes then reads ***½ · ½***. Click the split text to type your own shares, like **70 / 30**, and press Enter. Shift-click a box to make that stage the only one. With a row focused, the keys **1**, **2** and **3** do the same as a click.

:::example What the rules pick
Waste pipe goes half below the slab and half above: **½ · ½** on 1 and 2. Water, gas and vent pipe go in the wall: **2**. Drains, cleanouts, floor sinks, interceptors and sample wells go under the slab: **1**. Valves, hammer arrestors and mixing valves: **2**. Everything set at the end — water closets, lavs, sinks, water heaters: **3**. Travel and rentals get no stage.
:::

## When a line or a part belongs somewhere else

Every part line under a fixture follows the fixture's boxes, shown dashed. Click a line's own boxes and it goes its own way. The fixture cell then says *1 line has its own*. The small **↺** beside them returns it to the fixture. Inside an assembly bundle, each part has the same boxes. The P-trap can be **1** while the supply stops stay **3**. A bundle is one price. So when its parts disagree, the price splits by the parts' catalog value. A part with no catalog price counts as an average part.

## Fill from rules & book

{{button:outline|Fill from rules & book}} in the rail's **Stages** panel gives every fixture what the takeoff book remembers for it. Otherwise it gives the stage the fixture's name implies, as in the example above. Boxes you set by hand are kept. The note under the button says what happened, like *4 fixtures staged from the book · 28 staged by rule · 2 set by hand kept · 1 has no stage (allowance)*.

## Teaching the book and the assembly

In One at a time, **Remember** on a finished fixture now remembers its stage as well as its lines. So the next bid that uses the book arrives staged. Inside an assembly, a part you stage by hand shows a small *remember for ‹assembly›* link. From then on every bid that uses that assembly stages the part the same way. The part shows dashed until you change it. Setting the whole line on a bid overrules the assembly for that job.

## What the Stages panel says

Each stage shows its raw material and, in bold, the raw number times the factor. The **Factor ×** field holds the company default from Settings → Bid Cover Letter Defaults. Type another number and this bid uses its own. The field turns amber and says *this bid*. The sentence under it counts the fixtures staged. The sentence also names how much money still has no stage.

## Printing the schedule

{{button:blue|Print schedule of values}} in the Stages panel prints two pages. First come the three stages with their raw material, the factored figure and the share. The fixtures under each stage are named. Then comes every fixture with its stage, like *3* or *1 + 2 (½ · ½)*. A fixture whose lines went their own way reads *mixed*. So a reviewer can check the boxes against the numbers. The Rough Takeoff print now carries each fixture's stage beside its count. Wendi used to write the stage in the margin that way.

## Putting it in the letter

On **Cover Letter**, the {{chip:blue|Schedule of values}} pill spreads the letter's amount across the three stages. The pill uses the shares you set here. The pill writes one line per stage, like *Rough In — $35,596.80 (41.2%)*. Then comes a *Total* that always equals the amount. The lines show in the letter and the Approval PDF. There is nothing to type. The box under the pill shows the same lines. The box says how many costed fixtures are staged. The box warns in amber when some still need a stage. Unstaged money is left out of the shares, so stage those fixtures first. {{button:outline|Print the full schedule}} in that box prints the two pages above. This print adds an **Of contract** column at the letter's amount. The column is for a GC building a pay application. A pay application is a request to be paid for the work done so far. An alternate or a per-GC letter spreads its own amount by the same shares.

When a GC wants each stage broken into labor and material, tick **Split labor and material** under the schedule. Each stage's value divides by the ratio of the bid's own costs. One side of the ratio is the Labor tab's hours times the rate, plus subcontractors. The other side is the takeoff's material times the factor. So the line reads *Rough In — $35,596.80 (labor $12,143.83 · material $23,452.97)*. Type over a labor figure and the material recomputes, so the stage still adds up. The box turns amber, with *reset* to go back to the bid's costs. A note typed under a stage prints under its line. A stage with no hours and no material takes the company labor share from Settings → Bid Cover Letter Defaults. The stage then says *company rule*. Tick **Letter shows the total only** to keep the proposal to one line pointing at the attached schedule. Then print the schedule with its Labor, Material and Notes columns from {{button:outline|Print the full schedule}}.

## Two shapes: By stage or My lines

The schedule has a shape, chosen under the pill. {{chip:blue|By stage}} is the one above. The takeoff writes the three lines and keeps them current when the price or the stages change. {{chip:gray|My lines}} is your own schedule. Your own schedule suits a GC whose pay application wants its own lines. Such lines can be mobilization, underground, gas piping or a water heater. Mobilization is the cost of moving crews and gear onto the job. The first time you switch, the three stages become your first three lines. From there rename, {{button:outline|+ Add line}}, move with ▲ ▼, remove with ×, and give any line a note. **Paste the GC's line names…** takes the list from their form, one per row. The names arrive with blank values for you to fill. **Seed again from the stages** starts over from the three stages. Seeding again asks first. Switching back to By stage keeps your lines for next time. Nothing is lost either way.

A bar under the lines checks them against the letter's amount. The bar turns amber with the gap when they miss it. One click on **Scale every line to the contract** brings them to it. A typed labor figure scales with its line. With **Split labor and material** on, each line has a labor box. Leave it blank and the line takes the company share. **Print the schedule** prints the pay-application form, headed *for progress billing only*. The form's columns are #, description of work, labor and material, scheduled value, and notes.

The {{chip:blue|Materials by stage}} pill adds a short **Materials by stage** section. The section has one line per stage with the factored figure. Each pill is off unless you turn it on. The sections read in order. First is what each stage is worth. Next is when it is paid, from {{chip:gray|Payment schedule}}, headed *Payment schedule:* in the letter. Last is what the material costs.

In the payment schedule editor, {{button:outline|Use stage shares}} sets the *before Rough In / Top Out / Trim Set* percents from the takeoff's stage shares. The percents are scaled into whatever the retainage or deposit rows leave. Retainage is the part of each payment held back until the job is done. The percents are whole numbers that still add to 100.
