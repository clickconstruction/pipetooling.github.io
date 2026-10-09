---
title: put a schedule of values in the cover letter
category: Bids & Estimating
roles: dev, master_technician, assistant, estimator
keywords: schedule of values, sov, cover letter, of contract, pay application, payment schedule, labor and material, labor share, total only, note for the GC, my lines, by stage, g703, line items, mobilization, scale to contract, paste line names, materials by stage, use stage shares, retainage, deposit
---
A schedule of values in the cover letter says what each stage of the job is worth. You turn on the Schedule of values pill, and the letter's amount spreads by the takeoff's stage shares.

## Putting it in the letter

On **Cover Letter**, the {{chip:blue|Schedule of values}} pill spreads the letter's amount across the three stages. The pill uses the shares you set on the takeoff. The pill writes one line per stage, like *Rough In — $35,596.80 (41.2%)*. Then comes a *Total* that always equals the amount. The lines show in the letter and the Approval PDF. There is nothing to type. The box under the pill shows the same lines. The box says how many costed fixtures are staged. The box warns in amber when some still need a stage. Unstaged money is left out of the shares, so stage those fixtures first. {{button:outline|Print the full schedule}} in that box prints the same two pages as the takeoff's [Print schedule of values](/help/stage-a-takeoff-for-a-schedule-of-values#printing-the-schedule). This print adds an **Of contract** column at the letter's amount. The column is for a GC building a pay application. A pay application is a request to be paid for the work done so far. An alternate, a price offered instead of the letter's main price, spreads its own amount by the same shares. So does a per-GC letter.

When a GC wants each stage broken into labor and material, tick **Split labor and material** under the schedule. Each stage's value divides by the ratio of the bid's own costs. One side of the ratio is the Labor tab's hours times the rate, plus subcontractors. The other side is the takeoff's material times the [factor](/help/stage-a-takeoff-for-a-schedule-of-values#what-the-stages-panel-says). So the line reads *Rough In — $35,596.80 (labor $12,143.83 · material $23,452.97)*. Type over a labor figure and the material recomputes, so the stage still adds up. The box turns amber, with *reset* to go back to the bid's costs. A note typed under a stage prints under its line. A stage with no hours and no material takes the company labor share from Settings → Bid Cover Letter Defaults. The stage then says *company rule*. Tick **Letter shows the total only** to keep the proposal to one line pointing at the attached schedule. Then print the schedule with its Labor, Material and Notes columns from {{button:outline|Print the full schedule}}.

## Two shapes: By stage or My lines

The schedule has a shape, chosen under the pill. {{chip:blue|By stage}} is the one above. The takeoff writes the three lines and keeps them current when the price or the stages change. {{chip:gray|My lines}} is your own schedule, for a GC whose pay application wants its own lines. Such lines can be mobilization, underground, gas piping or a water heater. Mobilization is the charge for getting crews and gear set up on the job. The first time you switch, the three stages become your first three lines. From there rename, {{button:outline|+ Add line}}, move with ▲ ▼, remove with ×, and give any line a note. **Paste the GC's line names…** takes the list from their form, one per row. The names arrive with blank values for you to fill. **Seed again from the stages** starts over from the three stages. Seeding again asks first. Switching back to By stage keeps your lines for next time. Nothing is lost either way.

A bar under the lines checks them against the letter's amount. The bar turns amber with the gap when they miss it. One click on **Scale every line to the contract** brings the lines to the amount. A typed labor figure scales with its line. With **Split labor and material** on, each line has a labor box. Leave it blank and the line takes the company share. **Print the schedule** prints the pay-application form, headed *for progress billing only*. The form's columns are #, description of work, labor and material, scheduled value, and notes.

The {{chip:blue|Materials by stage}} pill adds a short **Materials by stage** section. The section has one line per stage with the factored figure. Each pill is off unless you turn it on. The sections read in order. First is what each stage is worth. Next is when it is paid, from {{chip:gray|Payment schedule}}, headed *Payment schedule:* in the letter. Last is what the material costs.

## The payment schedule from the stage shares

In the payment schedule editor, {{button:outline|Use stage shares}} sets the *before Rough In / Top Out / Trim Set* percents from the takeoff's stage shares. The percents are scaled into whatever the retainage or deposit rows leave. Retainage is the part of each payment held back until the job is done. The percents are whole numbers that still add to 100.

## More on the schedule of values

- [Stage a takeoff for a schedule of values](/help/stage-a-takeoff-for-a-schedule-of-values): the boxes, the rules and the book, the Stages panel and printing.
